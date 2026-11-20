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
const cloudinaryImages = require("../services/cloudinaryImageService");

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

async function storedProduct() { return Product.findById(product._id).select("+costPrice +imagePublicId +imagePublicIds"); }
const productPath = () => "/api/products/admin/" + product._id;
const settingsPath = "/api/commissions/admin/settings";

async function uploadImage(path, { mime = "image/png", bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), userId = admin?._id } = {}) {
  const form = new FormData();
  form.append("image", new Blob([bytes], { type: mime }), "phone-image.png");
  const headers = {};
  if (userId) headers.Authorization = "Bearer " + jwt.sign({ id: String(userId) }, process.env.JWT_SECRET);
  const response = await fetch(baseUrl + path, { method: "POST", headers, body: form });
  return { status: response.status, body: await response.json() };
}

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
  // The direct rate and the override (5) share one profit, so together they stop at 100.
  for (const value of [0, 95, 12.75]) {
    const response = await request("PATCH", settingsPath, { directCommissionRate: value });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.directCommissionRate, value);
    assert.equal(response.body.data.referralOverrideRate, 5);
    assert.equal(String(response.body.data._id), String(existing._id));
  }
  for (const value of [0, 87.25, 3.25]) {
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
  for (const value of [0, 95, 17.25, null]) {
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

test("product image upload requires authentication and admin authorization", async () => {
  const unauthenticated = await uploadImage(productPath() + "/images", { userId: null });
  assert.equal(unauthenticated.status, 401);
  const customer = await member("Image Upload Customer");
  const forbidden = await uploadImage(productPath() + "/images", { userId: customer._id });
  assert.equal(forbidden.status, 403);
  assert.deepEqual((await storedProduct()).images, []);
});

test("product image upload rejects unsupported, spoofed and oversized image files", async () => {
  const unsupported = await uploadImage(productPath() + "/images", { mime: "text/plain" });
  assert.equal(unsupported.status, 400);
  const spoofed = await uploadImage(productPath() + "/images", { bytes: Buffer.from("not an image") });
  assert.equal(spoofed.status, 400);
  const oversized = await uploadImage(productPath() + "/images", {
    bytes: Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(5 * 1024 * 1024)]),
  });
  assert.equal(oversized.status, 413);
  assert.deepEqual((await storedProduct()).images, []);
});

test("product image upload stores the secure URL and Cloudinary public ID", async () => {
  const originalUpload = cloudinaryImages.uploadProductImage;
  cloudinaryImages.uploadProductImage = async () => ({
    secureUrl: "https://res.cloudinary.com/test-cloud/image/upload/phone.png",
    publicId: "krisgen/products/phone-test",
  });
  try {
    const response = await uploadImage(productPath() + "/images");
    assert.equal(response.status, 201);
    const saved = await storedProduct();
    assert.equal(saved.images[0], "https://res.cloudinary.com/test-cloud/image/upload/phone.png");
    assert.deepEqual([...saved.imagePublicIds], ["krisgen/products/phone-test"]);
    const publicResponse = await fetch(baseUrl + "/api/products/" + product._id);
    const publicBody = await publicResponse.json();
    assert.equal(publicBody.data.images[0], saved.images[0]);
    assert.equal(Object.hasOwn(publicBody.data, "imagePublicId"), false);
    assert.equal(Object.hasOwn(publicBody.data, "imagePublicIds"), false, "Cloudinary IDs are never sent to customers");
  } finally {
    cloudinaryImages.uploadProductImage = originalUpload;
  }
});

test("Cloudinary upload failures return a clear error and leave the product unchanged", async () => {
  const originalUpload = cloudinaryImages.uploadProductImage;
  cloudinaryImages.uploadProductImage = async () => { throw new Error("mock provider failure"); };
  try {
    const response = await uploadImage(productPath() + "/images");
    assert.equal(response.status, 502);
    assert.match(response.body.message, /Cloudinary could not store the product image/i);
    assert.deepEqual((await storedProduct()).images, []);
  } finally {
    cloudinaryImages.uploadProductImage = originalUpload;
  }
});

// ----- the photo gallery: one to five photos per phone -----

const cloudUrl = (name) => "https://res.cloudinary.com/test-cloud/image/upload/" + name + ".png";

// Stubs the Cloudinary calls for one test and always restores them.
async function withCloudinary(fn) {
  const originalUpload = cloudinaryImages.uploadProductImage;
  const originalDelete = cloudinaryImages.deleteProductImage;
  const calls = { uploads: 0, deleted: [] };
  cloudinaryImages.uploadProductImage = async () => {
    const n = ++calls.uploads;
    return { secureUrl: cloudUrl("photo" + n), publicId: "krisgen/products/photo" + n };
  };
  cloudinaryImages.deleteProductImage = async (publicId) => { calls.deleted.push(publicId); return { result: "ok" }; };
  try {
    return await fn(calls);
  } finally {
    cloudinaryImages.uploadProductImage = originalUpload;
    cloudinaryImages.deleteProductImage = originalDelete;
  }
}

async function adminCall(method, path) {
  const response = await fetch(baseUrl + path, {
    method, headers: { Authorization: "Bearer " + jwt.sign({ id: String(admin._id) }, process.env.JWT_SECRET) },
  });
  return { status: response.status, body: await response.json() };
}

test("a phone can have one photo, or up to five, added one at a time in order", async () => {
  await withCloudinary(async (calls) => {
    for (let n = 1; n <= 5; n++) {
      const response = await uploadImage(productPath() + "/images");
      assert.equal(response.status, 201, "photo " + n + ": " + JSON.stringify(response.body));
      assert.equal(response.body.data.images.length, n);
      assert.equal(Object.hasOwn(response.body.data, "imagePublicIds"), false);
    }
    const saved = await storedProduct();
    assert.deepEqual([...saved.images], [1, 2, 3, 4, 5].map((n) => cloudUrl("photo" + n)));
    assert.deepEqual([...saved.imagePublicIds], [1, 2, 3, 4, 5].map((n) => "krisgen/products/photo" + n));

    const sixth = await uploadImage(productPath() + "/images");
    assert.equal(sixth.status, 409);
    assert.match(sixth.body.message, /at most 5 photos/i);
    assert.equal(calls.uploads, 5, "the sixth file is refused before it is sent to Cloudinary");
    assert.equal((await storedProduct()).images.length, 5);
  });
});

test("uploading several photos at once can never push a phone past five", async () => {
  await withCloudinary(async (calls) => {
    for (let n = 0; n < 3; n++) assert.equal((await uploadImage(productPath() + "/images")).status, 201);
    const results = await Promise.all(Array.from({ length: 4 }, () => uploadImage(productPath() + "/images")));
    const saved = await storedProduct();
    assert.equal(saved.images.length, 5);
    assert.equal(saved.imagePublicIds.length, 5, "every photo keeps its own Cloudinary ID");
    assert.equal(results.filter((r) => r.status === 201).length, 2);
    assert.ok(results.filter((r) => r.status !== 201).every((r) => r.status === 409));
    assert.equal(calls.deleted.length, results.filter((r) => r.status === 409).length,
      "an upload that lost the race is cleaned up from Cloudinary");
  });
});

test("removing a photo keeps the others in order and tidies Cloudinary", async () => {
  await withCloudinary(async (calls) => {
    for (let n = 0; n < 3; n++) await uploadImage(productPath() + "/images");
    const removed = await adminCall("DELETE", productPath() + "/images/1");
    assert.equal(removed.status, 200);
    const saved = await storedProduct();
    assert.deepEqual([...saved.images], [cloudUrl("photo1"), cloudUrl("photo3")]);
    assert.deepEqual([...saved.imagePublicIds], ["krisgen/products/photo1", "krisgen/products/photo3"]);
    assert.deepEqual(calls.deleted, ["krisgen/products/photo2"]);

    for (const bad of ["5", "2", "-1", "abc", "1.5", "123"]) {
      assert.equal((await adminCall("DELETE", productPath() + "/images/" + bad)).status, 404, bad);
    }
    assert.equal((await storedProduct()).images.length, 2);
    assert.equal((await adminCall("DELETE", productPath() + "/images/0")).status, 200);
    assert.equal((await adminCall("DELETE", productPath() + "/images/0")).status, 200);
    assert.equal((await storedProduct()).images.length, 0, "a phone can end up with no photos");
    assert.equal((await adminCall("DELETE", productPath() + "/images/0")).status, 404);
  });
});

test("any photo can be made the main one, and only admins can change photos", async () => {
  await withCloudinary(async () => {
    for (let n = 0; n < 3; n++) await uploadImage(productPath() + "/images");
    assert.equal((await adminCall("POST", productPath() + "/images/2/primary")).status, 200);
    let saved = await storedProduct();
    assert.deepEqual([...saved.images], [cloudUrl("photo3"), cloudUrl("photo1"), cloudUrl("photo2")]);
    assert.deepEqual([...saved.imagePublicIds], ["krisgen/products/photo3", "krisgen/products/photo1", "krisgen/products/photo2"]);
    assert.equal((await adminCall("POST", productPath() + "/images/0/primary")).status, 200, "already main: nothing changes");
    saved = await storedProduct();
    assert.equal(saved.images[0], cloudUrl("photo3"));
    assert.equal((await adminCall("POST", productPath() + "/images/9/primary")).status, 404);

    const customer = await member("Gallery Customer");
    for (const [method, path] of [["POST", "/images/1/primary"], ["DELETE", "/images/1"]]) {
      const response = await fetch(baseUrl + productPath() + path, {
        method, headers: { Authorization: "Bearer " + jwt.sign({ id: String(customer._id) }, process.env.JWT_SECRET) },
      });
      assert.equal(response.status, 403, method + " " + path);
    }
    assert.equal((await uploadImage(productPath() + "/images", { userId: customer._id })).status, 403);
    assert.equal((await storedProduct()).images.length, 3);
  });
});

test("removing a photo that another phone still uses leaves it in Cloudinary", async () => {
  const shared = cloudUrl("shared");
  const other = await Product.create(productBody({ name: "Uses the same photo", images: [shared] }));
  other.imagePublicIds = ["krisgen/products/shared"];
  await other.save();
  product.images = [shared];
  product.imagePublicIds = ["krisgen/products/shared"];
  await product.save();
  await Product.create(productBody({ name: "Old link reference", images: [cloudUrl("old")] }));

  await withCloudinary(async (calls) => {
    assert.equal((await uploadImage(productPath() + "/images")).status, 201);
    assert.equal((await adminCall("DELETE", productPath() + "/images/0")).status, 200);
    assert.deepEqual(calls.deleted, [], "the shared photo stays");
    assert.deepEqual([...(await Product.findById(other._id).select("+imagePublicIds")).imagePublicIds], ["krisgen/products/shared"]);
    assert.equal((await adminCall("DELETE", productPath() + "/images/0")).status, 200);
    assert.deepEqual(calls.deleted, ["krisgen/products/photo1"], "an unshared photo is removed");
  });
});

test("a phone saved before galleries keeps its photo when more are added", async () => {
  await Product.collection.updateOne({ _id: product._id }, {
    $set: { images: [cloudUrl("legacy")], imagePublicId: "krisgen/products/legacy" }, $unset: { imagePublicIds: "" },
  });
  await withCloudinary(async (calls) => {
    assert.equal((await uploadImage(productPath() + "/images")).status, 201);
    const saved = await storedProduct();
    assert.deepEqual([...saved.images], [cloudUrl("legacy"), cloudUrl("photo1")]);
    assert.deepEqual([...saved.imagePublicIds], ["krisgen/products/legacy", "krisgen/products/photo1"]);
    assert.equal(saved.imagePublicId, undefined, "the old single-ID field is retired");
    assert.equal((await adminCall("DELETE", productPath() + "/images/0")).status, 200);
    assert.deepEqual(calls.deleted, ["krisgen/products/legacy"]);
  });
});

test("a photo list sent when editing a phone is limited to five secure links", async () => {
  const send = (images) => request("PATCH", productPath(), { images });
  assert.equal((await send(Array.from({ length: 6 }, (_, i) => cloudUrl("p" + i)))).status, 400);
  for (const bad of ["not a list", [5], [null], ["http://insecure.example/a.png"], ["javascript:alert(1)"], ["https://x.example/" + "a".repeat(500)], { 0: cloudUrl("x") }]) {
    assert.equal((await send(bad)).status, 400, JSON.stringify(bad).slice(0, 50));
  }
  assert.equal((await send([cloudUrl("a"), cloudUrl("b")])).status, 200);
  assert.equal((await send([])).status, 200, "a phone may have no photos");
  assert.equal((await storedProduct()).images.length, 0);
  assert.equal((await request("POST", "/api/products/admin", productBody({ name: "Too many", images: Array.from({ length: 6 }, (_, i) => cloudUrl("q" + i)) }))).status, 400);
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

// ----- deleting a phone for good -----

test("an admin can delete an unsold phone for good, and its photos are removed from Cloudinary", async () => {
  await withCloudinary(async (calls) => {
    assert.equal((await uploadImage(productPath() + "/images")).status, 201);
    assert.equal((await uploadImage(productPath() + "/images")).status, 201);
    const response = await adminCall("DELETE", productPath() + "/permanent");
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(await Product.exists({ _id: product._id }), null);
    assert.deepEqual(calls.deleted.sort(), ["krisgen/products/photo1", "krisgen/products/photo2"]);
  });
});

test("a phone that has been sold cannot be deleted, only hidden", async () => {
  await recordInStoreSale({ idempotencyKey: "delete-guard-sale", customerName: "Walk In", customerPhone: "08012345678",
    productId: String(product._id), quantity: 1, paymentMethod: "cash" }, admin._id);
  const response = await adminCall("DELETE", productPath() + "/permanent");
  assert.equal(response.status, 409);
  assert.match(response.body.message, /past orders.*Deactivate/);
  assert.ok(await Product.exists({ _id: product._id }));
  assert.equal(await Order.countDocuments({ "items.product": product._id }), 1);
});

test("deleting needs an admin and a real phone", async () => {
  const customer = await member("Shopper");
  const asCustomer = await fetch(baseUrl + productPath() + "/permanent", { method: "DELETE",
    headers: { Authorization: "Bearer " + jwt.sign({ id: String(customer._id) }, process.env.JWT_SECRET) } });
  assert.equal(asCustomer.status, 403);
  assert.equal((await fetch(baseUrl + productPath() + "/permanent", { method: "DELETE" })).status, 401);
  assert.ok(await Product.exists({ _id: product._id }));
  assert.equal((await adminCall("DELETE", "/api/products/admin/" + new mongoose.Types.ObjectId() + "/permanent")).status, 404);
});

// ----- videos: up to three per phone -----

const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(16)]);
const MOV = Buffer.concat([Buffer.from([0, 0, 0, 0x14]), Buffer.from("ftypqt  "), Buffer.alloc(16)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(16)]);
const AVIF = Buffer.concat([Buffer.from([0, 0, 0, 0x1c]), Buffer.from("ftypavif"), Buffer.alloc(16)]);
const videoUrl = (name) => "https://res.cloudinary.com/test-cloud/video/upload/" + name + ".mp4";

async function uploadVideo({ mime = "video/mp4", bytes = MP4, userId = admin?._id, field = "video" } = {}) {
  const form = new FormData();
  form.append(field, new Blob([bytes], { type: mime }), "phone-video.mp4");
  const headers = {};
  if (userId) headers.Authorization = "Bearer " + jwt.sign({ id: String(userId) }, process.env.JWT_SECRET);
  const response = await fetch(baseUrl + productPath() + "/videos", { method: "POST", headers, body: form });
  return { status: response.status, body: await response.json() };
}

async function withCloudinaryVideos(fn) {
  const original = { up: cloudinaryImages.uploadProductVideo, del: cloudinaryImages.deleteProductVideo, delImage: cloudinaryImages.deleteProductImage };
  const calls = { uploads: 0, deleted: [], deletedImages: [] };
  cloudinaryImages.uploadProductVideo = async () => {
    const n = ++calls.uploads;
    return { secureUrl: videoUrl("clip" + n), publicId: "krisgen/products/clip" + n };
  };
  cloudinaryImages.deleteProductVideo = async (publicId) => { calls.deleted.push(publicId); return { result: "ok" }; };
  cloudinaryImages.deleteProductImage = async (publicId) => { calls.deletedImages.push(publicId); return { result: "ok" }; };
  try {
    return await fn(calls);
  } finally {
    cloudinaryImages.uploadProductVideo = original.up;
    cloudinaryImages.deleteProductVideo = original.del;
    cloudinaryImages.deleteProductImage = original.delImage;
  }
}

test("a phone can have up to three videos (MP4, MOV or WebM), kept in order and hidden IDs", async () => {
  await withCloudinaryVideos(async (calls) => {
    for (const [mime, bytes] of [["video/mp4", MP4], ["video/quicktime", MOV], ["video/webm", WEBM]]) {
      const response = await uploadVideo({ mime, bytes });
      assert.equal(response.status, 201, mime + ": " + JSON.stringify(response.body));
      assert.equal(Object.hasOwn(response.body.data, "videoPublicIds"), false);
    }
    const saved = await Product.findById(product._id).select("+videoPublicIds");
    assert.deepEqual([...saved.videos], [1, 2, 3].map((n) => videoUrl("clip" + n)));
    assert.deepEqual([...saved.videoPublicIds], [1, 2, 3].map((n) => "krisgen/products/clip" + n));
    assert.deepEqual(saved.images, [], "videos do not use up photo places");

    const fourth = await uploadVideo();
    assert.equal(fourth.status, 409);
    assert.match(fourth.body.message, /at most 3 videos/i);
    assert.equal(calls.uploads, 3, "the fourth is refused before it reaches Cloudinary");

    const publicBody = await (await fetch(baseUrl + "/api/products/" + product._id)).json();
    assert.deepEqual(publicBody.data.videos, saved.videos.map(String));
    assert.equal(Object.hasOwn(publicBody.data, "videoPublicIds"), false, "Cloudinary IDs are never sent to customers");
  });
});

test("video upload refuses non-videos, disguised files, photos sent as video, and non-admins", async () => {
  await withCloudinaryVideos(async (calls) => {
    assert.equal((await uploadVideo({ mime: "image/png", bytes: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) })).status, 400);
    assert.equal((await uploadVideo({ bytes: Buffer.from("this is not a video at all") })).status, 400);
    assert.equal((await uploadVideo({ bytes: AVIF })).status, 400, "an AVIF photo is not a video");
    assert.equal((await uploadVideo({ mime: "video/webm", bytes: MP4 })).status, 400, "type must match the contents");
    assert.equal((await uploadVideo({ field: "image" })).status, 400);
    assert.equal((await uploadVideo({ userId: null })).status, 401);
    assert.equal((await uploadVideo({ userId: (await member("Video Customer"))._id })).status, 403);
    assert.equal(calls.uploads, 0);
    assert.deepEqual((await storedProduct()).videos, []);
  });
});

test("an oversized video is refused with a clear message", async () => {
  const response = await uploadVideo({ bytes: Buffer.concat([MP4, Buffer.alloc(50 * 1024 * 1024)]) });
  assert.equal(response.status, 413);
  assert.match(response.body.message, /50 MB/);
});

test("Cloudinary not set up, or failing, gives a clear message and changes nothing", async () => {
  const saved = { ...process.env };
  delete process.env.CLOUDINARY_CLOUD_NAME;
  try {
    const response = await uploadVideo();
    assert.equal(response.status, 503);
    assert.match(response.body.message, /not configured/);
  } finally {
    Object.assign(process.env, saved);
  }
  const original = cloudinaryImages.uploadProductVideo;
  cloudinaryImages.uploadProductVideo = async () => { throw new Error("provider down"); };
  try {
    const response = await uploadVideo();
    assert.equal(response.status, 502);
    assert.match(response.body.message, /could not store the video/);
  } finally {
    cloudinaryImages.uploadProductVideo = original;
  }
  assert.deepEqual((await storedProduct()).videos, []);
});

test("removing a video keeps the others and tidies Cloudinary; deleting a phone removes its videos", async () => {
  await withCloudinaryVideos(async (calls) => {
    for (let n = 0; n < 3; n++) assert.equal((await uploadVideo()).status, 201);
    const removed = await adminCall("DELETE", productPath() + "/videos/1");
    assert.equal(removed.status, 200);
    assert.deepEqual([...(await storedProduct()).videos], [videoUrl("clip1"), videoUrl("clip3")]);
    assert.deepEqual(calls.deleted, ["krisgen/products/clip2"]);
    for (const bad of ["2", "-1", "abc", "1.5", "123"]) {
      assert.equal((await adminCall("DELETE", productPath() + "/videos/" + bad)).status, 404, bad);
    }

    const deleted = await adminCall("DELETE", productPath() + "/permanent");
    assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
    assert.deepEqual(calls.deleted.sort(), ["krisgen/products/clip1", "krisgen/products/clip2", "krisgen/products/clip3"]);
  });
});

test("videos cannot be set by editing the phone directly", async () => {
  const response = await request("PATCH", productPath(), { videos: [videoUrl("sneaky")] });
  assert.equal(response.status, 400);
  assert.deepEqual((await storedProduct()).videos, []);
});
