const crypto = require("crypto");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const { generateCommissionsForOrder } = require("./commissionService");

let indexReady;
function ensureIdempotencyIndex() {
  // A schema declaration alone does not enforce uniqueness when autoIndex is off.
  // Never drop or rebuild an existing index; fail before any sale writes if this fails.
  if (!indexReady) {
    indexReady = Order.collection.createIndex(
      { idempotencyKey: 1 }, { unique: true, sparse: true }
    ).catch(err => { indexReady = null; throw err; });
  }
  return indexReady;
}

function text(value, label, { required = false, max = 200 } = {}) {
  if (value == null && !required) return "";
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) {
    throw new ApiError(400, `Invalid or missing ${label}`);
  }
  return value.trim();
}

function objectId(value, label, required = false) {
  if ((value == null || value === "") && !required) return null;
  if (typeof value !== "string" || !mongoose.isObjectIdOrHexString(value)) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return value.toLowerCase();
}

function normalize(body) {
  const idempotencyKey = text(body.idempotencyKey, "sale request ID", { required: true, max: 128 });
  const customerId = objectId(body.customerId, "customer ID");
  const productId = objectId(body.productId, "product ID", true);
  const requestedQuantity = body.quantity === undefined ? 1 : body.quantity;
  if (!["number", "string"].includes(typeof requestedQuantity)) {
    throw new ApiError(400, "Quantity must be a positive whole number");
  }
  const quantity = Number(requestedQuantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new ApiError(400, "Quantity must be a positive whole number");
  }
  if (!["cash", "pos", "transfer"].includes(body.paymentMethod)) {
    throw new ApiError(400, "Invalid payment method");
  }
  if (customerId && body.referrerId) {
    throw new ApiError(400, "Registered customers use their saved referrer");
  }
  const walkInCustomer = customerId ? null : {
    name: text(body.customerName, "walk-in customer name", { required: true }),
    phone: text(body.customerPhone, "walk-in customer phone", { required: true, max: 40 }),
    email: text(body.customerEmail, "email", { max: 254 }).toLowerCase(),
  };
  if (walkInCustomer?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(walkInCustomer.email)) {
    throw new ApiError(400, "Invalid email address");
  }
  return {
    idempotencyKey, customerId, productId, quantity, paymentMethod: body.paymentMethod,
    referrerId: customerId ? null : objectId(body.referrerId, "referrer ID"), walkInCustomer,
  };
}

function replay(order, requestHash) {
  if (order.saleType !== "in_store" || order.inStoreRequestHash !== requestHash) {
    const err = new ApiError(409, "This sale request ID belongs to different sale details or another admin. Confirm it with the original admin before recording another sale.");
    err.code = "SALE_REQUEST_CONFLICT";
    throw err;
  }
  return { order, replayed: true };
}

async function recordInStoreSale(body, adminId) {
  const sale = normalize(body);
  const { idempotencyKey, customerId, productId, quantity, referrerId, walkInCustomer, paymentMethod } = sale;
  const requestHash = crypto.createHash("sha256")
    .update(JSON.stringify({ ...sale, recordedBy: String(adminId) })).digest("hex");
  await ensureIdempotencyIndex();
  const lookup = () => Order.findOne({ idempotencyKey }).select("+inStoreRequestHash");
  const existing = await lookup();
  if (existing) return replay(existing, requestHash);

  try {
    return await mongoose.connection.transaction(async session => {
      const duplicate = await lookup().session(session);
      if (duplicate) return replay(duplicate, requestHash);

      let soldBy = referrerId;
      if (customerId) {
        const customer = await User.findOne({ _id: customerId, role: "customer" })
          .select("referredBy").session(session);
        if (!customer) throw new ApiError(404, "Customer not found");
        soldBy = customer.referredBy || null;
      } else if (soldBy) {
        const referrer = await User.findOne({ _id: soldBy, role: "customer", status: "active" })
          .session(session);
        if (!referrer) throw new ApiError(404, "Referrer not found or inactive");
      }

      const product = await Product.findOneAndUpdate(
        { _id: productId, isActive: true, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { new: true, session }
      ).select("+costPrice");
      if (!product) throw new ApiError(409, "Product unavailable or insufficient stock");
      const totalAmount = product.sellingPrice * quantity;
      if (!Number.isFinite(totalAmount) || !Number.isFinite(product.costPrice)) {
        throw new ApiError(400, "Product prices are invalid");
      }
      const order = new Order({
        idempotencyKey, inStoreRequestHash: requestHash, recordedBy: adminId,
        orderNumber: `KRG-${Date.now()}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
        buyer: customerId, soldBy, saleType: "in_store",
        walkInCustomer: walkInCustomer || undefined,
        items: [{ product: product._id, name: product.name, quantity,
          sellingPriceSnapshot: product.sellingPrice, costPriceSnapshot: product.costPrice }],
        totalAmount, status: "paid",
        payment: { provider: paymentMethod, reference: `INSTORE-${crypto.randomUUID()}`,
          verified: true, verifiedAt: new Date() },
      });
      await order.save({ session });
      await generateCommissionsForOrder(order, { session });
      return { order, replayed: false };
    }, { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } catch (err) {
    // A competing request may commit after our initial read. Its unique-key
    // collision aborts our entire transaction, including the stock decrement.
    if (err.code === 11000 || err.hasErrorLabel?.("UnknownTransactionCommitResult")) {
      const committed = await lookup();
      if (committed) return replay(committed, requestHash);
    }
    if (err.code === 20 || err.codeName === "IllegalOperation") {
      throw new ApiError(503, "In-store sales require a MongoDB replica set or Atlas cluster. No sale was recorded.");
    }
    throw err;
  }
}

module.exports = { recordInStoreSale };
