// Run from backend: npm run e2e:local [-- --serve]
// All writes are restricted to a newly created loopback MongoMemoryReplSet.
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { chromium } = require("playwright");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Referral = require("../models/Referral");
const Commission = require("../models/Commission");
const Settings = require("../models/Settings");
const PaymentReceipt = require("../models/PaymentReceipt");
const Withdrawal = require("../models/Withdrawal");
const backend = path.resolve(__dirname, "..");
const frontend = path.resolve(backend, "../frontend");
const keepServing = process.argv.includes("--serve");
let replica;
let browser;
const children = [];
const checks = [];
const unhandled = [];
let report;

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
function start(args, cwd, overrides) {
  const child = spawn(process.execPath, args, { cwd, windowsHide: true,
    env: { ...process.env, ...overrides }, stdio: ["ignore", "pipe", "pipe"] });
  // Never forward server logs: dotenv/provider errors may contain configuration.
  child.output = "";
  child.stdout.on("data", chunk => { child.output += chunk.toString(); });
  child.stderr.on("data", chunk => { child.output += chunk.toString(); });
  children.push(child);
  return child;
}
async function waitFor(url, child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error("Local test server exited before becoming ready");
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error("Local test server did not become ready within 30 seconds");
}
async function check(name, run) { await run(); checks.push(name); console.log("PASS " + name); }
async function cleanup() {
  if (browser) await browser.close().catch(() => {});
  for (const child of children) child.kill();
  await mongoose.disconnect().catch(() => {});
  if (replica) await replica.stop();
}

(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const dbName = "krisgen_e2e_" + crypto.randomUUID().replaceAll("-", "");
  const uri = replica.getUri(dbName);
  const uriParts = new URL(uri);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(uriParts.hostname));
  assert.ok(dbName.startsWith("krisgen_e2e_"));
  await mongoose.connect(uri);
  assert.equal(mongoose.connection.db.databaseName, dbName);
  for (const collection of await mongoose.connection.db.listCollections().toArray()) {
    assert.equal(await mongoose.connection.db.collection(collection.name).countDocuments(), 0);
  }
  console.log("ISOLATION CONFIRMED: fresh loopback replica set; no application database used");
  for (const model of [User, Product, Order, Referral, Commission, Settings, PaymentReceipt, Withdrawal]) await model.init();
  const password = "Krisgen-local-test-only-2026";
  const member = (name, role = "customer", referredBy = null) => User.create({
    name, email: name.toLowerCase() + "@e2e.invalid", passwordHash: password,
    phone: "08000000000", referralCode: "E2E" + name.toUpperCase(), role, referredBy,
  });
  const parent = await member("Parent");
  const seller = await member("Seller", "customer", parent._id);
  const buyer = await member("Buyer", "customer", seller._id);
  const admin = await member("Admin", "admin");
  await Referral.create([{ referrer: parent._id, referred: seller._id }, { referrer: seller._id, referred: buyer._id }]);
  const product = await Product.create({ name: "E2E Phone", brand: "Samsung", model: "Local Test",
    sellingPrice: 150000, costPrice: 100000, stock: 8 });
  await Settings.getSettings();
  const reviewOrder = await Order.create({ orderNumber: "E2E-PAYMENT-REVIEW", buyer: buyer._id,
    totalAmount: 150000, status: "payment_review", items: [{ product: product._id, name: product.name,
      quantity: 1, sellingPriceSnapshot: 150000, costPriceSnapshot: 100000 }],
    payment: { verified: true, transactionId: "90001", resolutionRequired: true,
      resolutionReason: "stock_unavailable", reference: "E2E-REVIEW-ONLY" } });
  await PaymentReceipt.create({ _id: "flutterwave:90001", transactionId: "90001", order: reviewOrder._id,
    reference: "E2E-REVIEW-ONLY", amount: 150000, currency: "NGN", verifiedAt: new Date(),
    status: "review", resolutionRequired: true, resolutionReason: "stock_unavailable" });
  const apiPort = await freePort();
  const webPort = await freePort();
  const apiUrl = "http://localhost:" + apiPort + "/api";
  const webUrl = "http://localhost:" + webPort;
  const apiChild = start(["-e", 'require("./services/paymentService").verifyFlutterwaveTransaction = async () => { throw new Error("External payment calls disabled in local E2E"); }; require("./server.js");'], backend, {
    MONGO_URI: uri, PORT: String(apiPort), CLIENT_URL: webUrl, NODE_ENV: "test",
    JWT_SECRET: "isolated-browser-e2e-secret", COOKIE_NAME: "krisgen_e2e_token", JWT_EXPIRES_IN: "1h",
    FLW_SECRET_KEY: "isolated-unused", FLW_VERIFY_URL: "https://payments.invalid",
  });
  const webChild = start([path.join(frontend, "node_modules/vite/bin/vite.js"), "--host", "localhost",
    "--port", String(webPort), "--strictPort"], frontend, {
    VITE_API_URL: apiUrl, VITE_FLW_PUBLIC_KEY: "FLWPUBK_TEST-LOCAL-UNUSED", NODE_ENV: "development",
  });
  await waitFor(apiUrl + "/health", apiChild);
  await waitFor(webUrl, webChild);
  const executablePath = [process.env.KRISGEN_TEST_BROWSER,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(file => file && fs.existsSync(file));
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  // Browser requests may target ONLY the two isolated local servers. This also
  // prevents accidental live API/payment calls if a frontend URL regresses.
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if ([webUrl, new URL(apiUrl).origin].includes(url.origin)) return route.continue();
    return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
  });
  const page = await context.newPage();
  page.on("pageerror", error => unhandled.push(error.message));
  await check("frontend and backend start with isolated configuration", async () => {
    await page.goto(webUrl + "/login");
    await page.getByRole("heading", { name: "Log in", exact: true }).waitFor();
  });
  await check("admin login works across ports with HTTP-only cookies and CORS", async () => {
    await page.locator('input[type="email"]').fill(admin.email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
    assert.ok((await context.cookies(apiUrl)).some(cookie => cookie.name === "krisgen_e2e_token" && cookie.httpOnly));
  });
  await check("payment review count is visible on the admin overview", async () => {
    await page.getByRole("link", { name: /Payments awaiting review/ }).waitFor();
    const response = await context.request.get(apiUrl + "/admin/stats");
    assert.equal(response.status(), 200);
    assert.equal((await response.json()).data.paymentReviewCount, 1);
  });
  await page.getByRole("link", { name: "Orders", exact: true }).click();
  await check("review status, receipt panel and filter render correctly", async () => {
    await page.getByRole("heading", { name: "Payments awaiting review" }).waitFor();
    await page.getByText("E2E-PAYMENT-REVIEW · Transaction 90001").waitFor();
    await page.locator("table tbody tr").filter({ hasText: "E2E-PAYMENT-REVIEW" }).getByText("payment review", { exact: true }).waitFor();
    await page.locator("select").first().selectOption("payment_review");
    await page.locator("table tbody tr").filter({ hasText: "E2E-PAYMENT-REVIEW" }).waitFor();
    assert.equal(await page.locator("table tbody tr").count(), 1);
    await page.locator("select").first().selectOption("");
  });
  await check("product and member endpoints match the form contracts", async () => {
    const productsResponse = await context.request.get(apiUrl + "/products/admin/all");
    const membersResponse = await context.request.get(apiUrl + "/admin/members");
    const products = (await productsResponse.json()).data;
    const members = (await membersResponse.json()).data;
    assert.equal(productsResponse.status(), 200);
    assert.equal(membersResponse.status(), 200);
    assert.ok(Array.isArray(products) && Array.isArray(members));
    assert.equal(typeof products[0].stock, "number");
    assert.equal(typeof products[0].sellingPrice, "number");
    assert.equal(members.find(member => member._id === String(buyer._id)).referredBy.name, "Seller");
  });
  const field = (form, label, control) => form.locator("label").filter({ hasText: new RegExp("^" + label + "$") }).locator("..").locator(control);
  async function record({ registered = false, referrer = false, quantity = 1, payment = "cash", name = "E2E Walk In" } = {}) {
    await page.getByRole("button", { name: "+ Record In-Store Sale" }).click();
    const form = page.locator("form");
    await field(form, "Customer Type", "select").selectOption(registered ? "registered" : "walk_in");
    if (registered) {
      await field(form, "Select Registered Customer", "select").selectOption(String(buyer._id));
      await page.getByText("Seller: Seller", { exact: true }).waitFor();
    } else {
      await field(form, "Customer Name", "input").fill(name);
      await field(form, "Phone Number", "input").fill("08000000001");
      if (referrer) await field(form, "Referrer \\(Optional\\)", "select").selectOption(String(seller._id));
    }
    await field(form, "Phone/Product", "select").selectOption(String(product._id));
    await field(form, "Quantity", "input").fill(String(quantity));
    await field(form, "Payment Method", "select").selectOption(payment);
    const sent = page.waitForResponse(response => response.url() === apiUrl + "/admin/orders/in-store" && response.request().method() === "POST");
    await page.getByRole("button", { name: "Record Sale", exact: true }).click();
    const response = await sent;
    assert.equal(response.status(), 201, await response.text());
    const order = (await response.json()).data;
    await page.getByRole("status").filter({ hasText: order.orderNumber }).waitFor();
    await page.locator("table tbody tr").filter({ hasText: order.orderNumber }).waitFor();
    return order;
  }
  let lastOrder;
  await check("walk-in sale updates order list and stock without creating an account or commissions", async () => {
    lastOrder = await record();
    assert.equal((await Product.findById(product._id)).stock, 7);
    assert.equal(await User.countDocuments(), 4);
    assert.equal(await Commission.countDocuments(), 0);
    assert.equal((await Order.findById(lastOrder._id)).buyer, null);
  });
  await check("registered sale preserves referral and creates profit commissions once", async () => {
    lastOrder = await record({ registered: true, quantity: 2, payment: "pos" });
    assert.equal((await Product.findById(product._id)).stock, 5);
    assert.equal(String(lastOrder.soldBy), String(seller._id));
    const direct = await Commission.findOne({ order: lastOrder._id, type: "direct" });
    const override = await Commission.findOne({ order: lastOrder._id, type: "override" });
    assert.equal(direct.commissionAmount, 15000);
    assert.equal(override.commissionAmount, 5000);
    assert.equal(await Commission.countDocuments({ order: lastOrder._id }), 2);
  });
  await check("walk-in optional referrer and transfer payment work", async () => {
    lastOrder = await record({ referrer: true, payment: "transfer", name: "E2E Referred Walk In" });
    assert.equal((await Product.findById(product._id)).stock, 4);
    assert.equal(await Commission.countDocuments({ order: lastOrder._id }), 2);
  });
  await check("inventory and commission admin pages reflect the recorded sales", async () => {
    await page.getByRole("link", { name: "Products", exact: true }).click();
    await page.locator("table tbody tr").filter({ hasText: "E2E Phone" }).waitFor();
    assert.equal((await context.request.get(apiUrl + "/products/admin/all")).status(), 200);
    const row = page.locator("table tbody tr").filter({ hasText: "E2E Phone" });
    assert.equal((await row.locator("td").nth(6).innerText()).trim(), "4");
    await page.getByRole("link", { name: "Commissions", exact: true }).click();
    await page.locator("table tbody tr").nth(3).waitFor();
    assert.equal(await page.locator("table tbody tr").count(), 4);
  });
  await check("order-status API failures show an error without an unhandled rejection", async () => {
    await page.getByRole("link", { name: "Orders", exact: true }).click();
    const pattern = "**/api/orders/admin/*/status";
    await page.route(pattern, route => route.request().method() === "OPTIONS" ? route.continue() : route.fulfill({ status: 409, contentType: "application/json",
      headers: { "access-control-allow-origin": webUrl, "access-control-allow-credentials": "true" },
      body: JSON.stringify({ success: false, message: "E2E status conflict: refresh before retrying" }) }));
    await page.locator("table tbody tr").filter({ hasText: lastOrder.orderNumber }).getByRole("button", { name: "Mark processing" }).click();
    await page.getByRole("alert").filter({ hasText: "E2E status conflict" }).waitFor();
    await page.unroute(pattern);
    assert.equal((await Order.findById(lastOrder._id)).status, "paid");
  });
  await check("dashboard statistics failures are displayed and recover on reload", async () => {
    const pattern = "**/api/admin/stats";
    await page.route(pattern, route => route.fulfill({ status: 503, contentType: "application/json",
      headers: { "access-control-allow-origin": webUrl, "access-control-allow-credentials": "true" }, body: "{}" }));
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Could not load dashboard statistics" }).waitFor();
    await page.unroute(pattern);
    await page.reload();
    await page.getByRole("link", { name: /Payments awaiting review/ }).waitFor();
  });
  await check("admin dashboard and sales form have no unhandled JavaScript errors", async () => {
    assert.deepEqual(unhandled, []);
  });
  report = { passed: checks.length, failed: 0, checks, isolated: true, externalPaymentsDisabled: true,
    website: webUrl, api: apiUrl, loginEmail: admin.email, loginPassword: password };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  browser = null;
  if (keepServing) {
    console.log("ISOLATED MANUAL TEST SITE READY; stop this process to remove the temporary environment");
    await new Promise(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
  }
})().catch(error => {
  console.error("E2E FAILED: " + error.message);
  process.exitCode = 1;
}).finally(cleanup);
