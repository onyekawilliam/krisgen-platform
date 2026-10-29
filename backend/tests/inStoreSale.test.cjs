const { before, after, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Referral = require("../models/Referral");
const Commission = require("../models/Commission");
const Settings = require("../models/Settings");
const PaymentReceipt = require("../models/PaymentReceipt");
const { recordInStoreSale } = require("../services/inStoreSaleService");
const { generateCommissionsForOrder } = require("../services/commissionService");
const express = require("express");
const jwt = require("jsonwebtoken");
const paymentService = require("../services/paymentService");
let verificationResult;
let verificationCalls = 0;
// Replace the provider boundary before loading routes: no payment request is sent.
paymentService.verifyFlutterwaveTransaction = async transactionId => {
  verificationCalls++;
  assert.match(String(transactionId), /^\d+$/);
  return verificationResult;
};
process.env.JWT_SECRET = "isolated-test-jwt-secret";
const adminRoutes = require("../routes/adminRoutes");
const orderRoutes = require("../routes/orderRoutes");

let replSet;
let server;
let baseUrl;
let product;
let adminId;
let seller;
let customer;
let parent;
before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  for (const model of [Order, Product, User, Referral, Commission, Settings, PaymentReceipt]) await model.init();
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRoutes);
  app.use("/api/orders", orderRoutes);
  app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ message: err.message, code: err.code }));
  await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = "http://127.0.0.1:" + server.address().port;
}, { timeout: 600000 });
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});
beforeEach(async () => {
  verificationCalls = 0;
  verificationResult = { verified: false, raw: {} };
  for (const model of [Order, Product, User, Referral, Commission, Settings, PaymentReceipt]) await model.deleteMany({});
  adminId = new mongoose.Types.ObjectId();
  product = await Product.create({ name: "Test Phone", brand: "Samsung", model: "Test",
    sellingPrice: 150000, costPrice: 100000, stock: 10 });
  parent = await member("Parent");
  seller = await member("Seller", parent._id);
  customer = await member("Buyer", seller._id);
  await Referral.create({ referrer: parent._id, referred: seller._id });
  await Referral.create({ referrer: seller._id, referred: customer._id });
  await Settings.create({ key: "platform", directCommissionRate: 15, referralOverrideRate: 5 });
});
async function member(name, referredBy = null) {
  return User.create({ name, email: name.toLowerCase() + "@test.invalid", phone: "08012345678",
    passwordHash: "test-password", referralCode: name, referredBy });
}
function sale(overrides = {}) {
  return { idempotencyKey: "sale-1", customerName: "Walk In", customerPhone: "08012345678",
    productId: String(product._id), quantity: 2, paymentMethod: "cash", ...overrides };
}
async function stock() { return (await Product.findById(product._id)).stock; }
async function request(method, url, body, userId) {
  const headers = { "Content-Type": "application/json" };
  if (userId) headers.Authorization = "Bearer " + jwt.sign({ id: String(userId) }, process.env.JWT_SECRET);
  const response = await fetch(baseUrl + url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
test("walk-in: paid order with contact snapshot, no account and no commission", async () => {
  const result = await recordInStoreSale(sale(), adminId);
  assert.equal(result.replayed, false);
  assert.equal(result.order.buyer, null);
  assert.equal(result.order.soldBy, null);
  assert.equal(result.order.walkInCustomer.phone, "08012345678");
  assert.equal(result.order.status, "paid");
  assert.equal(result.order.payment.verified, true);
  assert.equal(result.order.totalAmount, 300000);
  assert.equal(await stock(), 8);
  assert.equal(await Commission.countDocuments(), 0);
  assert.equal(await User.countDocuments(), 3);
});
test("registered buyer: saved referrer earns direct profit commission and exactly one override", async () => {
  const { order } = await recordInStoreSale(sale({ customerId: String(customer._id), paymentMethod: "pos" }), adminId);
  assert.equal(String(order.buyer), String(customer._id));
  assert.equal(String(order.soldBy), String(seller._id));
  const rows = await Commission.find({ order: order._id }).sort({ type: 1 });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].grossProfitSnapshot, 100000);
  assert.equal(rows[0].commissionAmount, 15000);
  assert.equal(String(rows[0].beneficiary), String(seller._id));
  assert.equal(rows[1].commissionAmount, 5000);
  assert.equal(String(rows[1].beneficiary), String(parent._id));
});
test("walk-in referring member and product rate override, including zero", async () => {
  await Product.updateOne({ _id: product._id }, { commissionRateOverride: 20 });
  const body = sale({ referrerId: String(seller._id), paymentMethod: "transfer" });
  await recordInStoreSale(body, adminId);
  assert.equal((await Commission.findOne({ type: "direct" })).commissionAmount, 20000);
  await Product.updateOne({ _id: product._id }, { commissionRateOverride: 0 });
  const { order } = await recordInStoreSale({ ...body, idempotencyKey: "zero-rate" }, adminId);
  assert.equal((await Commission.findOne({ order: order._id, type: "direct" })).commissionAmount, 0);
});
test("registered customer with no saved referrer generates no commissions", async () => {
  await recordInStoreSale(sale({ customerId: String(parent._id) }), adminId);
  assert.equal(await Commission.countDocuments(), 0);
});
test("replay after stock or prices change does not repeat deductions or commissions", async () => {
  const body = sale({ referrerId: String(seller._id) });
  const first = await recordInStoreSale(body, adminId);
  await Product.updateOne({ _id: product._id }, { sellingPrice: 190000, stock: 0 });
  const retry = await recordInStoreSale(body, adminId);
  assert.equal(retry.replayed, true);
  assert.equal(String(retry.order._id), String(first.order._id));
  assert.equal(retry.order.totalAmount, 300000);
  assert.equal(await stock(), 0);
  assert.equal(await Commission.countDocuments(), 2);
});
test("same key with changed details or another admin returns conflict", async () => {
  await recordInStoreSale(sale(), adminId);
  await assert.rejects(recordInStoreSale(sale({ quantity: 1 }), adminId), { statusCode: 409 });
  await assert.rejects(recordInStoreSale(sale(), new mongoose.Types.ObjectId()), { statusCode: 409 });
  assert.equal(await stock(), 8);
  assert.equal(await Order.countDocuments(), 1);
});
test("simultaneous identical requests commit one sale", async () => {
  const body = sale({ referrerId: String(seller._id) });
  const results = await Promise.all(Array.from({ length: 4 }, () => recordInStoreSale(body, adminId)));
  assert.equal(new Set(results.map(r => String(r.order._id))).size, 1);
  assert.equal(results.filter(r => !r.replayed).length, 1);
  assert.equal(await stock(), 8);
  assert.equal(await Order.countDocuments(), 1);
  assert.equal(await Commission.countDocuments(), 2);
});
test("different products racing with one key roll back the losing stock update", async () => {
  const other = await Product.create({ name: "Other", brand: "Itel", model: "Other",
    sellingPrice: 50000, costPrice: 40000, stock: 10 });
  const results = await Promise.allSettled([
    recordInStoreSale(sale(), adminId),
    recordInStoreSale(sale({ productId: String(other._id) }), adminId),
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(results.find(r => r.status === "rejected").reason.statusCode, 409);
  assert.equal(await Order.countDocuments(), 1);
  assert.equal(await stock() + (await Product.findById(other._id)).stock, 18);
});
test("concurrent separate sales cannot oversell the final unit", async () => {
  await Product.updateOne({ _id: product._id }, { stock: 1 });
  const results = await Promise.allSettled([
    recordInStoreSale(sale({ quantity: 1, idempotencyKey: "a" }), adminId),
    recordInStoreSale(sale({ quantity: 1, idempotencyKey: "b" }), adminId),
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(results.find(r => r.status === "rejected").reason.statusCode, 409);
  assert.equal(await stock(), 0);
  assert.equal(await Order.countDocuments(), 1);
});
test("override creation failure rolls back order, stock, direct commission and newly created settings", async () => {
  await Settings.deleteMany({});
  const original = Commission.prototype.save;
  Commission.prototype.save = function (...args) {
    if (this.type === "override") throw new Error("Injected override failure");
    return original.apply(this, args);
  };
  const body = sale({ referrerId: String(seller._id) });
  try { await assert.rejects(recordInStoreSale(body, adminId), /Injected override failure/); }
  finally { Commission.prototype.save = original; }
  assert.equal(await stock(), 10);
  assert.equal(await Order.countDocuments(), 0);
  assert.equal(await Commission.countDocuments(), 0);
  assert.equal(await Settings.countDocuments(), 0);
  await recordInStoreSale(body, adminId);
  assert.equal(await Order.countDocuments(), 1);
  assert.equal(await Commission.countDocuments(), 2);
});
test("bad input and inactive referrer leave no order or stock changes", async () => {
  for (const overrides of [{ quantity: 0 }, { quantity: 1.5 }, { quantity: true },
    { productId: "bad" }, { customerPhone: "" }, { customerName: {} },
    { customerEmail: "bad-email" }, { idempotencyKey: " " }, { paymentMethod: "flutterwave" },
    { customerId: String(customer._id), referrerId: String(parent._id) }]) {
    await assert.rejects(recordInStoreSale(sale(overrides), adminId), { statusCode: 400 });
  }
  await User.updateOne({ _id: seller._id }, { status: "suspended" });
  await assert.rejects(recordInStoreSale(sale({ referrerId: String(seller._id) }), adminId), { statusCode: 404 });
  assert.equal(await stock(), 10);
  assert.equal(await Order.countDocuments(), 0);
});
test("existing commission call without session remains compatible and idempotent", async () => {
  const order = await Order.create({ orderNumber: "ONLINE-TEST", buyer: customer._id,
    soldBy: seller._id, status: "paid", totalAmount: 300000,
    items: [{ product: product._id, name: product.name, quantity: 2,
      sellingPriceSnapshot: 150000, costPriceSnapshot: 100000 }] });
  await generateCommissionsForOrder(order);
  await generateCommissionsForOrder(order);
  assert.equal(await Commission.countDocuments(), 2);
  assert.equal((await Commission.findOne({ type: "direct" })).commissionAmount, 15000);
});
test("in-store HTTP route requires admin and returns 201 then 200 for replay", async () => {
  assert.equal((await request("POST", "/api/admin/orders/in-store", sale())).status, 401);
  assert.equal((await request("POST", "/api/admin/orders/in-store", sale(), customer._id)).status, 403);
  const admin = await member("Admin");
  await User.updateOne({ _id: admin._id }, { role: "admin" });
  const created = await request("POST", "/api/admin/orders/in-store", sale(), admin._id);
  assert.equal(created.status, 201);
  const replayed = await request("POST", "/api/admin/orders/in-store", sale(), admin._id);
  assert.equal(replayed.status, 200);
  assert.equal(replayed.body.data._id, created.body.data._id);
  assert.equal(await stock(), 8);
  assert.equal(verificationCalls, 0);
});
test("Flutterwave checkout and verification retain stock and profit commissions", async () => {
  const created = await request("POST", "/api/orders", {
    items: [{ productId: String(product._id), quantity: 2 }],
  }, customer._id);
  assert.equal(created.status, 201);
  assert.equal(created.body.data.currency, "NGN");
  assert.equal(typeof created.body.data.paymentReference, "string");
  verificationResult = {
    verified: true, transactionId: "10001", amount: created.body.data.totalAmount,
    currency: created.body.data.currency, reference: created.body.data.paymentReference, raw: {},
  };
  const body = { orderId: created.body.data.orderId, transactionId: "10001" };
  assert.equal(await stock(), 10);
  const verified = await request("POST", "/api/orders/verify-payment", body, customer._id);
  assert.equal(verified.status, 200);
  assert.equal(verified.body.data.status, "paid");
  assert.equal(await stock(), 8);
  assert.equal((await Commission.findOne({ type: "direct" })).commissionAmount, 15000);
  assert.equal((await Commission.findOne({ type: "override" })).commissionAmount, 5000);
  assert.equal((await request("POST", "/api/orders/verify-payment", body, customer._id)).status, 200);
  assert.equal(verificationCalls, 1);
  assert.equal(await stock(), 8);
  assert.equal(await Commission.countDocuments(), 2);
});
test("failed Flutterwave verification leaves stock and commissions unchanged", async () => {
  const created = await request("POST", "/api/orders", {
    items: [{ productId: String(product._id), quantity: 2 }],
  }, customer._id);
  verificationResult = { verified: false, raw: {} };
  const result = await request("POST", "/api/orders/verify-payment", {
    orderId: created.body.data.orderId, transactionId: "10002",
  }, customer._id);
  assert.equal(result.status, 400);
  assert.equal((await Order.findById(created.body.data.orderId)).status, "pending_payment");
  assert.equal(await stock(), 10);
  assert.equal(await Commission.countDocuments(), 0);
});
test("walk-in orders fail ownership checks cleanly and in-store sales never call Flutterwave", async () => {
  const { order } = await recordInStoreSale(sale(), adminId);
  assert.equal((await request("POST", "/api/orders/verify-payment", {
    orderId: String(order._id), transactionId: "10003",
  }, customer._id)).status, 403);
  assert.equal((await request("PATCH", "/api/orders/" + order._id + "/cancel", {}, customer._id)).status, 403);
  const registered = await recordInStoreSale(sale({ idempotencyKey: "registered-offline", customerId: String(customer._id) }), adminId);
  await Order.updateOne({ _id: registered.order._id }, { status: "processing" });
  assert.equal((await request("POST", "/api/orders/verify-payment", {
    orderId: String(registered.order._id), transactionId: "10003",
  }, customer._id)).status, 400);
  assert.equal(verificationCalls, 0);
});
