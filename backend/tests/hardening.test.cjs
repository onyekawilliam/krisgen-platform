const { before, after, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Commission = require("../models/Commission");
const Referral = require("../models/Referral");
const Settings = require("../models/Settings");
const Withdrawal = require("../models/Withdrawal");
const { generateCommissionsForOrder } = require("../services/commissionService");
const originCheck = require("../middlewares/originCheck");
const errorHandler = require("../middlewares/errorHandler");

process.env.JWT_SECRET = "isolated-hardening-regression-secret";

let replSet;
let server;
let baseUrl;
let admin;
let alice;
let product;
const bank = { bankName: "Test Bank", accountName: "Alice A", accountNumber: "0123456789" };
const models = [User, Product, Order, Commission, Referral, Settings, Withdrawal];

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  const app = express();
  app.use(originCheck("https://shop.example.com/"));
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", require("../routes/authRoutes"));
  app.use("/api/products", require("../routes/productRoutes"));
  app.use("/api/orders", require("../routes/orderRoutes"));
  app.use("/api/withdrawals", require("../routes/withdrawalRoutes"));
  app.use("/api/commissions", require("../routes/commissionRoutes"));
  app.use("/api/admin", require("../routes/adminRoutes"));
  app.use("/api/store", require("../routes/storeRoutes"));
  app.use(errorHandler);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  await Promise.all(models.map(model => model.init()));
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await replSet?.stop();
});

async function mkUser(name, extra = {}) {
  return User.create({
    name, email: `${name}@example.com`, phone: "08012345678", passwordHash: "password123",
    referralCode: `${name.toUpperCase()}CODE`, ...extra,
  });
}

beforeEach(async () => {
  await Promise.all(models.map(model => model.deleteMany({})));
  admin = await mkUser("admin", { role: "admin" });
  alice = await mkUser("alice");
  product = await Product.create({
    name: "Phone", brand: "Tecno", model: "T1", costPrice: 100000, sellingPrice: 150000, stock: 10,
  });
});

async function request(method, path, body, user, headers = {}) {
  const token = user ? jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET) : null;
  const response = await fetch(baseUrl + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function approvedCommission(beneficiary, amount, status = "approved", key = String(Math.random())) {
  const order = await Order.create({
    orderNumber: `T-${key}`, buyer: admin._id, totalAmount: 150000, status: "paid",
    items: [{ product: product._id, name: "Phone", quantity: 1, sellingPriceSnapshot: 150000, costPriceSnapshot: 100000 }],
  });
  return Commission.create({
    order: order._id, product: product._id, beneficiary: beneficiary._id, type: "direct", quantity: 1,
    sellingPriceSnapshot: 150000, costPriceSnapshot: 100000, grossProfitSnapshot: 50000,
    commissionRate: 15, commissionAmount: amount, status, idempotencyKey: key,
  });
}

// ----- withdrawals -----

test("concurrent withdrawals cannot spend the same balance twice", async () => {
  await approvedCommission(alice, 1000);
  const results = await Promise.all(Array.from({ length: 6 }, () =>
    request("POST", "/api/withdrawals", { amount: 1000, bankDetails: bank }, alice)));
  assert.equal(results.filter(r => r.status === 201).length, 1, results.map(r => r.status).join());
  assert.equal(results.filter(r => r.status === 400).length, 5);
  assert.equal(await Withdrawal.countDocuments({ user: alice._id }), 1);
});

test("withdrawal requests reject malformed amounts and bank details", async () => {
  await approvedCommission(alice, 5000);
  for (const amount of [0, -5, "1000", null, NaN, Infinity, 10.123, [1000], { $gt: 0 }]) {
    const response = await request("POST", "/api/withdrawals", { amount, bankDetails: bank }, alice);
    assert.equal(response.status, 400, "amount=" + JSON.stringify(amount));
  }
  for (const bankDetails of [undefined, null, [], "x", { ...bank, accountNumber: "123" },
    { ...bank, accountNumber: { $ne: null } }, { ...bank, bankName: "" }, { ...bank, accountName: 5 }]) {
    const response = await request("POST", "/api/withdrawals", { amount: 1000, bankDetails }, alice);
    assert.equal(response.status, 400, "bank=" + JSON.stringify(bankDetails));
  }
  assert.equal(await Withdrawal.countDocuments(), 0);
});

test("withdrawals only move forward and a paid one can never be rejected", async () => {
  await approvedCommission(alice, 1000);
  const created = await request("POST", "/api/withdrawals", { amount: 1000, bankDetails: bank }, alice);
  const path = `/api/withdrawals/admin/${created.body.data._id}`;
  assert.equal((await request("PATCH", path, { status: "paid" }, admin)).status, 409); // pending -> paid
  assert.equal((await request("PATCH", path, { status: "approved" }, admin)).status, 200);
  assert.equal((await request("PATCH", path, { status: "paid" }, admin)).status, 200);
  for (const status of ["rejected", "pending", "approved"]) {
    assert.equal((await request("PATCH", path, { status }, admin)).status, 409, status);
  }
  const mine = await request("GET", "/api/withdrawals/mine", undefined, alice);
  assert.equal(mine.body.availableBalance, 0); // the paid withdrawal still counts against the balance
});

test("a rejected withdrawal frees the balance for a new request", async () => {
  await approvedCommission(alice, 1000);
  const first = await request("POST", "/api/withdrawals", { amount: 1000, bankDetails: bank }, alice);
  assert.equal((await request("PATCH", `/api/withdrawals/admin/${first.body.data._id}`, { status: "rejected" }, admin)).status, 200);
  assert.equal((await request("POST", "/api/withdrawals", { amount: 1000, bankDetails: bank }, alice)).status, 201);
});

// ----- commissions -----

test("earnings summary leaves out cancelled and reversed commissions and separates paid out money", async () => {
  await approvedCommission(alice, 1000, "approved", "a");
  await approvedCommission(alice, 500, "pending", "b");
  await approvedCommission(alice, 700, "cancelled", "c");
  await approvedCommission(alice, 300, "reversed", "d");
  let summary = (await request("GET", "/api/commissions/mine", undefined, alice)).body.summary;
  assert.deepEqual(summary, { total: 1500, pending: 500, approved: 1000, paid: 0, available: 1000 });

  const created = await request("POST", "/api/withdrawals", { amount: 400, bankDetails: bank }, alice);
  summary = (await request("GET", "/api/commissions/mine", undefined, alice)).body.summary;
  assert.equal(summary.available, 600);
  assert.equal(summary.total, 1500);

  const path = `/api/withdrawals/admin/${created.body.data._id}`;
  await request("PATCH", path, { status: "approved" }, admin);
  await request("PATCH", path, { status: "paid" }, admin);
  summary = (await request("GET", "/api/commissions/mine", undefined, alice)).body.summary;
  assert.deepEqual(summary, { total: 1500, pending: 500, approved: 600, paid: 400, available: 600 });
});

test("commission status cannot be resurrected or settled by hand", async () => {
  const cancelled = await approvedCommission(alice, 500, "cancelled", "x");
  const approved = await approvedCommission(alice, 500, "approved", "y");
  const pending = await approvedCommission(alice, 500, "pending", "z");
  const path = commission => `/api/commissions/admin/${commission._id}/status`;
  for (const status of ["approved", "pending", "paid", "reversed"]) {
    assert.equal((await request("PATCH", path(cancelled), { status }, admin)).status, 409, status);
  }
  assert.equal((await request("PATCH", path(approved), { status: "paid" }, admin)).status, 409);
  assert.equal((await request("PATCH", path(pending), { status: "approved" }, admin)).status, 200);
  assert.equal((await request("PATCH", path(approved), { status: "reversed" }, admin)).status, 200);
  assert.equal((await request("PATCH", path(approved), { status: "approved" }, admin)).status, 409);
  assert.equal((await Commission.findById(cancelled._id)).status, "cancelled");
});

test("direct and override rates together cannot exceed all of the profit", async () => {
  await Settings.create({ directCommissionRate: 15, referralOverrideRate: 5 });
  const path = "/api/commissions/admin/settings";
  assert.equal((await request("PATCH", path, { directCommissionRate: 96 }, admin)).status, 400);
  assert.equal((await request("PATCH", path, { referralOverrideRate: 90 }, admin)).status, 400);
  assert.equal((await request("PATCH", path, { directCommissionRate: 95 }, admin)).status, 200);
  const stored = await Settings.getSettings();
  assert.equal(stored.directCommissionRate, 95);
  assert.equal(stored.referralOverrideRate, 5);
});

test("a sale with no profit creates no commission and an override never exceeds the profit", async () => {
  await Settings.create({ directCommissionRate: 90, referralOverrideRate: 50 }); // legacy data, past the new limit
  const referrer = await mkUser("referrer");
  await Referral.create({ referrer: referrer._id, referred: alice._id });
  const item = (selling, cost) => ({ product: product._id, name: "Phone", quantity: 1,
    sellingPriceSnapshot: selling, costPriceSnapshot: cost });
  const order = items => new Order({ orderNumber: "N" + Math.random(), buyer: admin._id, soldBy: alice._id,
    totalAmount: 1, status: "paid", items });

  assert.equal((await generateCommissionsForOrder(order([item(100, 100)]))).length, 0);
  assert.equal((await generateCommissionsForOrder(order([item(100, 150)]))).length, 0);

  const created = await generateCommissionsForOrder(order([item(1000, 0)]));
  const total = created.reduce((sum, c) => sum + c.commissionAmount, 0);
  assert.equal(created.length, 2);
  assert.ok(total <= 1000, `payouts ${total} exceed profit`);
});

// ----- products -----

test("products reject negative cost, non-numeric prices and a selling price at or below cost", async () => {
  const body = overrides => ({ name: "X", brand: "Tecno", model: "X", costPrice: 100, sellingPrice: 200, ...overrides });
  for (const bad of [{ costPrice: -5 }, { sellingPrice: 0 }, { costPrice: 200 }, { costPrice: 300 },
    { costPrice: "100" }, { sellingPrice: null }, { sellingPrice: Infinity }]) {
    assert.equal((await request("POST", "/api/products/admin", body(bad), admin)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await request("POST", "/api/products/admin", body({}), admin)).status, 201);
  const patch = overrides => request("PATCH", `/api/products/admin/${product._id}`, overrides, admin);
  assert.equal((await patch({ costPrice: -1 })).status, 400);
  assert.equal((await patch({ sellingPrice: 90000 })).status, 400);
  assert.equal((await patch({ stock: 3 })).status, 200);
});

test("a product commission cannot push payouts past the referral override share", async () => {
  await Settings.create({ directCommissionRate: 15, referralOverrideRate: 5 });
  const body = commissionRateOverride => ({ name: "X", brand: "Tecno", model: "X", costPrice: 1, sellingPrice: 2, commissionRateOverride });
  assert.equal((await request("POST", "/api/products/admin", body(96), admin)).status, 400);
  assert.equal((await request("POST", "/api/products/admin", body(95), admin)).status, 201);
});

test("product listing caps the page size and ignores operator-style query values", async () => {
  await Product.insertMany(Array.from({ length: 3 }, (_, i) =>
    ({ name: "P" + i, brand: "Tecno", model: "M" + i, costPrice: 1, sellingPrice: 2, stock: 1 })));
  const big = await request("GET", "/api/products?limit=100000&page=-4");
  assert.equal(big.status, 200);
  assert.equal(big.body.meta.limit, 50);
  assert.equal(big.body.meta.page, 1);
  const operator = await request("GET", "/api/products?brand[$ne]=Tecno&search[$gt]=1&minPrice=abc");
  assert.equal(operator.status, 200);
  assert.ok(operator.body.data.length >= 3);
  assert.equal(operator.body.data.every(p => p.costPrice === undefined), true);
});

test("product search matches part of a name and sorting by price works", async () => {
  await Product.insertMany([
    { name: "Camon Alpha", brand: "Tecno", model: "Alpha", costPrice: 500, sellingPrice: 3000, stock: 1 },
    { name: "Spark Beta", brand: "Tecno", model: "Beta", costPrice: 500, sellingPrice: 1000, stock: 1 },
    { name: "Camon Gamma", brand: "Itel", model: "Gamma", costPrice: 500, sellingPrice: 2000, stock: 1 },
  ]);
  const names = body => body.data.map(p => p.name);
  const asc = await request("GET", "/api/products?sort=price_asc");
  assert.deepEqual(asc.body.data.map(p => p.sellingPrice), [1000, 2000, 3000, 150000]);
  const desc = await request("GET", "/api/products?sort=price_desc");
  assert.deepEqual(desc.body.data.map(p => p.sellingPrice), [150000, 3000, 2000, 1000]);
  assert.equal((await request("GET", "/api/products?sort=nonsense")).status, 200);
  assert.equal((await request("GET", "/api/products?sort[$ne]=x")).status, 200);

  const partial = await request("GET", "/api/products?search=cam&sort=price_asc");
  assert.deepEqual(names(partial.body), ["Camon Gamma", "Camon Alpha"]);
  const byBrand = await request("GET", "/api/products?search=itel");
  assert.deepEqual(names(byBrand.body), ["Camon Gamma"]);
  for (const search of ["(", "[a-", "a.*", "\\"]) {
    const response = await request("GET", "/api/products?search=" + encodeURIComponent(search));
    assert.equal(response.status, 200, search);
    assert.equal(response.body.data.length, 0, "special characters are literal, so " + search + " matches nothing");
  }
});

test("a phone can be hidden from the shop and shown again, by admins only", async () => {
  const adminPath = "/api/products/admin/" + product._id;
  const shown = async () => (await request("GET", "/api/products?limit=50")).body.data.some((p) => String(p._id) === String(product._id));
  assert.equal(await shown(), true);

  assert.equal((await request("DELETE", adminPath, undefined, admin)).status, 200);
  assert.equal(await shown(), false, "customers no longer see it");
  assert.equal((await request("GET", "/api/products/" + product._id)).status, 404, "and its page is gone for them");
  const listed = (await request("GET", "/api/products/admin/all", undefined, admin)).body.data.find((p) => String(p._id) === String(product._id));
  assert.equal(listed.isActive, false, "the admin list still has it, marked inactive");

  assert.equal((await request("PATCH", adminPath, { isActive: true }, admin)).status, 200);
  assert.equal(await shown(), true, "activating it puts it back in the shop");
  assert.equal((await request("GET", "/api/products/" + product._id)).status, 200);

  for (const bad of ["yes", "false", 1, 0, null, [], {}]) {
    assert.equal((await request("PATCH", adminPath, { isActive: bad }, admin)).status, 400, JSON.stringify(bad));
  }
  assert.equal(await shown(), true, "refused changes leave it visible");

  for (const [method, body] of [["DELETE"], ["PATCH", { isActive: false }]]) {
    assert.ok([401, 403].includes((await request(method, adminPath, body, alice)).status), method + " as a customer");
    assert.equal((await request(method, adminPath, body)).status, 401, method + " when logged out");
  }
  assert.equal(await shown(), true);
});

// ----- auth and input handling -----

test("registering with an operator object as the referral code does not pick a referrer", async () => {
  const response = await request("POST", "/api/auth/register", {
    name: "Eve", email: "eve@example.com", phone: "08011112222", password: "password123", refCode: { $ne: null },
  });
  assert.equal(response.status, 201);
  const eve = await User.findOne({ email: "eve@example.com" });
  assert.equal(eve.referredBy, null);
  assert.equal(await Referral.countDocuments(), 0);
});

test("registering with a real referral code records exactly one referral", async () => {
  const response = await request("POST", "/api/auth/register", {
    name: "Bob", email: "BOB@example.com ", phone: "08011112222", password: "password123", refCode: alice.referralCode,
  });
  assert.equal(response.status, 201);
  const bob = await User.findOne({ email: "bob@example.com" });
  assert.equal(String(bob.referredBy), String(alice._id));
  assert.equal(await Referral.countDocuments({ referrer: alice._id }), 1);
});

test("auth endpoints answer malformed bodies with 400 instead of crashing", async () => {
  const bad = [{ email: { a: 1 }, password: "x" }, { email: "a@b.co", password: { a: 1 } }, { email: ["a@b.co"], password: "password123" }];
  for (const body of bad) {
    assert.equal((await request("POST", "/api/auth/login", body)).status, 400, JSON.stringify(body));
  }
  for (const body of [{ name: { a: 1 }, email: "x@y.co", phone: "0801111222", password: "password123" },
    { name: "N", email: "not-an-email", phone: "0801111222", password: "password123" },
    { name: "N", email: "x@y.co", phone: "0801111222", password: "x".repeat(73) }]) {
    assert.equal((await request("POST", "/api/auth/register", body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await request("POST", "/api/auth/forgot-password", { email: { a: 1 } })).status, 200);
  assert.equal((await request("POST", "/api/auth/reset-password", { token: { a: 1 }, newPassword: "password123" })).status, 400);
  assert.equal((await request("PATCH", "/api/auth/me", { name: { a: 1 } }, alice)).status, 400);
});

test("registration accepts ordinary email addresses and rejects malformed ones", async () => {
  const register = email => request("POST", "/api/auth/register",
    { name: "Sam", email, phone: "08011112222", password: "password123" });
  for (const email of ["shopper@test.example", "Susan.Stones+promo@mail.co.ng", "s@s.ss"]) {
    assert.equal((await register(email)).status, 201, email);
  }
  for (const email of ["plain", "a@b", "a b@c.de", "@x.com", "a@.com", "a@@b.co"]) {
    assert.equal((await register(email)).status, 400, email);
  }
});

test("duplicate registration answers 409 even when the check races", async () => {
  const body = { name: "Dup", email: "dup@example.com", phone: "08011112222", password: "password123" };
  const results = await Promise.all(Array.from({ length: 4 }, () => request("POST", "/api/auth/register", body)));
  assert.equal(results.filter(r => r.status === 201).length, 1, results.map(r => r.status).join());
  assert.ok(results.every(r => [201, 409].includes(r.status)));
});

test("admin member search treats the text literally", async () => {
  for (const search of ["(", "[a-", "a.*", "\\"]) {
    const response = await request("GET", `/api/admin/members?search=${encodeURIComponent(search)}`, undefined, admin);
    assert.equal(response.status, 200, search);
  }
  const found = await request("GET", "/api/admin/members?search=alice", undefined, admin);
  assert.equal(found.body.data.length, 1);
  assert.equal((await request("GET", "/api/admin/members?search[$ne]=x", undefined, admin)).status, 200);
});

// ----- shop pickup -----

const pickupItems = () => [{ productId: String(product._id), quantity: 1 }];
const fullAddress = { fullName: "A Buyer", phone: "08011112222", address: "1 St", city: "Ikeja", state: "Lagos" };

test("a customer can choose shop pickup with only a name and phone number", async () => {
  const created = await request("POST", "/api/orders", {
    items: pickupItems(), fulfillment: "pickup", shippingAddress: { fullName: " Ada Obi ", phone: "08011112222" },
  }, alice);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.data.fulfillment, "pickup");
  const order = await Order.findById(created.body.data.orderId);
  assert.equal(order.fulfillment, "pickup");
  assert.equal(order.shippingAddress.fullName, "Ada Obi");
  assert.equal(order.shippingAddress.phone, "08011112222");
  assert.equal(order.shippingAddress.address, undefined, "no street address is stored for a pickup");
  assert.equal(order.status, "pending_payment");
});

test("pickup still needs a real name and phone, and delivery still needs a full address", async () => {
  for (const shippingAddress of [undefined, {}, [], "x", { fullName: "A" }, { phone: "08011112222" },
    { fullName: { $ne: 1 }, phone: "08011112222" }, { fullName: "A", phone: "123" }]) {
    const response = await request("POST", "/api/orders", { items: pickupItems(), fulfillment: "pickup", shippingAddress }, alice);
    assert.equal(response.status, 400, "pickup " + JSON.stringify(shippingAddress));
  }
  const partial = { fullName: "A Buyer", phone: "08011112222" };
  assert.equal((await request("POST", "/api/orders", { items: pickupItems(), fulfillment: "delivery", shippingAddress: partial }, alice)).status, 400);
  assert.equal((await request("POST", "/api/orders", { items: pickupItems(), shippingAddress: partial }, alice)).status, 400);
  assert.equal(await Order.countDocuments(), 0);
});

test("leaving out the choice means delivery, and anything unknown is refused", async () => {
  const plain = await request("POST", "/api/orders", { items: pickupItems(), shippingAddress: fullAddress }, alice);
  assert.equal(plain.status, 201);
  assert.equal((await Order.findById(plain.body.data.orderId)).fulfillment, "delivery");
  for (const fulfillment of ["teleport", "", 5, null, {}, ["pickup"], "PICKUP"]) {
    const response = await request("POST", "/api/orders", { items: pickupItems(), fulfillment, shippingAddress: fullAddress }, alice);
    assert.equal(response.status, 400, JSON.stringify(fulfillment));
  }
});

test("the shop's pickup details are public, editable by an admin only, and can switch pickup off", async () => {
  const defaults = await request("GET", "/api/store/pickup");
  assert.equal(defaults.status, 200);
  assert.deepEqual(defaults.body.data, { enabled: true, address: "", instructions: "" });

  const settingsPath = "/api/commissions/admin/settings";
  const body = { pickupAddress: "  12 Market Road, Lagos  ", pickupInstructions: "Open 9am to 6pm. Bring your order number." };
  assert.ok([401, 403].includes((await request("PATCH", settingsPath, body, alice)).status), "customers cannot edit it");
  assert.equal((await request("PATCH", settingsPath, body)).status, 401);
  assert.equal((await request("PATCH", settingsPath, body, admin)).status, 200);
  const saved = await request("GET", "/api/store/pickup");
  assert.equal(saved.body.data.address, "12 Market Road, Lagos");
  assert.equal(saved.body.data.instructions, "Open 9am to 6pm. Bring your order number.");
  assert.deepEqual(Object.keys(saved.body.data).sort(), ["address", "enabled", "instructions"]);

  assert.equal((await request("PATCH", settingsPath, { pickupEnabled: false }, admin)).status, 200);
  assert.equal((await request("GET", "/api/store/pickup")).body.data.enabled, false);
  const refused = await request("POST", "/api/orders", {
    items: pickupItems(), fulfillment: "pickup", shippingAddress: { fullName: "A", phone: "08011112222" },
  }, alice);
  assert.equal(refused.status, 400);
  assert.match(refused.body.message, /pickup is not available/i);
  assert.equal((await request("POST", "/api/orders", { items: pickupItems(), shippingAddress: fullAddress }, alice)).status, 201, "delivery still works");
  assert.equal((await request("PATCH", settingsPath, { pickupEnabled: true }, admin)).status, 200);
});

test("pickup settings are validated and the commission rates are untouched by them", async () => {
  await Settings.create({ directCommissionRate: 15, referralOverrideRate: 5 });
  const settingsPath = "/api/commissions/admin/settings";
  for (const bad of [{ pickupEnabled: "yes" }, { pickupEnabled: 1 }, { pickupAddress: 5 }, { pickupAddress: { a: 1 } },
    { pickupInstructions: ["x"] }, { pickupAddress: "x".repeat(301) }, { pickupAddress: "ok", somethingElse: 1 }]) {
    assert.equal((await request("PATCH", settingsPath, bad, admin)).status, 400, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal((await request("PATCH", settingsPath, { pickupAddress: "ok", directCommissionRate: 20 }, admin)).status, 200);
  const stored = await Settings.getSettings();
  assert.equal(stored.directCommissionRate, 20);
  assert.equal(stored.referralOverrideRate, 5);
  assert.equal(stored.pickupAddress, "ok");
  assert.equal((await request("PATCH", settingsPath, { directCommissionRate: 99 }, admin)).status, 400, "the 100% rule still applies");
});

// ----- delivery by state and town -----

const { canonicalState, townMatches } = require("../utils/nigeria");
const settingsUrl = "/api/commissions/admin/settings";
const deliveryTo = (state, city, extra = {}) => request("POST", "/api/orders", {
  items: pickupItems(), fulfillment: "delivery",
  shippingAddress: { fullName: "A Buyer", phone: "08011112222", state, city, ...extra },
}, alice);

test("states and towns are matched forgivingly but exactly", () => {
  assert.equal(canonicalState("kogi"), "Kogi");
  assert.equal(canonicalState(" Kogi State "), "Kogi");
  assert.equal(canonicalState("ABUJA"), "FCT (Abuja)");
  assert.equal(canonicalState("fct"), "FCT (Abuja)");
  for (const bad of ["", "Atlantis", null, undefined, 5, {}, ["Kogi"]]) assert.equal(canonicalState(bad), null, JSON.stringify(bad));
  for (const entered of ["Ankpa", "ankpa", "  ANKPA ", "Ankpa town", "Ankpa, Kogi", "ankpa-town"]) {
    assert.equal(townMatches("Ankpa", entered), true, entered);
  }
  for (const entered of ["Ankparu", "Anka", "Idah", "", "pa"]) assert.equal(townMatches("Ankpa", entered), false, entered);
  assert.equal(townMatches("", "Ankpa"), false);
});

test("delivery needs a state and town, but no street address", async () => {
  const noStreet = await deliveryTo("kogi state", "Idah");
  assert.equal(noStreet.status, 201, JSON.stringify(noStreet.body));
  const order = await Order.findById(noStreet.body.data.orderId);
  assert.equal(order.fulfillment, "delivery");
  assert.equal(order.shippingAddress.state, "Kogi", "the state is stored in its exact spelling");
  assert.equal(order.shippingAddress.city, "Idah");
  assert.equal(order.shippingAddress.address, "", "the street/landmark line is optional");

  const withLandmark = await deliveryTo("Lagos", "Ikeja", { address: "Near the motor park" });
  assert.equal(withLandmark.status, 201);
  assert.equal((await Order.findById(withLandmark.body.data.orderId)).shippingAddress.address, "Near the motor park");

  for (const bad of [["Atlantis", "Idah"], ["", "Idah"], ["Kogi", ""], ["Kogi", "  "], [{ $ne: 1 }, "Idah"], ["Kogi", { a: 1 }]]) {
    assert.equal((await deliveryTo(...bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await deliveryTo("Kogi", "Idah", { address: { a: 1 } })).status, 400);
  assert.equal((await deliveryTo("Kogi", "Idah", { address: "x".repeat(251) })).status, 400);
});

test("delivery is switched off for the towns the owner lists, and only those", async () => {
  const set = await request("PATCH", settingsUrl, { pickupOnlyAreas: [{ state: "kogi state", town: " Ankpa " }, { state: "Kogi", town: "ankpa" }] }, admin);
  assert.equal(set.status, 200, JSON.stringify(set.body));
  assert.deepEqual((await Settings.getSettings()).pickupOnlyAreas.map(a => ({ state: a.state, town: a.town })), [{ state: "Kogi", town: "Ankpa" }], "stored once, with the exact state name");

  for (const town of ["Ankpa", "ankpa", "Ankpa town", "ANKPA, Kogi"]) {
    const response = await deliveryTo("Kogi", town);
    assert.equal(response.status, 400, town);
    assert.match(response.body.message, /do not deliver in Ankpa, Kogi.*pickup/i);
  }
  assert.equal((await deliveryTo("Kogi", "Idah")).status, 201, "other towns in the same state still get delivery");
  assert.equal((await deliveryTo("Enugu", "Ankpa")).status, 201, "the rule is for that state's Ankpa only");
  assert.equal((await deliveryTo("Kogi", "Ankparu")).status, 201, "a different town with a similar name is not caught");
  const pickup = await request("POST", "/api/orders", {
    items: pickupItems(), fulfillment: "pickup", shippingAddress: { fullName: "A", phone: "08011112222" },
  }, alice);
  assert.equal(pickup.status, 201, "everyone, including people in Ankpa, can collect");

  await request("PATCH", settingsUrl, { pickupEnabled: false }, admin);
  const noPickup = await deliveryTo("Kogi", "Ankpa");
  assert.equal(noPickup.status, 400);
  assert.match(noPickup.body.message, /cannot deliver to Ankpa, Kogi/i, "with pickup off there is nothing to suggest");
});

test("the list of pickup-only towns is public, admin-only to change, and validated", async () => {
  const empty = await request("GET", "/api/store/delivery");
  assert.equal(empty.status, 200);
  assert.equal(empty.body.data.states.length, 37);
  assert.ok(empty.body.data.states.includes("Kogi") && empty.body.data.states.includes("FCT (Abuja)"));
  assert.deepEqual(empty.body.data.pickupOnlyAreas, []);

  const body = { pickupOnlyAreas: [{ state: "Kogi", town: "Ankpa" }] };
  assert.equal((await request("PATCH", settingsUrl, body)).status, 401);
  assert.ok([401, 403].includes((await request("PATCH", settingsUrl, body, alice)).status));
  assert.equal((await request("PATCH", settingsUrl, body, admin)).status, 200);
  assert.deepEqual((await request("GET", "/api/store/delivery")).body.data.pickupOnlyAreas, [{ state: "Kogi", town: "Ankpa" }]);

  for (const bad of ["Ankpa", {}, [{ state: "Atlantis", town: "Ankpa" }], [{ state: "Kogi", town: "A" }], [{ state: "Kogi", town: "x".repeat(81) }],
    [{ state: "Kogi" }], [{ town: "Ankpa" }], [null], [{ state: { $ne: 1 }, town: "Ankpa" }], [{ state: "Kogi", town: { a: 1 } }],
    Array.from({ length: 51 }, (_, i) => ({ state: "Kogi", town: "Town " + i }))]) {
    assert.equal((await request("PATCH", settingsUrl, { pickupOnlyAreas: bad }, admin)).status, 400, JSON.stringify(bad).slice(0, 70));
  }
  assert.deepEqual((await request("GET", "/api/store/delivery")).body.data.pickupOnlyAreas, [{ state: "Kogi", town: "Ankpa" }], "refused changes leave the list alone");
  assert.equal((await request("PATCH", settingsUrl, { pickupOnlyAreas: [] }, admin)).status, 200);
  assert.deepEqual((await request("GET", "/api/store/delivery")).body.data.pickupOnlyAreas, []);
});

// ----- checkout and cross-site writes -----

test("checkout requires a complete delivery address and stores it", async () => {
  const items = [{ productId: String(product._id), quantity: 1 }];
  for (const shippingAddress of [undefined, {}, [], "x", { fullName: "A", phone: "08011112222", address: "1 St", city: "L" },
    { fullName: "A", phone: "08011112222", address: "1 St", city: "L", state: { $ne: 1 } }]) {
    assert.equal((await request("POST", "/api/orders", { items, shippingAddress }, alice)).status, 400, JSON.stringify(shippingAddress));
  }
  const address = { fullName: " Alice A ", phone: "08011112222", address: "1 Test St", city: "Ikeja", state: "Lagos" };
  const created = await request("POST", "/api/orders", { items, shippingAddress: address }, alice);
  assert.equal(created.status, 201);
  const order = await Order.findById(created.body.data.orderId);
  assert.equal(order.shippingAddress.fullName, "Alice A");
  assert.equal(order.shippingAddress.state, "Lagos");
});

test("buyers never receive cost price in their orders or commissions", async () => {
  const created = await request("POST", "/api/orders", {
    items: [{ productId: String(product._id), quantity: 1 }],
    shippingAddress: { fullName: "A", phone: "08011112222", address: "1 St", city: "L", state: "Lagos" },
  }, alice);
  assert.equal(created.status, 201);
  const mine = await request("GET", "/api/orders/mine", undefined, alice);
  assert.equal(JSON.stringify(mine.body).includes("costPrice"), false);
  await approvedCommission(alice, 100);
  assert.equal(JSON.stringify((await request("GET", "/api/commissions/mine", undefined, alice)).body).includes("costPrice"), false);
});

test("state-changing requests from another website are refused, same-site and header-less ones are not", async () => {
  const login = { email: "alice@example.com", password: "password123" };
  const evil = await request("POST", "/api/auth/login", login, undefined, { origin: "https://evil.example.net" });
  assert.equal(evil.status, 403);
  const own = await request("POST", "/api/auth/login", login, undefined, { origin: "https://shop.example.com" });
  assert.equal(own.status, 200);
  assert.equal((await request("POST", "/api/auth/login", login)).status, 200);
  // Reads are never blocked by this check.
  assert.equal((await request("GET", "/api/products", undefined, undefined, { origin: "https://evil.example.net" })).status, 200);
});
