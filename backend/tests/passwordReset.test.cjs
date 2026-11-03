const { before, after, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/User");
const mailer = require("../services/emailService");
const errorHandler = require("../middlewares/errorHandler");

process.env.JWT_SECRET = "isolated-password-reset-secret";
process.env.CLIENT_URL = "https://shop.example.com/";

// The mail provider is replaced: nothing here sends a real email.
let sent;
let sendBehaviour;
mailer.isConfigured = () => true;
mailer.sendEmail = async message => {
  if (sendBehaviour === "fail") throw new Error("provider down");
  sent.push(message);
};

let replSet;
let server;
let baseUrl;
let user;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  await User.init();
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", require("../routes/authRoutes"));
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
  sent = [];
  sendBehaviour = "ok";
  await User.deleteMany({});
  user = await User.create({ name: "Ada <b>Obi</b>", email: "ada@example.com", phone: "08012345678",
    passwordHash: "old-password-1", referralCode: "ADA1" });
});

async function call(method, path, body, token) {
  const response = await fetch(baseUrl + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function waitForEmail() {
  for (let i = 0; i < 50 && !sent.length; i++) await new Promise(r => setTimeout(r, 20));
  return sent[0];
}

async function requestReset(email = "ada@example.com") {
  const response = await call("POST", "/api/auth/forgot-password", { email });
  const message = await waitForEmail();
  const token = message && new URL(message.text.match(/https?:\/\/\S+/)[0]).searchParams.get("token");
  return { response, message, token };
}

test("a reset email goes to the account holder with a one-hour link to the frontend", async () => {
  const { response, message, token } = await requestReset();
  assert.equal(response.status, 200);
  assert.equal(sent.length, 1);
  assert.deepEqual(message.to, "ada@example.com");
  assert.match(message.text, /^Hello Ada <b>Obi<\/b>,/);
  assert.ok(message.text.includes("https://shop.example.com/reset-password?token="), message.text);
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.ok(message.html.includes("&lt;b&gt;Obi&lt;/b&gt;"), "name must be HTML-escaped");
  assert.equal(JSON.stringify(response.body).includes(token), false, "the token must never be in the API response");
  const stored = await User.findById(user._id).select("+passwordResetToken +passwordResetExpires");
  assert.notEqual(stored.passwordResetToken, token, "only a hash of the token is stored");
  assert.ok(stored.passwordResetExpires.getTime() - Date.now() <= 60 * 60 * 1000);
});

test("asking about an unknown address looks identical and sends nothing", async () => {
  const known = await requestReset();
  sent = [];
  const unknown = await call("POST", "/api/auth/forgot-password", { email: "nobody@example.com" });
  await new Promise(r => setTimeout(r, 150));
  assert.equal(sent.length, 0);
  assert.equal(unknown.status, known.response.status);
  assert.deepEqual(unknown.body, known.response.body);
});

test("a mail provider failure does not change the answer or break the request", async () => {
  sendBehaviour = "fail";
  const response = await call("POST", "/api/auth/forgot-password", { email: "ada@example.com" });
  assert.equal(response.status, 200);
  assert.equal(response.body.message, "If that account exists, a reset link has been sent.");
});

test("the emailed token sets a new password once, and only once", async () => {
  const { token } = await requestReset();
  const reset = await call("POST", "/api/auth/reset-password", { token, newPassword: "brand-new-pass-2" });
  assert.equal(reset.status, 200);
  assert.equal((await call("POST", "/api/auth/login", { email: "ada@example.com", password: "old-password-1" })).status, 401);
  assert.equal((await call("POST", "/api/auth/login", { email: "ada@example.com", password: "brand-new-pass-2" })).status, 200);
  const again = await call("POST", "/api/auth/reset-password", { token, newPassword: "another-pass-3" });
  assert.equal(again.status, 400);
  assert.equal((await call("POST", "/api/auth/login", { email: "ada@example.com", password: "brand-new-pass-2" })).status, 200);
});

test("wrong, expired and malformed tokens are rejected", async () => {
  const { token } = await requestReset();
  for (const bad of ["0".repeat(64), token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"), "", { $ne: null }, ["x"]]) {
    const response = await call("POST", "/api/auth/reset-password", { token: bad, newPassword: "brand-new-pass-2" });
    assert.equal(response.status, 400, JSON.stringify(bad));
  }
  await User.updateOne({ _id: user._id }, { passwordResetExpires: new Date(Date.now() - 1000) });
  assert.equal((await call("POST", "/api/auth/reset-password", { token, newPassword: "brand-new-pass-2" })).status, 400);
  assert.equal((await call("POST", "/api/auth/login", { email: "ada@example.com", password: "old-password-1" })).status, 200);
});

test("resetting the password signs out sessions issued before it", async () => {
  const stolen = jwt.sign({ id: String(user._id), iat: Math.floor(Date.now() / 1000) - 30 }, process.env.JWT_SECRET);
  assert.equal((await call("GET", "/api/auth/me", undefined, stolen)).status, 200);

  const { token } = await requestReset();
  assert.equal((await call("POST", "/api/auth/reset-password", { token, newPassword: "brand-new-pass-2" })).status, 200);

  const rejected = await call("GET", "/api/auth/me", undefined, stolen);
  assert.equal(rejected.status, 401);
  const login = await fetch(baseUrl + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ada@example.com", password: "brand-new-pass-2" }) });
  assert.equal(login.status, 200);
  const fresh = login.headers.get("set-cookie").match(/krisgen_token=([^;]+)/)[1];
  assert.equal((await call("GET", "/api/auth/me", undefined, fresh)).status, 200);
});

test("registering a new account does not invalidate anyone's session", async () => {
  const token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET);
  assert.equal((await call("GET", "/api/auth/me", undefined, token)).status, 200);
  const stored = await User.findById(user._id);
  assert.equal(stored.passwordChangedAt, null);
});
