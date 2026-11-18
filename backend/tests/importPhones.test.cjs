const { before, after, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const Product = require("../models/Product");
const { parseCsv, readPhones, importPhones } = require("../scripts/importPhones");

const HEADER = "Name,Brand,Model,Storage,RAM,Camera,Battery,Cost price,Selling price,Stock";
let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  await Product.init();
}, { timeout: 600000 });

after(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

beforeEach(async () => {
  await Product.deleteMany({});
});

test("the shop's list reads cleanly: 30 phones, all waiting for prices", () => {
  const text = fs.readFileSync(path.join(__dirname, "..", "data", "phones.csv"), "utf8");
  const { phones, problems } = readPhones(text);
  assert.deepEqual(problems, []);
  assert.equal(phones.length, 30);
  assert.ok(phones.every((p) => p.sellingPrice == null && p.camera && p.battery && p.storage && p.ram));
  assert.deepEqual(phones.find((p) => p.name === "Redmi Note 15 Pro+"),
    { rowNumber: 26, name: "Redmi Note 15 Pro+", brand: "Redmi", model: "Note 15 Pro+", storage: "256GB", ram: "8GB",
      camera: "200MP", battery: "6500mAh", costPrice: null, sellingPrice: null, stock: null });
});

test("reads spreadsheets the way Excel saves them", () => {
  const rows = parseCsv(`﻿${HEADER}\r\n"Tecno Pop 20",tecno,Pop 20,64GB,4GB,13MP,5000mAh,"₦70,000","85,000",3\r\n\r\n`);
  assert.equal(rows.length, 2);
  const { phones, problems } = readPhones(rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n"));
  assert.deepEqual(problems, []);
  assert.equal(phones[0].brand, "Tecno");
  assert.equal(phones[0].costPrice, 70000);
  assert.equal(phones[0].sellingPrice, 85000);
  assert.equal(phones[0].stock, 3);
});

test("names every bad row and its problem", () => {
  const { phones, problems } = readPhones([
    HEADER,
    "Nokia 3310,Nokia,3310,,,,,1000,2000,1",
    "Tecno Pop 20,Tecno,Pop 20,64GB,4GB,,,90000,80000,1",
    "Tecno Pop 20,Tecno,Pop 20,128GB,4GB,,,70000,,",
    "Tecno Spark 50,Tecno,Spark 50,128GB,4GB,,,abc,90000,2",
    "Itel A200,Itel,A200,64GB,3GB,,,50000,60000,-1",
    "Itel A70,Itel,A70,64GB,3GB,,,,,",
    "itel a70,Itel,a70,64gb,3gb,,,,,",
  ].join("\n"));
  assert.equal(phones.length, 1);
  assert.match(problems[0], /^Row 2 \(Nokia 3310\): brand "Nokia" is not one of/);
  assert.match(problems[1], /^Row 3 .*more than the cost price/);
  assert.match(problems[2], /^Row 4 .*fill in both prices/);
  assert.match(problems[3], /^Row 5 .*not a number/);
  assert.match(problems[4], /^Row 6 .*whole number/);
  assert.match(problems[5], /^Row 8 .*listed twice/);
});

test("preview changes nothing; apply adds priced phones live and unpriced ones hidden", async () => {
  const { phones } = readPhones([
    HEADER,
    "Tecno Pop 20,Tecno,Pop 20,64GB,4GB,13MP,5000mAh,70000,85000,4",
    "Redmi 15C,Redmi,15C,128GB,4GB,50MP,6000mAh,,,",
  ].join("\n"));

  const preview = await importPhones(phones);
  assert.deepEqual(preview.added, ["Tecno Pop 20 64GB 4GB RAM"]);
  assert.deepEqual(preview.addedHidden, ["Redmi 15C 128GB 4GB RAM"]);
  assert.equal(await Product.countDocuments(), 0);

  await importPhones(phones, { apply: true });
  const pop = await Product.findOne({ model: "Pop 20" }).select("+costPrice");
  assert.equal(pop.isActive, true);
  assert.equal(pop.costPrice, 70000);
  assert.equal(pop.sellingPrice, 85000);
  assert.equal(pop.stock, 4);
  assert.equal(pop.specifications.camera, "13MP");
  assert.equal(pop.specifications.battery, "5000mAh");
  const redmi = await Product.findOne({ model: "15C" });
  assert.equal(redmi.isActive, false, "a phone without prices must not be on sale");
  assert.equal(redmi.stock, 0);
});

test("running again never duplicates; filled-in prices update and show a hidden phone", async () => {
  const first = readPhones([HEADER, "Redmi 15C,Redmi,15C,128GB,4GB,50MP,6000mAh,,,", "Itel A200,Itel,A200,64GB,3GB,13MP,5000mAh,,,"].join("\n"));
  await importPhones(first.phones, { apply: true });
  const hidden = await Product.findOne({ model: "A200" });
  hidden.isActive = false; // already hidden, but also set a display spec the owner added by hand
  hidden.specifications.display = "6.6 inch";
  await hidden.save();

  const second = readPhones([HEADER, "Redmi 15C,Redmi,15c,128gb,4gb,50MP,6000mAh,,,", "Itel A200,Itel,A200,64GB,3GB,13MP,5000mAh,\"50,000\",\"62,000\",7"].join("\n"));
  const report = await importPhones(second.phones, { apply: true });
  assert.deepEqual(report.unchanged, ["Redmi 15C 128gb 4gb RAM"], "matched despite different capitals");
  assert.deepEqual(report.updated, ["Itel A200 64GB 3GB RAM"]);
  assert.equal(await Product.countDocuments(), 2);
  const a200 = await Product.findOne({ model: "A200" }).select("+costPrice");
  assert.equal(a200.isActive, true);
  assert.equal(a200.sellingPrice, 62000);
  assert.equal(a200.costPrice, 50000);
  assert.equal(a200.stock, 7);
  assert.equal(a200.specifications.display, "6.6 inch", "specs typed in the admin are kept");
});

test("a priced phone the owner hid on purpose stays hidden when prices change", async () => {
  await Product.create({ name: "Itel A200", brand: "Itel", model: "A200", storage: "64GB", ram: "3GB",
    costPrice: 50000, sellingPrice: 60000, stock: 2, isActive: false });
  const { phones } = readPhones([HEADER, "Itel A200,Itel,A200,64GB,3GB,,,52000,64000,"].join("\n"));
  await importPhones(phones, { apply: true });
  const a200 = await Product.findOne({ model: "A200" });
  assert.equal(a200.isActive, false);
  assert.equal(a200.sellingPrice, 64000);
  assert.equal(a200.stock, 2, "blank stock leaves the stock alone");
});

test("--hide-samples hides only the starter sample phones", async () => {
  await Product.create({ name: "Itel S24", brand: "Itel", model: "S24", costPrice: 1, sellingPrice: 2 });
  await Product.create({ name: "Itel A200", brand: "Itel", model: "A200", costPrice: 1, sellingPrice: 2 });
  const preview = await importPhones([], { hideSamples: true });
  assert.deepEqual(preview.samplesHidden, ["Itel S24"]);
  assert.equal((await Product.findOne({ name: "Itel S24" })).isActive, true);
  await importPhones([], { apply: true, hideSamples: true });
  assert.equal((await Product.findOne({ name: "Itel S24" })).isActive, false);
  assert.equal((await Product.findOne({ name: "Itel A200" })).isActive, true);
});
