// Adds the shop's phones from a spreadsheet (data/phones.csv) in one go.
//
//   PowerShell, from the backend folder:
//     node scripts/importPhones.js --db krisgenDB --remove-samples            (preview only, changes nothing)
//     node scripts/importPhones.js --db krisgenDB --remove-samples --apply    (saves the changes)
//
// Open data/phones.csv in Excel, fill in Cost price, Selling price and Stock, and
// save it as CSV. A phone with both prices goes live in the shop; one with blank
// prices is added hidden, so it can be priced later in Admin -> Products or by
// filling the spreadsheet in and running this again.
//
// Running it again is safe: a phone already in the shop (same brand, model,
// storage and RAM) is never added twice. If its row now has prices, the prices,
// stock, camera and battery are updated. Nothing is ever deleted.
//
// --remove-samples deletes the 8 sample phones the site started with. A sample
// that was ever ordered, or has photos, is hidden instead (delete it in Admin ->
// Products, which also removes its photos).
// It reads MONGO_URI from backend/.env, like setAdminPassword.js.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const { isInSalesHistory } = require("../utils/salesHistory");

const BRANDS = Product.schema.path("brand").enumValues;
const SAMPLE_NAMES = ["Tecno Camon 30 Pro", "Tecno Spark 20", "Infinix Note 40 Pro", "Infinix Hot 40i", "Itel S24",
  "Itel A70", "Viva V30 Elite", "Viva V15 Lite"];

const COLUMNS = {
  name: "name", brand: "brand", model: "model", storage: "storage", ram: "ram", camera: "camera",
  battery: "battery", "cost price": "costPrice", "selling price": "sellingPrice", stock: "stock",
};

// Reads CSV as Excel saves it: optional BOM, CRLF, quoted fields with "" escapes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

// "₦150,000" or "150000" -> 150000; blank -> null; anything else -> NaN.
function money(value) {
  const cleaned = value.replace(/[₦,\s]/g, "").replace(/^N(?=\d)/i, "");
  if (!cleaned) return null;
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : NaN;
}

// Turns spreadsheet text into phones, or a list of problems naming each row.
function readPhones(text) {
  const [header, ...lines] = parseCsv(text);
  if (!header) throw new Error("The spreadsheet is empty.");
  const keys = header.map((h) => COLUMNS[h.trim().toLowerCase()]);
  for (const needed of ["name", "brand", "model"]) {
    if (!keys.includes(needed)) throw new Error(`The spreadsheet needs a "${needed}" column.`);
  }

  const phones = [];
  const problems = [];
  const seen = new Set();
  lines.forEach((cells, index) => {
    const rowNumber = index + 2; // as Excel numbers it, counting the header
    const raw = {};
    keys.forEach((key, i) => { if (key) raw[key] = (cells[i] || "").trim(); });
    const brand = BRANDS.find((b) => b.toLowerCase() === (raw.brand || "").toLowerCase());
    const costPrice = money(raw.costPrice || "");
    const sellingPrice = money(raw.sellingPrice || "");
    const stock = raw.stock ? Number(raw.stock.replace(/,/g, "")) : null;
    const rowProblems = [];

    if (!raw.name) rowProblems.push("the name is blank");
    if (!raw.model) rowProblems.push("the model is blank");
    if (!brand) rowProblems.push(`brand "${raw.brand}" is not one of ${BRANDS.join(", ")}`);
    if (Number.isNaN(costPrice) || Number.isNaN(sellingPrice)) rowProblems.push("a price is not a number");
    else if ((costPrice == null) !== (sellingPrice == null)) rowProblems.push("fill in both prices, or leave both blank");
    else if (sellingPrice != null && !(sellingPrice > costPrice)) rowProblems.push("the selling price must be more than the cost price");
    if (stock != null && !(Number.isSafeInteger(stock) && stock >= 0)) rowProblems.push("stock must be a whole number, 0 or more");

    const key = [brand, raw.model, raw.storage, raw.ram].map((v) => (v || "").toLowerCase()).join("|");
    if (seen.has(key)) rowProblems.push("the same phone (brand, model, storage, RAM) is listed twice");
    seen.add(key);

    if (rowProblems.length) problems.push(`Row ${rowNumber} (${raw.name || "no name"}): ${rowProblems.join("; ")}`);
    else phones.push({
      rowNumber, name: raw.name, brand, model: raw.model, storage: raw.storage || "", ram: raw.ram || "",
      camera: raw.camera || "", battery: raw.battery || "", costPrice, sellingPrice, stock,
    });
  });
  return { phones, problems };
}

const sameText = (value) => new RegExp(`^${(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
const label = (p) => [p.name, p.storage, p.ram && `${p.ram} RAM`].filter(Boolean).join(" ");

// Works out (and with apply: true, makes) the changes. Returns what happened.
async function importPhones(phones, { apply = false, removeSamples = false } = {}) {
  const report = { added: [], addedHidden: [], updated: [], unchanged: [], samplesRemoved: [], samplesHidden: [] };

  for (const p of phones) {
    const existing = await Product.findOne({
      brand: p.brand, model: sameText(p.model), storage: sameText(p.storage), ram: sameText(p.ram),
    }).select("+costPrice");
    const priced = p.sellingPrice != null;
    const specifications = { ...(existing?.toObject().specifications || {}),
      ...(p.camera && { camera: p.camera }), ...(p.battery && { battery: p.battery }) };

    if (!existing) {
      if (apply) {
        await Product.create({
          name: p.name, brand: p.brand, model: p.model, storage: p.storage, ram: p.ram, specifications,
          costPrice: priced ? p.costPrice : 0, sellingPrice: priced ? p.sellingPrice : 0,
          stock: p.stock ?? 0, isActive: priced,
        });
      }
      (priced ? report.added : report.addedHidden).push(label(p));
    } else if (priced) {
      if (apply) {
        // A phone first added without prices is shown once it has them; one the
        // owner hid on purpose stays hidden.
        if (!(existing.sellingPrice > 0)) existing.isActive = true;
        existing.costPrice = p.costPrice;
        existing.sellingPrice = p.sellingPrice;
        if (p.stock != null) existing.stock = p.stock;
        existing.specifications = specifications;
        await existing.save();
      }
      report.updated.push(label(p));
    } else {
      report.unchanged.push(label(p));
    }
  }

  if (removeSamples) {
    for (const s of await Product.find({ name: { $in: SAMPLE_NAMES } })) {
      if (s.images?.length || await isInSalesHistory(s._id)) {
        if (!s.isActive) continue;
        if (apply) { s.isActive = false; await s.save(); }
        report.samplesHidden.push(s.name);
      } else {
        if (apply) await Product.deleteOne({ _id: s._id });
        report.samplesRemoved.push(s.name);
      }
    }
  }
  return report;
}

function printReport(report, apply) {
  const will = apply ? "" : "would be ";
  const section = (title, list) => {
    if (!list.length) return;
    console.log(`\n${title} (${list.length}):`);
    for (const item of list) console.log(`  - ${item}`);
  };
  section(`${apply ? "Added" : "Would add"} and shown in the shop`, report.added);
  section(`${apply ? "Added" : "Would add"} hidden, waiting for prices`, report.addedHidden);
  section(`${apply ? "Updated" : "Would update"} prices and stock`, report.updated);
  section("Already in the shop, left as they are", report.unchanged);
  section(`Sample phones ${will}deleted`, report.samplesRemoved);
  section(`Sample phones ${will}hidden (ordered before or has photos, so not deleted)`, report.samplesHidden);
  console.log(apply ? "\nDone." : "\nNothing was changed. Run again with --apply to save these changes.");
}

async function main() {
  const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; };
  const apply = process.argv.includes("--apply");
  const known = new Set(["--apply", "--remove-samples", "--db", "--file"]);
  const unknown = process.argv.slice(2).filter((a, i, all) => a.startsWith("--") && !known.has(a) && !["--db", "--file"].includes(all[i - 1]));
  if (unknown.length) throw new Error(`Unknown option ${unknown.join(", ")}. Use --apply, --remove-samples, --db or --file.`);
  const file = path.resolve(arg("--file") || path.join(__dirname, "..", "data", "phones.csv"));
  const { phones, problems } = readPhones(fs.readFileSync(file, "utf8"));
  if (problems.length) {
    console.error(`Nothing was changed. Fix these rows in ${file} first:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set in backend/.env.");
  const dbName = arg("--db");
  await mongoose.connect(process.env.MONGO_URI, dbName ? { dbName } : {});
  console.log(`Connected to database: ${mongoose.connection.name}`);
  try {
    printReport(await importPhones(phones, { apply, removeSamples: process.argv.includes("--remove-samples") }), apply);
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { parseCsv, readPhones, importPhones };

if (require.main === module) {
  main().catch((error) => {
    console.error(`Failed: ${error.message}`);
    process.exit(1);
  });
}
