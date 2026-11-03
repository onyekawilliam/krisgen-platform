const crypto = require("crypto");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const mongoose = require("mongoose");
const PaymentReceipt = require("../models/PaymentReceipt");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { verifyOrderPayment } = require("../services/onlinePaymentService");
const { minorUnits } = require("../utils/paymentMoney");
const { reverseCommissionsForOrder } = require("../services/commissionService");
const { requireString, queryString } = require("../utils/inputGuards");

function validShippingAddress(address) {
  if (!address || typeof address !== "object" || Array.isArray(address)) {
    throw new ApiError(400, "A delivery address is required");
  }
  return {
    fullName: requireString(address.fullName, "Recipient name", { max: 100 }),
    phone: requireString(address.phone, "Recipient phone", { max: 40, min: 7 }),
    address: requireString(address.address, "Street address", { max: 250 }),
    city: requireString(address.city, "City", { max: 100 }),
    state: requireString(address.state, "State", { max: 100 }),
  };
}

// Creates a pending order from selling-price snapshots taken server-side —
// the frontend sends product IDs, quantities and a delivery address, never
// prices. The seller who earns the commission is the buyer's own referrer
// (soldBy = buyer.referredBy); a buyer nobody referred earns nobody a commission.
exports.createOrder = asyncHandler(async (req, res) => {
  const { items } = req.body;
  const shippingAddress = validShippingAddress(req.body.shippingAddress);
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    throw new ApiError(400, "Order must contain 1 to 100 items");
  }
  const buyer = await User.findById(req.user._id).select("referredBy");
  const quantities = new Map();
  for (const item of items) {
    if (!item || !mongoose.isObjectIdOrHexString(item.productId) ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      throw new ApiError(400, "Each item requires a valid product ID and positive whole quantity");
    }
    const id = String(item.productId).toLowerCase();
    const quantity = (quantities.get(id) || 0) + item.quantity;
    if (!Number.isSafeInteger(quantity)) throw new ApiError(400, "Invalid quantity");
    quantities.set(id, quantity);
  }
  const orderItems = [];
  let totalMinor = 0;
  for (const [productId, quantity] of quantities) {
    const product = await Product.findById(productId).select("+costPrice");
    if (!product || !product.isActive) throw new ApiError(400, "Product is unavailable");
    if (product.stock < quantity) throw new ApiError(400, `${product.name} is out of stock`);
    const price = minorUnits(product.sellingPrice);
    if (price == null || price <= 0 || !Number.isFinite(product.costPrice)) {
      throw new ApiError(400, "Product prices are invalid");
    }
    totalMinor += price * quantity;
    if (!Number.isSafeInteger(totalMinor)) throw new ApiError(400, "Order total is too large");
    orderItems.push({ product: product._id, name: product.name, quantity,
      sellingPriceSnapshot: product.sellingPrice, costPriceSnapshot: product.costPrice });
  }
  const paymentReference = `KRG-PAY-${crypto.randomUUID()}`;
  const order = await Order.create({
    orderNumber: `KRG-${Date.now()}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
    buyer: req.user._id, soldBy: buyer?.referredBy || null, items: orderItems,
    totalAmount: totalMinor / 100, shippingAddress, status: "pending_payment",
    payment: { provider: "flutterwave", currency: "NGN", expectedReferences: [paymentReference] },
  });
  res.status(201).json({ success: true, data: {
    orderId: order._id, orderNumber: order.orderNumber, totalAmount: order.totalAmount,
    paymentReference, currency: "NGN",
  } });
});

exports.createPaymentAttempt = asyncHandler(async (req, res) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) throw new ApiError(400, "Invalid order ID");
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");
  if (!order.buyer || String(order.buyer) !== String(req.user._id)) throw new ApiError(403, "Not your order");
  if (order.saleType === "in_store" || order.status !== "pending_payment" || order.payment.verified) {
    throw new ApiError(409, "This order is not awaiting payment");
  }
  if (await PaymentReceipt.exists({ order: order._id })) {
    throw new ApiError(409, "Payment already received. Do not pay again; contact support for review.");
  }
  const paymentReference = `KRG-PAY-${crypto.randomUUID()}`;
  const updated = await Order.findOneAndUpdate({ _id: order._id, status: "pending_payment",
    "payment.verified": { $ne: true } }, { $push: { "payment.expectedReferences": paymentReference } }, { new: true });
  if (!updated) throw new ApiError(409, "Order changed; refresh before paying");
  res.json({ success: true, data: { paymentReference, totalAmount: updated.totalAmount, currency: "NGN" } });
});

exports.verifyPayment = asyncHandler(async (req, res) => {
  const data = await verifyOrderPayment(req.body, req.user._id);
  res.json({ success: true, data });
});

exports.myOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ buyer: req.user._id }).sort({ createdAt: -1 });
  const receipts = await PaymentReceipt.find({ order: { $in: orders.map(o => o._id) }, resolutionRequired: true });
  const received = new Set(receipts.map(r => String(r.order)));
  const data = orders.map(order => {
    const obj = order.toObject();
    if (received.has(String(order._id)) && order.status === "pending_payment") {
      obj.status = "payment_review";
      obj.payment.verified = true;
      obj.payment.resolutionRequired = true;
    }
    return obj;
  });
  res.json({ success: true, data });
});

exports.cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (!order.buyer || order.buyer.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Not your order");
  }

  if (order.status !== "pending_payment") {
    throw new ApiError(
      400,
      "Only orders awaiting payment can be cancelled"
    );
  }

  const received = await PaymentReceipt.exists({ order: order._id });
  if (received) throw new ApiError(409, "Payment already received; contact support to resolve this order");
  const changed = await Order.updateOne({ _id: order._id, status: "pending_payment", "payment.verified": { $ne: true } }, { $set: { status: "cancelled" } });
  if (changed.modifiedCount !== 1) throw new ApiError(409, "Order changed; refresh before cancelling");
  order.status = "cancelled";

  res.json({
    success: true,
    message: "Order cancelled",
    data: order,
  });
});

// ----- Admin -----

exports.adminListOrders = asyncHandler(async (req, res) => {
  const status = queryString(req.query.status);
  const query = status ? { status } : {};
  const orders = await Order.find(query)
  .populate("buyer", "name email phone")
  .populate("items.product", "brand model name")
  .sort({ createdAt: -1 });
  res.json({ success: true, data: orders });
});

exports.adminUpdateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ["processing", "delivered", "cancelled", "refunded"];
  if (!allowed.includes(status)) throw new ApiError(400, "Invalid status");

  const order = await mongoose.connection.transaction(async session => {
    const current = await Order.findById(req.params.id).session(session);
    if (!current) throw new ApiError(404, "Order not found");
    const unresolved = await PaymentReceipt.exists({ order: current._id, resolutionRequired: true }).session(session);
    if (["processing", "delivered"].includes(status) &&
        (unresolved || current.payment.resolutionRequired || !["paid", "processing", "delivered"].includes(current.status))) {
      throw new ApiError(409, "Resolve the payment and inventory before fulfilling this order");
    }
    if (current.status === "payment_review" && status === "cancelled") {
      throw new ApiError(409, "Payment was received; resolve it or record the completed manual refund");
    }
    current.status = status;
    if (status === "refunded") {
      current.payment.resolutionRequired = false;
      current.payment.resolutionReason = "manual_refund_recorded";
      await PaymentReceipt.updateMany({ order: current._id }, { $set: {
        resolutionRequired: false, resolutionReason: "manual_refund_recorded",
      } }, { session });
    }
    await current.save({ session });
    if (status === "cancelled" || status === "refunded") {
      await reverseCommissionsForOrder(current._id, { session });
    }
    return current;
  }, { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  res.json({ success: true, data: order });
});
