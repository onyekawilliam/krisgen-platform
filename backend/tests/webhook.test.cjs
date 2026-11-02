const { before, after, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Referral = require("../models/Referral");
const Commission = require("../models/Commission");
const Settings = require("../models/Settings");
const PaymentReceipt = require("../models/PaymentReceipt");
const paymentService = require("../services/paymentService");
const errorHandler = require("../middlewares/errorHandler");

// The provider boundary is replaced before the routes load, exactly as in the
// other payment tests: nothing here ever calls Flutterwave or reads .env.
let providerResults;
let providerCalls;
paymentService.verifyFlutterwaveTransaction = async transactionId => {
  const key = String(transactionId);
  providerCalls.push(key);
  assert.ok(providerResults.has(key), "Unexpected provider verification: " + key);
  const result = providerResults.get(key);
  if (result instanceof Error) throw result;
  return result;
};
process.env.JWT_SECRET = "isolated-webhook-regression-secret";
process.env.FLW_SECRET_HASH = "test-webhook-secret-hash";
const webhookRoutes = require("../routes/webhookRoutes");
const orderRoutes = require("../routes/orderRoutes");
const jwt = require("jsonwebtoken");

let replSet;
let server;
let baseUrl;
let product;
let seller;
let buyer;
const models = [Order, Product, User, Referral, Commission, Settings, PaymentReceipt];
const hashHeader = { "verif-hash": "test-webhook-secret-hash" };
const REFERENCE = "KRG-PAY-webhook-test-reference";

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  for (const model of models) await model.init();
  const app = express();
  app.use(express.json());
  app.use("/api/webhooks", webhookRoutes);
  app.use("/api/orders", orderRoutes);
  app.use(errorHandler);
  await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = "http://127.0.0.1:" + server.address().port;
}, { timeout: 600000 });

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

async function member(name, referredBy = null) {
  return User.create({ name, email: name.toLowerCase() + "@test.invalid", phone: "08012345678",
    passwordHash: "test-password", referralCode: name, referredBy });
}

let order;
beforeEach(async () => {
  providerResults = new Map();
  providerCalls = [];
  for (const model of models) await model.deleteMany({});
  product = await Product.create({ name: "Webhook Phone", brand: "Samsung", model: "W1",
    sellingPrice: 150000, costPrice: 100000, stock: 10 });
  seller = await member("Seller");
  buyer = await member("Buyer", seller._id);
  await Referral.create({ referrer: seller._id, referred: buyer._id });
  await Settings.create({ key: "platform", directCommissionRate: 15, referralOverrideRate: 5 });
  order = await Order.create({
    orderNumber: "KRG-WEBHOOK-1", buyer: buyer._id, soldBy: seller._id, status: "pending_payment",
    items: [{ product: product._id, name: product.name, quantity: 2, sellingPriceSnapshot: 150000, costPriceSnapshot: 100000 }],
    totalAmount: 300000,
    payment: { provider: "flutterwave", currency: "NGN", expectedReferences: [REFERENCE] },
  });
});

function provider(transactionId, overrides = {}) {
  const result = { verified: true, transactionId: String(transactionId), amount: 300000, currency: "NGN",
    reference: REFERENCE, raw: {}, ...overrides };
  providerResults.set(String(transactionId), result);
  return result;
}

function charge(transactionId, overrides = {}) {
  return { event: "charge.completed", data: { id: Number(transactionId), status: "successful", tx_ref: REFERENCE,
    amount: 300000, currency: "NGN", ...overrides } };
}

async function post(body, headers = hashHeader) {
  const response = await fetch(baseUrl + "/api/webhooks/flutterwave", {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function stock() { return (await Product.findById(product._id)).stock; }

test("a webhook with a missing or wrong hash is refused and never reaches Flutterwave", async () => {
  provider(2001);
  for (const headers of [{}, { "verif-hash": "wrong" }, { "verif-hash": "test-webhook-secret-hash-extra" }, { "verif-hash": "" }]) {
    assert.equal((await post(charge(2001), headers)).status, 401, JSON.stringify(headers));
  }
  assert.deepEqual(providerCalls, []);
  assert.equal((await Order.findById(order._id)).status, "pending_payment");
  assert.equal(await stock(), 10);
});

test("a webhook is refused outright when no secret hash is configured", async () => {
  const saved = process.env.FLW_SECRET_HASH;
  delete process.env.FLW_SECRET_HASH;
  try {
    assert.equal((await post(charge(2002))).status, 503);
    assert.equal((await post(charge(2002), { "verif-hash": "undefined" })).status, 503);
  } finally {
    process.env.FLW_SECRET_HASH = saved;
  }
  assert.deepEqual(providerCalls, []);
});

test("a successful charge fulfils the order with no buyer session, once, with commissions", async () => {
  provider(2003);
  const first = await post(charge(2003));
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.status, "paid");
  const saved = await Order.findById(order._id);
  assert.equal(saved.status, "paid");
  assert.equal(saved.payment.verified, true);
  assert.equal(saved.payment.transactionId, "2003");
  assert.equal(await stock(), 8);
  assert.equal(await Commission.countDocuments(), 1);
  assert.equal((await PaymentReceipt.findById("flutterwave:2003")).status, "fulfilled");

  // Flutterwave retries and duplicates must change nothing.
  assert.equal((await post(charge(2003))).status, 200);
  assert.equal((await post(charge(2003))).status, 200);
  assert.equal(await stock(), 8);
  assert.equal(await Commission.countDocuments(), 1);
});

test("the webhook racing the buyer's own verify call fulfils the order exactly once", async () => {
  provider(2004);
  const token = jwt.sign({ id: String(buyer._id) }, process.env.JWT_SECRET);
  const client = () => fetch(baseUrl + "/api/orders/verify-payment", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ orderId: String(order._id), transactionId: "2004" }),
  }).then(r => r.status);
  const results = await Promise.all([post(charge(2004)), client(), post(charge(2004)), client()]);
  assert.ok(results.every(r => (r.status ?? r) === 200), JSON.stringify(results.map(r => r.status ?? r)));
  assert.equal((await Order.findById(order._id)).status, "paid");
  assert.equal(await stock(), 8);
  assert.equal(await Commission.countDocuments(), 1);
});

test("amount, currency and reference come from Flutterwave, never from the webhook body", async () => {
  provider(2005, { amount: 1 }); // Flutterwave says the buyer only paid 1 naira
  const lie = charge(2005, { amount: 300000, currency: "NGN", tx_ref: REFERENCE });
  const response = await post(lie);
  assert.equal(response.status, 200);
  const saved = await Order.findById(order._id);
  assert.equal(saved.status, "payment_review");
  assert.equal(await stock(), 10);
  assert.equal(await Commission.countDocuments(), 0);
  assert.equal((await PaymentReceipt.findById("flutterwave:2005")).resolutionReason, "amount_mismatch");
});

test("a payment for a reference we never issued is kept for admin review and answered 200", async () => {
  provider(2006, { reference: "SOMEONE-ELSES-REFERENCE" });
  const response = await post(charge(2006));
  assert.equal(response.status, 200);
  const receipt = await PaymentReceipt.findById("flutterwave:2006");
  assert.equal(receipt.order, null);
  assert.equal(receipt.resolutionRequired, true);
  assert.equal((await Order.findById(order._id)).status, "pending_payment");
  assert.equal(await stock(), 10);
});

test("a payment that arrives after the order was cancelled is kept for review, not fulfilled", async () => {
  await Order.updateOne({ _id: order._id }, { status: "cancelled" });
  provider(2007);
  assert.equal((await post(charge(2007))).status, 200);
  // The money is real, so the order is flagged for an admin instead of staying "cancelled".
  assert.equal((await Order.findById(order._id)).status, "payment_review");
  assert.equal(await stock(), 10);
  assert.equal(await Commission.countDocuments(), 0);
  assert.equal((await PaymentReceipt.findById("flutterwave:2007")).resolutionRequired, true);
});

test("events that are not a successful charge are acknowledged and ignored without asking Flutterwave", async () => {
  for (const body of [
    { event: "transfer.completed", data: { id: 1, status: "successful" } },
    charge(2008, { status: "failed" }),
    { event: "charge.completed", data: {} },
    { event: "charge.completed" },
    {},
  ]) {
    const response = await post(body);
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(response.body.handled, false);
  }
  assert.deepEqual(providerCalls, []);
});

test("when Flutterwave says the transaction did not succeed, nothing is recorded and no retry is requested", async () => {
  providerResults.set("2009", { verified: false, raw: {} });
  const response = await post(charge(2009));
  assert.equal(response.status, 200);
  assert.equal(response.body.handled, false);
  assert.equal(await PaymentReceipt.countDocuments(), 0);
  assert.equal((await Order.findById(order._id)).status, "pending_payment");
});

test("a Flutterwave outage answers with a server error so the event is delivered again, then succeeds", async () => {
  providerResults.set("2010", Object.assign(new Error("down"), { statusCode: 502 }));
  const failed = await post(charge(2010));
  assert.equal(failed.status, 502);
  assert.equal((await Order.findById(order._id)).status, "pending_payment");
  assert.equal(await stock(), 10);

  provider(2010);
  assert.equal((await post(charge(2010))).status, 200);
  assert.equal((await Order.findById(order._id)).status, "paid");
  assert.equal(await stock(), 8);
});

test("a payment taken for an item that sold out is retained for review and the webhook is not retried", async () => {
  await Product.updateOne({ _id: product._id }, { stock: 1 });
  provider(2011);
  const response = await post(charge(2011));
  assert.equal(response.status, 200);
  assert.equal((await Order.findById(order._id)).status, "payment_review");
  assert.equal((await PaymentReceipt.findById("flutterwave:2011")).resolutionReason, "stock_unavailable");
  assert.equal(await Commission.countDocuments(), 0);
});
