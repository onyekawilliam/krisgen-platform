const { before, after, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const Settings = require("../models/Settings");
const Product = require("../models/Product");
const User = require("../models/User");
const Order = require("../models/Order");
const Referral = require("../models/Referral");
const Commission = require("../models/Commission");
const { recordInStoreSale } = require("../services/inStoreSaleService");

// Only an isolated replica set and local HTTP server are used. Neither .env nor
// payment-provider services are loaded by this suite.
process.env.JWT_SECRET = "isolated-data-integrity-regression-secret";
process.env.NODE_ENV = "production"; // Exercise the public error response without expected-error logs.
const productRoutes = require("../routes/productRoutes");
const commissionRoutes = require("../routes/commissionRoutes");
const errorHandler = require("../middlewares/errorHandler");
const models = [Settings, Product, User, Order, Referral, Commission];
let replSet;
let server;
let baseUrl;
let admin;
let product;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  for (const model of models) await model.init();
  const app = express();
  app.use(express.json());
  app.use("/api/products", productRoutes);
  app.use("/api/commissions", commissionRoutes);
  app.use(errorHandler);
  await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = "http://127.0.0.1:" + server.address().port;
}, { timeout: 600000 });

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

beforeEach(async () => {
  // These collections belong exclusively to the temporary MongoMemoryReplSet.
  for (const model of models) await model.deleteMany({});
  admin = await member("Admin", { role: "admin" });
  product = await Product.create(productBody());
});

function productBody(overrides = {}) {
  return { name: "Integrity Test Phone", brand: "Samsung", model: "Test",
    sellingPrice: 150000, costPrice: 100000, stock: 10, ...overrides };
}

function member(name, overrides = {}) {
  return User.create({ name, email: name.toLowerCase() + "@test.invalid", phone: "08012345678",
    passwordHash: "test-password", referralCode: name, ...overrides });
}

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json",
    Authorization: "Bearer " + jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET) };
  const response = await fetch(baseUrl + path, { method, headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}

async function storedProduct() { return Product.findById(product._id).select("+costPrice"); }
const productPath = () => "/api/products/admin/" + product._id;
const settingsPath = "/api/commissions/admin/settings";

// A one-use barrier makes both transactions establish snapshots before either
// creates settings. Transaction callback retries pass straight through it.
function initialPairBarrier() {
  let arrivals = 0;
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  return async () => {
    if (++arrivals === 2) release();
    if (arrivals <= 2) await ready;
  };
}

test("empty settings initialization returns one singleton to concurrent callers", async () => {
  assert.equal(await Settings.countDocuments(), 0);
  const results = await Promise.all(Array.from({ length: 20 }, () => Settings.getSettings()));
  assert.equal(new Set(results.map(row => String(row._id))).size, 1);
  assert.equal(await Settings.countDocuments(), 1);
  for (const row of results) {
    assert.equal(row.key, "platform");
    assert.equal(row.directCommissionRate, 15);
    assert.equal(row.referralOverrideRate, 5);
  }
});

test("concurrent singleton reads preserve an existing document and custom rates", async () => {
  const existing = await Settings.create({ key: "platform", directCommissionRate: 22.5,
    referralOverrideRate: 7.25 });
  const results = await Promise.all(Array.from({ length: 12 }, () => Settings.getSettings()));
  for (const row of results) {
    assert.equal(String(row._id), String(existing._id));
    assert.equal(row.directCommissionRate, 22.5);
    assert.equal(row.referralOverrideRate, 7.25);
  }
  assert.equal(await Settings.countDocuments(), 1);
});

test("empty singleton initialization retries whole competing snapshot transactions", { timeout: 30000 }, async () => {
  const barrier = initialPairBarrier();
  const initialize = () => mongoose.connection.transaction(async session => {
    await Product.findById(product._id).session(session);
    await barrier();
    return Settings.getSettings({ session });
  });
  const results = await Promise.all([initialize(), initialize()]);
  assert.equal(String(results[0]._id), String(results[1]._id));
  assert.equal(await Settings.countDocuments(), 1);
});

test("different-product commissioned sales initialize settings concurrently without losing a sale", { timeout: 30000 }, async () => {
  const other = await Product.create(productBody({ name: "Second Phone" }));
  const parent = await member("Parent");
  const seller = await member("Seller", { referredBy: parent._id });
  await Referral.create({ referrer: parent._id, referred: seller._id });
  const original = Settings.getSettings;
  const barrier = initialPairBarrier();
  Settings.getSettings = async function (...args) {
    await barrier();
    return original.apply(this, args);
  };
  const sale = (item, idempotencyKey) => recordInStoreSale({ idempotencyKey,
    customerName: "Walk In", customerPhone: "08012345678", referrerId: String(seller._id),
    productId: String(item._id), quantity: 1, paymentMethod: "cash" }, admin._id);
  let results;
  try { results = await Promise.all([sale(product, "settings-race-a"), sale(other, "settings-race-b")]); }
  finally { Settings.getSettings = original; }
  assert.equal(new Set(results.map(result => String(result.order._id))).size, 2);
  assert.equal(await Settings.countDocuments(), 1);
  assert.equal(await Order.countDocuments({ status: "paid" }), 2);
  assert.equal((await storedProduct()).stock, 9);
  assert.equal((await Product.findById(other._id)).stock, 9);
  assert.equal(await Commission.countDocuments(), 4);
  for (const result of results) {
    const direct = await Commission.findOne({ order: result.order._id, type: "direct" });
    const override = await Commission.findOne({ order: result.order._id, type: "override" });
    assert.equal(direct.grossProfitSnapshot, 50000);
    assert.equal(direct.commissionRate, 15);
    assert.equal(direct.commissionAmount, 7500);
    assert.equal(String(direct.beneficiary), String(seller._id));
    assert.equal(override.commissionRate, 5);
    assert.equal(override.commissionAmount, 2500);
    assert.equal(String(override.beneficiary), String(parent._id));
  }
});

test("product API rejects invalid stock on create without inserting products", async () => {
  for (const stock of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, true, false, null, "", "3", [], {}]) {
    const response = await request("POST", "/api/products/admin", productBody({ stock }));
    assert.equal(response.status, 400, "stock=" + JSON.stringify(stock));
    assert.equal(await Product.countDocuments(), 1);
  }
});

test("product API rejects invalid stock on patch and preserves inventory", async () => {
  for (const stock of [-1, 0.1, Number.MAX_SAFE_INTEGER + 1, true, false, null, "", "3", [], {}]) {
    const response = await request("PATCH", productPath(), { stock });
    assert.equal(response.status, 400, "stock=" + JSON.stringify(stock));
    assert.equal((await storedProduct()).stock, 10);
  }
});

test("product API accepts integer stock, defaults omitted create stock and preserves omitted patch stock", async () => {
  const body = productBody();
  delete body.stock;
  let response = await request("POST", "/api/products/admin", body);
  assert.equal(response.status, 201);
  assert.equal(response.body.data.stock, 0);
  assert.equal(response.body.data.commissionRateOverride, null);
  response = await request("PATCH", productPath(), { description: "Updated description" });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.stock, 10);
  for (const stock of [0, 1, Number.MAX_SAFE_INTEGER]) {
    response = await request("PATCH", productPath(), { stock });
    assert.equal(response.status, 200);
    assert.equal((await storedProduct()).stock, stock);
  }
});

test("product API rejects update operators, dotted fields and protected or unknown fields", async () => {
  for (const body of [{ $inc: { stock: -11 } }, { "stock.value": -1 },
    { unexpectedField: 1 }, { _id: String(new mongoose.Types.ObjectId()) }, { createdAt: new Date().toISOString() }]) {
    assert.equal((await request("PATCH", productPath(), body)).status, 400, JSON.stringify(body));
    assert.equal((await request("POST", "/api/products/admin", productBody(body))).status, 400, JSON.stringify(body));
    assert.equal((await storedProduct()).stock, 10);
    assert.equal(await Product.countDocuments(), 1);
  }
});

test("Product model rejects noninteger, unsafe, nonfinite and coercible stock values", async () => {
  for (const stock of [-1, 0.25, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, -Infinity,
    true, false, null, "", "3", [], {}]) {
    await assert.rejects(new Product(productBody({ stock })).validate(),
      error => error.name === "ValidationError", "stock=" + String(stock));
  }
  for (const stock of [0, 1, Number.MAX_SAFE_INTEGER]) {
    await new Product(productBody({ stock })).validate();
  }
});

test("Product query updates cannot disable stock validation", async () => {
  for (const update of [{ $set: { stock: -1 } }, { stock: 1.5 }, { $set: { stock: "3" } },
    { $set: { stock: null } }, { $unset: { stock: "" } }]) {
    await assert.rejects(Product.updateOne({ _id: product._id }, update, { runValidators: false }));
    assert.equal((await storedProduct()).stock, 10);
  }
  await assert.rejects(Product.updateMany({}, { $set: { stock: 1.5 } }));
  await assert.rejects(Product.findByIdAndUpdate(product._id, { $set: { stock: -1 } }));
  await assert.rejects(Product.replaceOne({ _id: product._id }, productBody({ stock: -1 })));
  await assert.rejects(Product.findOneAndReplace({ _id: product._id }, productBody({ stock: 0.5 })));
  assert.equal((await storedProduct()).stock, 10);
});

test("stock increments are conditional and cannot underflow, overflow or use fractional deltas", async () => {
  let result = await Product.updateOne({ _id: product._id }, { $inc: { stock: -11 } });
  assert.equal(result.modifiedCount, 0);
  assert.equal((await storedProduct()).stock, 10);
  for (const delta of [0.5, -0.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, true, null, "1"]) {
    await assert.rejects(Product.updateOne({ _id: product._id }, { $inc: { stock: delta } }));
    assert.equal((await storedProduct()).stock, 10);
  }
  await Product.updateOne({ _id: product._id }, { $set: { stock: Number.MAX_SAFE_INTEGER } });
  result = await Product.updateOne({ _id: product._id }, { $inc: { stock: 1 } });
  assert.equal(result.modifiedCount, 0);
  assert.equal((await storedProduct()).stock, Number.MAX_SAFE_INTEGER);
});

test("two concurrent inventory adjustments cannot subtract the same remaining stock", async () => {
  const results = await Promise.all([
    Product.updateOne({ _id: product._id }, { $inc: { stock: -6 } }),
    Product.updateOne({ _id: product._id }, { $inc: { stock: -6 } }),
  ]);
  assert.equal(results.reduce((total, result) => total + result.modifiedCount, 0), 1);
  assert.equal((await storedProduct()).stock, 4);
});

test("stock adjustment safety retains caller availability filters", async () => {
  const result = await Product.findOneAndUpdate({ _id: product._id, stock: { $gte: 11 } },
    { $inc: { stock: -1 } }, { new: true });
  assert.equal(result, null);
  assert.equal((await storedProduct()).stock, 10);
  await Product.updateOne({ _id: product._id }, { $inc: { stock: 2 } });
  assert.equal((await storedProduct()).stock, 12);
});

test("unsafe stock arithmetic, rename, pipeline and increment-upsert cannot bypass validation", async () => {
  for (const update of [{ $mul: { stock: -1 } }, { $rename: { stock: "oldStock" } },
    { $rename: { description: "stock" } }, [{ $set: { stock: -1 } }]]) {
    await assert.rejects(Product.updateOne({ _id: product._id }, update));
    assert.equal((await storedProduct()).stock, 10);
  }
  await assert.rejects(Product.updateOne({ _id: new mongoose.Types.ObjectId() },
    { $inc: { stock: 1 } }, { upsert: true }));
  assert.equal(await Product.countDocuments(), 1);
});

test("global commission API rejects invalid values without changing existing settings", async () => {
  const existing = await Settings.create({ directCommissionRate: 15, referralOverrideRate: 5 });
  for (const field of ["directCommissionRate", "referralOverrideRate"]) {
    for (const value of [-1, 100.01, true, false, null, "", "15", [], {}]) {
      const response = await request("PATCH", settingsPath, { [field]: value });
      assert.equal(response.status, 400, field + "=" + JSON.stringify(value));
      const stored = await Settings.findById(existing._id);
      assert.equal(stored.directCommissionRate, 15);
      assert.equal(stored.referralOverrideRate, 5);
      assert.equal(await Settings.countDocuments(), 1);
    }
  }
});

test("global commission API accepts 0, 100 and fractional percentages, preserving omitted fields", async () => {
  const existing = await Settings.create({ directCommissionRate: 15, referralOverrideRate: 5 });
  for (const value of [0, 100, 12.75]) {
    const response = await request("PATCH", settingsPath, { directCommissionRate: value });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.directCommissionRate, value);
    assert.equal(response.body.data.referralOverrideRate, 5);
    assert.equal(String(response.body.data._id), String(existing._id));
  }
  for (const value of [0, 100, 3.25]) {
    const response = await request("PATCH", settingsPath, { referralOverrideRate: value });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.referralOverrideRate, value);
    assert.equal(response.body.data.directCommissionRate, 12.75);
  }
});

test("global settings API rejects operator, singleton-key and unknown field changes", async () => {
  await Settings.create({ directCommissionRate: 15, referralOverrideRate: 5 });
  for (const body of [{ $inc: { directCommissionRate: 500 } }, { key: "another-platform" },
    { "directCommissionRate.value": 5 }, { unexpectedField: 1 }]) {
    assert.equal((await request("PATCH", settingsPath, body)).status, 400);
    const settings = await Settings.getSettings();
    assert.equal(settings.key, "platform");
    assert.equal(settings.directCommissionRate, 15);
    assert.equal(settings.referralOverrideRate, 5);
    assert.equal(await Settings.countDocuments(), 1);
  }
});

test("Settings model rejects invalid percentages and accepts numeric boundaries", async () => {
  for (const field of ["directCommissionRate", "referralOverrideRate"]) {
    for (const value of [-1, 100.01, NaN, Infinity, -Infinity, true, false, null, "", "15", [], {}]) {
      await assert.rejects(new Settings({ [field]: value }).validate(),
        error => error.name === "ValidationError", field + "=" + String(value));
    }
    for (const value of [0, 100, 2.75]) {
      await new Settings({ [field]: value }).validate();
    }
  }
});

test("Settings query updates enforce percentage validation even without runValidators", async () => {
  const existing = await Settings.create({ directCommissionRate: 15, referralOverrideRate: 5 });
  for (const update of [{ directCommissionRate: -1 }, { $set: { referralOverrideRate: 100.1 } },
    { $set: { directCommissionRate: null } }, { $set: { directCommissionRate: "20" } },
    { $unset: { directCommissionRate: "" } }, { $inc: { directCommissionRate: 1 } },
    { $mul: { referralOverrideRate: 2 } }, [{ $set: { directCommissionRate: -1 } }]]) {
    await assert.rejects(Settings.updateOne({ _id: existing._id }, update, { runValidators: false }));
    const stored = await Settings.findById(existing._id);
    assert.equal(stored.directCommissionRate, 15);
    assert.equal(stored.referralOverrideRate, 5);
  }
  await assert.rejects(Settings.updateMany({}, { $set: { directCommissionRate: 101 } }));
  await assert.rejects(Settings.findByIdAndUpdate(existing._id, { $set: { referralOverrideRate: -1 } }));
  await assert.rejects(Settings.replaceOne({ _id: existing._id }, { key: "platform", directCommissionRate: -1 }));
  await assert.rejects(Settings.findOneAndReplace({ _id: existing._id }, { key: "platform", referralOverrideRate: 101 }));
});

test("product override API rejects invalid percentages on create and patch", async () => {
  for (const value of [-1, 100.1, true, false, "", "20", [], {}]) {
    const create = await request("POST", "/api/products/admin", productBody({ commissionRateOverride: value }));
    assert.equal(create.status, 400, "create override=" + JSON.stringify(value));
    const patch = await request("PATCH", productPath(), { commissionRateOverride: value });
    assert.equal(patch.status, 400, "patch override=" + JSON.stringify(value));
    assert.equal((await storedProduct()).commissionRateOverride, null);
    assert.equal(await Product.countDocuments(), 1);
  }
});

test("product override API accepts inclusive boundaries, decimals, null reset and omitted preservation", async () => {
  for (const value of [0, 100, 17.25, null]) {
    const create = await request("POST", "/api/products/admin", productBody({ commissionRateOverride: value }));
    assert.equal(create.status, 201);
    assert.equal(create.body.data.commissionRateOverride, value);
    const patch = await request("PATCH", productPath(), { commissionRateOverride: value });
    assert.equal(patch.status, 200);
    assert.equal((await storedProduct()).commissionRateOverride, value);
    const omitted = await request("PATCH", productPath(), { description: "Keep override" });
    assert.equal(omitted.status, 200);
    assert.equal((await storedProduct()).commissionRateOverride, value);
  }
});

test("Product model enforces override percentage type and null inheritance", async () => {
  for (const value of [-1, 100.1, NaN, Infinity, -Infinity, true, false, "", "15", [], {}]) {
    await assert.rejects(new Product(productBody({ commissionRateOverride: value })).validate(),
      error => error.name === "ValidationError", "override=" + String(value));
  }
  for (const value of [0, 100, 12.5, null]) {
    await new Product(productBody({ commissionRateOverride: value })).validate();
  }
});

test("product override query updates cannot bypass percentage validation", async () => {
  for (const update of [{ $set: { commissionRateOverride: -1 } }, { commissionRateOverride: 100.1 },
    { $set: { commissionRateOverride: "20" } }, { $inc: { commissionRateOverride: 1 } },
    { $mul: { commissionRateOverride: 2 } }, { $rename: { description: "commissionRateOverride" } }]) {
    await assert.rejects(Product.updateOne({ _id: product._id }, update, { runValidators: false }));
    assert.equal((await storedProduct()).commissionRateOverride, null);
  }
  await Product.updateOne({ _id: product._id }, { $set: { commissionRateOverride: 100 } });
  assert.equal((await storedProduct()).commissionRateOverride, 100);
  await Product.updateOne({ _id: product._id }, { $set: { commissionRateOverride: null } });
  assert.equal((await storedProduct()).commissionRateOverride, null);
});

test("admin commission list traces registered and walk-in commissions to their saved orders", async () => {
  const referrer = await member("Trace Referrer");
  const seller = await member("Trace Seller", { referredBy: referrer._id });
  const registeredCustomer = await member("Trace Registered Customer", { referredBy: seller._id });
  await Referral.create({ referrer: referrer._id, referred: seller._id });

  const registeredSale = await recordInStoreSale({
    idempotencyKey: "commission-trace-registered",
    customerId: String(registeredCustomer._id),
    productId: String(product._id),
    quantity: 2,
    paymentMethod: "transfer",
  }, admin._id);
  const walkInSale = await recordInStoreSale({
    idempotencyKey: "commission-trace-walk-in",
    customerName: "Trace Walk-in Customer",
    customerPhone: "08098765432",
    customerEmail: "walkin.trace@test.invalid",
    referrerId: String(seller._id),
    productId: String(product._id),
    quantity: 1,
    paymentMethod: "cash",
  }, admin._id);

  const response = await request("GET", "/api/commissions/admin/all");
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.length, 4);

  const registeredDirect = response.body.data.find(row =>
    row.type === "direct" && row.order?.orderNumber === registeredSale.order.orderNumber
  );
  assert.ok(registeredDirect, "registered sale has a direct commission row");
  assert.equal(registeredDirect.order.buyer.name, "Trace Registered Customer");
  assert.equal(registeredDirect.order.buyer.email, "trace registered customer@test.invalid");
  assert.equal(registeredDirect.order.walkInCustomer, undefined);
  assert.ok(registeredDirect.order.createdAt, "registered sale includes the order creation time");
  assert.equal(registeredDirect.order.payment.reference, registeredSale.order.payment.reference);
  assert.equal(registeredDirect.beneficiary.name, "Trace Seller");
  assert.equal(registeredDirect.product.name, product.name);
  assert.equal(registeredDirect.grossProfitSnapshot, 100000);
  assert.equal(registeredDirect.commissionRate, 15);
  assert.equal(registeredDirect.commissionAmount, 15000);
  assert.equal(registeredDirect.status, "pending");

  const walkInDirect = response.body.data.find(row =>
    row.type === "direct" && row.order?.orderNumber === walkInSale.order.orderNumber
  );
  assert.ok(walkInDirect, "walk-in sale has a direct commission row");
  assert.equal(walkInDirect.order.buyer, null);
  assert.equal(walkInDirect.order.walkInCustomer.name, "Trace Walk-in Customer");
  assert.equal(walkInDirect.order.walkInCustomer.phone, "08098765432");
  assert.equal(walkInDirect.order.walkInCustomer.email, "walkin.trace@test.invalid");
  assert.ok(walkInDirect.order.createdAt, "walk-in sale includes the order creation time");
  assert.equal(walkInDirect.order.payment.reference, walkInSale.order.payment.reference);
  assert.equal(walkInDirect.beneficiary.name, "Trace Seller");
  assert.equal(walkInDirect.product.name, product.name);
  assert.equal(walkInDirect.grossProfitSnapshot, 50000);
  assert.equal(walkInDirect.commissionRate, 15);
  assert.equal(walkInDirect.commissionAmount, 7500);
  assert.equal(walkInDirect.status, "pending");

  const walkInOverride = response.body.data.find(row =>
    row.type === "override" && row.order?.orderNumber === walkInSale.order.orderNumber
  );
  assert.ok(walkInOverride, "walk-in sale retains its one-level override row");
  assert.equal(walkInOverride.beneficiary.name, "Trace Referrer");
  assert.equal(walkInOverride.commissionRate, 5);
  assert.equal(walkInOverride.commissionAmount, 2500);
});
