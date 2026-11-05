const { before, after, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/User");
const { setAdminPassword } = require("../scripts/setAdminPassword");
const { createAdmin } = require("../scripts/createAdmin");

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  await User.init();
}, { timeout: 600000 });

after(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await User.create({ name: "Boss", email: "boss@example.com", phone: "08011112222", passwordHash: "old-password-1",
    role: "admin", referralCode: "BOSS1" });
  await User.create({ name: "Cust", email: "cust@example.com", phone: "08011112222", passwordHash: "customer-pass-1",
    referralCode: "CUST1" });
});

test("sets a new password for an admin and the old one stops working", async () => {
  const updated = await setAdminPassword({ email: " Boss@Example.com ", password: "a-brand-new-password" });
  assert.equal(updated, "boss@example.com");
  const admin = await User.findOne({ email: "boss@example.com" }).select("+passwordHash");
  assert.equal(await admin.comparePassword("a-brand-new-password"), true);
  assert.equal(await admin.comparePassword("old-password-1"), false);
});

test("signs out sessions issued before the change", async () => {
  const admin = await User.findOne({ email: "boss@example.com" });
  const before = Math.floor(Date.now() / 1000) - 30;
  await setAdminPassword({ email: "boss@example.com", password: "a-brand-new-password" });
  const changed = await User.findById(admin._id);
  assert.ok(changed.passwordChangedAt, "passwordChangedAt must be recorded");
  assert.ok(before < Math.floor(changed.passwordChangedAt.getTime() / 1000));
});

test("refuses customers, unknown emails and weak or missing passwords", async () => {
  await assert.rejects(setAdminPassword({ email: "cust@example.com", password: "a-brand-new-password" }), /No admin account/);
  await assert.rejects(setAdminPassword({ email: "nobody@example.com", password: "a-brand-new-password" }), /No admin account/);
  await assert.rejects(setAdminPassword({ email: "boss@example.com", password: "short" }), /12 to 72/);
  await assert.rejects(setAdminPassword({ email: "boss@example.com", password: undefined }), /12 to 72/);
  await assert.rejects(setAdminPassword({ email: undefined, password: "a-brand-new-password" }), /ADMIN_EMAIL/);
  const customer = await User.findOne({ email: "cust@example.com" }).select("+passwordHash");
  assert.equal(await customer.comparePassword("customer-pass-1"), true);
  const admin = await User.findOne({ email: "boss@example.com" }).select("+passwordHash");
  assert.equal(await admin.comparePassword("old-password-1"), true);
});

test("createAdmin makes a new admin with a hashed password and its own referral code", async () => {
  const created = await createAdmin({ email: " Owner@Example.com ", name: "Shop Owner", password: "temporary-password-1" });
  assert.equal(created, "owner@example.com");
  const owner = await User.findOne({ email: "owner@example.com" }).select("+passwordHash");
  assert.equal(owner.role, "admin");
  assert.equal(owner.name, "Shop Owner");
  assert.equal(owner.status, "active");
  assert.ok(owner.referralCode);
  assert.notEqual(owner.passwordHash, "temporary-password-1");
  assert.equal(await owner.comparePassword("temporary-password-1"), true);
});

test("createAdmin never touches an existing account and rejects bad input", async () => {
  await assert.rejects(createAdmin({ email: "boss@example.com", password: "temporary-password-1" }), /already exists/);
  await assert.rejects(createAdmin({ email: "cust@example.com", password: "temporary-password-1" }), /already exists/);
  await assert.rejects(createAdmin({ email: "not-an-email", password: "temporary-password-1" }), /valid email/);
  await assert.rejects(createAdmin({ email: "new@example.com", password: "short" }), /12 to 72/);
  await assert.rejects(createAdmin({ email: "new@example.com" }), /12 to 72/);
  assert.equal(await User.countDocuments({ email: "new@example.com" }), 0);
  const customer = await User.findOne({ email: "cust@example.com" });
  assert.equal(customer.role, "customer");
  const boss = await User.findOne({ email: "boss@example.com" }).select("+passwordHash");
  assert.equal(await boss.comparePassword("old-password-1"), true);
});
