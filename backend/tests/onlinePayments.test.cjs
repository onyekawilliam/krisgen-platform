const { before, after, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
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
const paymentService = require("../services/paymentService");

// The provider boundary is replaced before loading the controller/routes. These
// tests use only an isolated replica set and never call Flutterwave or read .env.
let providerResults;
let providerCalls;
paymentService.verifyFlutterwaveTransaction = async transactionId => {
  const key = String(transactionId);
  providerCalls.push(key);
  assert.ok(providerResults.has(key), "Unexpected provider verification: " + key);
  const result = providerResults.get(key);
  return typeof result === "function" ? result() : result;
};
process.env.JWT_SECRET = "isolated-online-payment-regression-secret";
const orderRoutes = require("../routes/orderRoutes");

let replSet;
let server;
let baseUrl;
let product;
let parent;
let seller;
let buyer;
let adminId;
const models = [Order, Product, User, Referral, Commission, Settings, PaymentReceipt];

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  for (const model of models) await model.init();
  const app = express();
  app.use(express.json());
  app.use("/api/orders", orderRoutes);
  app.use((err, req, res, next) => res.status(err.statusCode || 500).json({
    message: err.message, code: err.code,
  }));
  await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = "http://127.0.0.1:" + server.address().port;
}, { timeout: 600000 });

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

beforeEach(async () => {
  providerResults = new Map();
  providerCalls = [];
  for (const model of models) await model.deleteMany({});
  product = await Product.create({ name: "Online Test Phone", brand: "Samsung", model: "Test",
    sellingPrice: 150000, costPrice: 100000, stock: 10 });
  parent = await member("Parent");
  seller = await member("Seller", parent._id);
  buyer = await member("Buyer", seller._id);
  adminId = new mongoose.Types.ObjectId();
  await Referral.create({ referrer: parent._id, referred: seller._id });
  await Referral.create({ referrer: seller._id, referred: buyer._id });
  await Settings.create({ key: "platform", directCommissionRate: 15, referralOverrideRate: 5 });
});

async function member(name, referredBy = null) {
  return User.create({ name, email: name.toLowerCase() + "@test.invalid", phone: "08012345678",
    passwordHash: "test-password", referralCode: name, referredBy });
}

async function request(method, path, body, userId = buyer._id) {
  const headers = { "Content-Type": "application/json" };
  if (userId) headers.Authorization = "Bearer " + jwt.sign({ id: String(userId) }, process.env.JWT_SECRET);
  const response = await fetch(baseUrl + path, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

async function online({ items, userId } = {}) {
  const response = await request("POST", "/api/orders", {
    items: items || [{ productId: String(product._id), quantity: 2 }],
  }, userId || buyer._id);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const data = response.body.data;
  assert.equal(typeof data.paymentReference, "string");
  assert.ok(data.paymentReference.length > 10);
  assert.equal(data.currency, "NGN");
  return { id: data.orderId, reference: data.paymentReference, total: data.totalAmount };
}

function successful(order, transactionId = "10001", overrides = {}) {
  const result = { verified: true, transactionId: String(transactionId), amount: order.total,
    currency: "NGN", reference: order.reference, raw: {}, ...overrides };
  providerResults.set(String(transactionId), result);
  return result;
}

function verify(order, transactionId = "10001", userId = buyer._id) {
  return request("POST", "/api/orders/verify-payment", {
    orderId: order.id, transactionId,
  }, userId);
}

async function stock(id = product._id) { return (await Product.findById(id)).stock; }
function receipt(transactionId = "10001") { return PaymentReceipt.findById("flutterwave:" + transactionId); }

async function expectPending(order) {
  const saved = await Order.findById(order.id);
  assert.equal(saved.status, "pending_payment");
  assert.equal(saved.payment.verified, false);
  assert.equal(await stock(), 10);
  assert.equal(await Commission.countDocuments(), 0);
}

async function expectReview(order, transactionId = "10001", reason) {
  const saved = await Order.findById(order.id);
  assert.equal(saved.status, "payment_review");
  assert.equal(saved.payment.verified, true);
  assert.equal(saved.payment.resolutionRequired, true);
  const paid = await receipt(transactionId);
  assert.ok(paid, "Successful external payment must survive fulfillment failure");
  assert.equal(String(paid.order), order.id);
  assert.equal(paid.status, "review");
  assert.equal(paid.resolutionRequired, true);
  if (reason) assert.equal(paid.resolutionReason, reason);
  return { saved, paid };
}

test("checkout issues a server-owned NGN reference without reserving inventory", async () => {
  const order = await online();
  const saved = await Order.findById(order.id);
  assert.ok(saved.payment.expectedReferences.includes(order.reference));
  assert.equal(saved.payment.currency, "NGN");
  assert.equal(order.total, 300000);
  assert.equal(await stock(), 10);
  assert.equal(await PaymentReceipt.countDocuments(), 0);
  assert.equal(providerCalls.length, 0);
});

test("retry attempts issue distinct references and still accept an older successful callback", async () => {
  const order = await online();
  const response = await request("POST", "/api/orders/" + order.id + "/payment-attempt", {});
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.notEqual(response.body.data.paymentReference, order.reference);
  assert.equal(response.body.data.totalAmount, order.total);
  assert.equal(response.body.data.currency, "NGN");
  const saved = await Order.findById(order.id);
  assert.ok(saved.payment.expectedReferences.includes(order.reference));
  assert.ok(saved.payment.expectedReferences.includes(response.body.data.paymentReference));
  successful(order);
  assert.equal((await verify(order)).status, 200);
  assert.equal(await stock(), 8);
  const retryPaid = await request("POST", "/api/orders/" + order.id + "/payment-attempt", {});
  assert.ok([400, 409].includes(retryPaid.status));
});

test("payment-attempt endpoint enforces ownership and migrates a legacy pending order lazily", async () => {
  const order = await online();
  const forbidden = await request("POST", "/api/orders/" + order.id + "/payment-attempt", {}, parent._id);
  assert.equal(forbidden.status, 403);
  await Order.updateOne({ _id: order.id }, { $unset: { "payment.expectedReferences": 1, "payment.currency": 1 } });
  const response = await request("POST", "/api/orders/" + order.id + "/payment-attempt", {});
  assert.equal(response.status, 200, JSON.stringify(response.body));
  successful({ ...order, reference: response.body.data.paymentReference });
  assert.equal((await verify(order)).status, 200);
  assert.equal(await stock(), 8);
});

test("online fulfillment preserves gross-profit commissions and one referral override", async () => {
  const order = await online();
  await Product.updateOne({ _id: product._id }, { sellingPrice: 190000, costPrice: 140000 });
  successful(order);
  const response = await verify(order);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.status, "paid");
  const rows = await Commission.find({ order: order.id }).sort({ type: 1 });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].grossProfitSnapshot, 100000);
  assert.equal(rows[0].commissionAmount, 15000);
  assert.equal(String(rows[0].beneficiary), String(seller._id));
  assert.equal(rows[1].commissionAmount, 5000);
  assert.equal(String(rows[1].beneficiary), String(parent._id));
  const paid = await receipt();
  assert.equal(paid.status, "fulfilled");
  assert.equal(paid.resolutionRequired, false);
  assert.equal((await Order.findById(order.id)).payment.transactionId, "10001");
  assert.equal(await stock(), 8);
});

test("product commission overrides are retained for online payments", async () => {
  await Product.updateOne({ _id: product._id }, { commissionRateOverride: 20 });
  const order = await online();
  successful(order);
  assert.equal((await verify(order)).status, 200);
  assert.equal((await Commission.findOne({ order: order.id, type: "direct" })).commissionAmount, 20000);
  assert.equal((await Commission.findOne({ order: order.id, type: "override" })).commissionAmount, 5000);
});

test("online payments without soldBy never generate commissions", async () => {
  const order = await online({ userId: parent._id });
  successful(order);
  assert.equal((await verify(order, "10001", parent._id)).status, 200);
  assert.equal(await Commission.countDocuments(), 0);
  assert.equal(await stock(), 8);
});

test("provider failure leaves pending orders and inventory untouched", async () => {
  const order = await online();
  providerResults.set("10001", { verified: false, raw: { status: "error" } });
  assert.equal((await verify(order)).status, 400);
  await expectPending(order);
  assert.equal(await PaymentReceipt.countDocuments(), 0);
});

for (const mismatch of [
  { name: "exact amount", patch: { amount: 300000.01 } },
  { name: "currency", patch: { currency: "USD" } },
]) {
  test(mismatch.name + " mismatch records successful payment for review without fulfillment", async () => {
    const order = await online();
    successful(order, "10001", mismatch.patch);
    const response = await verify(order);
    assert.equal(response.status, 400, JSON.stringify(response.body));
    const { paid } = await expectReview(order);
    assert.equal(paid.amount, mismatch.patch.amount || order.total);
    assert.equal(paid.currency, mismatch.patch.currency || "NGN");
    assert.equal(await stock(), 10);
    assert.equal(await Commission.countDocuments(), 0);
  });
}

test("provider transaction identity must match the requested numeric transaction", async () => {
  const order = await online();
  successful(order, "10001", { transactionId: "10002" });
  assert.equal((await verify(order)).status, 502);
  await expectPending(order);
  assert.equal(await PaymentReceipt.countDocuments(), 0);
});

test("invalid transaction IDs and unauthorized requests never reach Flutterwave", async () => {
  const order = await online();
  for (const transactionId of ["../secrets", "https://example.invalid", -1, 1.5, true, null, ""]) {
    assert.equal((await verify(order, transactionId)).status, 400);
  }
  assert.equal((await verify(order, "10001", parent._id)).status, 403);
  assert.equal(providerCalls.length, 0);
  await expectPending(order);
});

test("unknown payment reference is retained as an unassigned receipt and cannot pay an order", async () => {
  const order = await online();
  successful(order, "10001", { reference: "UNKNOWN-PAYMENT-REFERENCE" });
  assert.equal((await verify(order)).status, 400);
  await expectPending(order);
  const paid = await receipt();
  assert.ok(paid);
  assert.equal(paid.order, null);
  assert.equal(paid.resolutionRequired, true);
});

test("another order's reference cannot pay the submitted order", async () => {
  const first = await online();
  const second = await online();
  successful(first);
  const response = await verify(second);
  assert.equal(response.status, 400, JSON.stringify(response.body));
  await expectPending(second);
  const paid = await receipt();
  assert.equal(String(paid.order), first.id);
  assert.equal(paid.resolutionRequired, true);
});

test("concurrent verification of one payment deducts stock and commissions exactly once", { timeout: 30000 }, async () => {
  const order = await online();
  const result = successful(order);
  let releaseProvider;
  const providerGate = new Promise(resolve => { releaseProvider = resolve; });
  let waiting = 0;
  providerResults.set("10001", async () => {
    if (++waiting === 6) releaseProvider();
    await providerGate;
    return result;
  });
  const pending = Array.from({ length: 6 }, () => verify(order));
  // Every provider response waits for all six requests to reach the provider.
  // Database transactions must serialize the overlapping fulfillment attempts.
  const responses = await Promise.all(pending);
  for (const response of responses) assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(await stock(), 8);
  assert.equal(await PaymentReceipt.countDocuments(), 1);
  assert.equal(await Commission.countDocuments({ order: order.id }), 2);
  const calls = providerCalls.length;
  assert.equal((await verify(order)).status, 200);
  assert.equal(providerCalls.length, calls, "Completed receipt replay should avoid provider calls");
  assert.equal(await stock(), 8);
});

test("one verified transaction cannot pay a second equal-value order", async () => {
  const first = await online();
  const second = await online();
  successful(first);
  assert.equal((await verify(first)).status, 200);
  const response = await verify(second);
  assert.equal(response.status, 409, JSON.stringify(response.body));
  assert.equal(await stock(), 8);
  assert.equal((await Order.findById(second.id)).status, "pending_payment");
  assert.equal(await PaymentReceipt.countDocuments(), 1);
  assert.equal(await Commission.countDocuments(), 2);
});

test("numeric and string transaction IDs share one canonical receipt and replay", async () => {
  const order = await online();
  successful(order);
  assert.equal((await verify(order, 10001)).status, 200);
  assert.equal((await verify(order, "10001")).status, 200);
  assert.equal(providerCalls.length, 1);
  assert.equal(await PaymentReceipt.countDocuments(), 1);
  assert.equal((await receipt()).transactionId, "10001");
  assert.equal(await stock(), 8);
  assert.equal(await Commission.countDocuments(), 2);
});

test("concurrent distinct payments for one order retain the excess payment for admin review", async () => {
  const order = await online();
  const nextAttempt = await request("POST", "/api/orders/" + order.id + "/payment-attempt", {});
  assert.equal(nextAttempt.status, 200);
  successful(order, "10001");
  successful({ ...order, reference: nextAttempt.body.data.paymentReference }, "10002");
  const responses = await Promise.all([verify(order, "10001"), verify(order, "10002")]);
  for (const response of responses) assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(await stock(), 8);
  assert.equal(await Commission.countDocuments(), 2);
  assert.equal(await PaymentReceipt.countDocuments(), 2);
  assert.equal(await PaymentReceipt.countDocuments({ status: "fulfilled" }), 1);
  assert.equal(await PaymentReceipt.countDocuments({ status: "review", resolutionReason: "duplicate_payment" }), 1);
});

test("stock unavailable after successful payment retains a durable admin-resolution record", async () => {
  const order = await online();
  await Product.updateOne({ _id: product._id }, { stock: 1 });
  successful(order);
  const response = await verify(order);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.status, "payment_review");
  assert.equal(response.body.data.paymentReceived, true);
  assert.equal(response.body.data.requiresResolution, true);
  await expectReview(order, "10001", "stock_unavailable");
  assert.equal(await stock(), 1);
  assert.equal(await Commission.countDocuments(), 0);
  await Product.updateOne({ _id: product._id }, { stock: 10 });
  const calls = providerCalls.length;
  assert.equal((await verify(order)).status, 200);
  assert.equal(providerCalls.length, calls);
  assert.equal(await stock(), 10, "Stock review must not auto-fulfill after a restock");
  assert.equal(await Commission.countDocuments(), 0);
});

test("online and in-store sales competing for the final unit cannot oversell", async () => {
  await Product.updateOne({ _id: product._id }, { stock: 1 });
  const order = await online({ items: [{ productId: String(product._id), quantity: 1 }] });
  successful(order);
  const results = await Promise.allSettled([
    verify(order),
    recordInStoreSale({ idempotencyKey: "mixed-final-unit", customerName: "Walk In",
      customerPhone: "08012345678", productId: String(product._id), quantity: 1,
      referrerId: String(seller._id), paymentMethod: "cash" }, adminId),
  ]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[0].value.status, 200, JSON.stringify(results[0].value.body));
  if (results[1].status === "rejected") assert.equal(results[1].reason.statusCode, 409);
  assert.equal(await stock(), 0);
  assert.equal(await Order.countDocuments({ status: "paid" }), 1);
  assert.equal(await Commission.countDocuments(), 2);
  const paid = await receipt();
  assert.equal(String(paid.order), order.id);
  assert.equal(paid.status, results[1].status === "fulfilled" ? "review" : "fulfilled");
});

test("commission failure rolls back fulfillment while preserving payment and allowing a safe retry", async () => {
  const order = await online();
  successful(order);
  const originalSave = Commission.prototype.save;
  Commission.prototype.save = function (...args) {
    if (this.type === "override") throw new Error("Injected online override failure");
    return originalSave.apply(this, args);
  };
  let response;
  try { response = await verify(order); }
  finally { Commission.prototype.save = originalSave; }
  assert.ok([500, 503].includes(response.status), JSON.stringify(response.body));
  await expectReview(order, "10001", "processing_error");
  assert.equal(await stock(), 10);
  assert.equal(await Commission.countDocuments(), 0);
  const calls = providerCalls.length;
  assert.equal((await verify(order)).status, 200);
  assert.equal(providerCalls.length, calls);
  assert.equal(await stock(), 8);
  assert.equal(await Commission.countDocuments(), 2);
  assert.equal((await receipt()).status, "fulfilled");
});

test("unavailable later item rolls back earlier deductions in a multi-item paid order", async () => {
  const other = await Product.create({ name: "Other Phone", brand: "Itel", model: "Other",
    sellingPrice: 50000, costPrice: 40000, stock: 1 });
  const order = await online({ items: [
    { productId: String(product._id), quantity: 1 },
    { productId: String(other._id), quantity: 1 },
  ] });
  await Product.updateOne({ _id: other._id }, { stock: 0 });
  successful(order);
  assert.equal((await verify(order)).status, 200);
  await expectReview(order, "10001", "stock_unavailable");
  assert.equal(await stock(), 10);
  assert.equal(await stock(other._id), 0);
  assert.equal(await Commission.countDocuments(), 0);
});

test("duplicate product lines are aggregated for stock and the full profit commission", async () => {
  const order = await online({ items: [
    { productId: String(product._id), quantity: 1 },
    { productId: String(product._id), quantity: 2 },
  ] });
  const saved = await Order.findById(order.id);
  assert.equal(saved.items.length, 1);
  assert.equal(saved.items[0].quantity, 3);
  assert.equal(order.total, 450000);
  successful(order);
  assert.equal((await verify(order)).status, 200);
  assert.equal(await stock(), 7);
  assert.equal((await Commission.findOne({ order: order.id, type: "direct" })).commissionAmount, 22500);
  assert.equal((await Commission.findOne({ order: order.id, type: "override" })).commissionAmount, 7500);
});

test("checkout rejects quantities which could increase inventory or create fractional commissions", async () => {
  for (const quantity of [0, -1, 1.5, true, null, "not-a-number", Number.MAX_SAFE_INTEGER + 1]) {
    const response = await request("POST", "/api/orders", {
      items: [{ productId: String(product._id), quantity }],
    });
    assert.equal(response.status, 400, JSON.stringify(response.body));
  }
  assert.equal(await stock(), 10);
  assert.equal(await Order.countDocuments(), 0);
});

for (const status of ["processing", "delivered", "refunded", "cancelled"]) {
  test("fulfilled payment replay preserves later " + status + " status", async () => {
    const order = await online();
    successful(order);
    assert.equal((await verify(order)).status, 200);
    await Order.updateOne({ _id: order.id }, { status });
    const calls = providerCalls.length;
    const response = await verify(order);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.data.status, status);
    assert.equal((await Order.findById(order.id)).status, status);
    assert.equal(providerCalls.length, calls);
    assert.equal(await stock(), 8);
    assert.equal(await Commission.countDocuments(), 2);
  });
}

test("payment arriving after pending-order cancellation is recorded for review without fulfilling", async () => {
  const order = await online();
  const cancelled = await request("PATCH", "/api/orders/" + order.id + "/cancel", {});
  assert.equal(cancelled.status, 200);
  successful(order);
  const response = await verify(order);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  await expectReview(order);
  assert.equal(await stock(), 10);
  assert.equal(await Commission.countDocuments(), 0);
});
