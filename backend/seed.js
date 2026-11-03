// Run with: node seed.js
// Creates the initial admin account and a handful of sample phones so the
// platform isn't empty on first run. Safe to re-run — skips what exists.
require("dotenv").config();

// Some networks cannot resolve mongodb+srv records. Opt in with e.g.
// DNS_SERVERS=8.8.8.8,8.8.4.4 rather than overriding DNS for everyone.
if (process.env.DNS_SERVERS) require("dns").setServers(process.env.DNS_SERVERS.split(",").map(s => s.trim()));

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Product = require("./models/Product");

const sampleProducts = [
  { name: "Tecno Camon 30 Pro", brand: "Tecno", model: "Camon 30 Pro", ram: "8GB", storage: "256GB", costPrice: 330000, sellingPrice: 385000, stock: 12, specifications: { camera: "108MP" } },
  { name: "Tecno Spark 20", brand: "Tecno", model: "Spark 20", ram: "6GB", storage: "128GB", costPrice: 140000, sellingPrice: 165000, stock: 20, specifications: { camera: "50MP" } },
  { name: "Infinix Note 40 Pro", brand: "Infinix", model: "Note 40 Pro", ram: "8GB", storage: "256GB", costPrice: 255000, sellingPrice: 295000, stock: 15, specifications: { camera: "108MP" } },
  { name: "Infinix Hot 40i", brand: "Infinix", model: "Hot 40i", ram: "4GB", storage: "128GB", costPrice: 98000, sellingPrice: 115000, stock: 25, specifications: { camera: "50MP" } },
  { name: "Itel S24", brand: "Itel", model: "S24", ram: "4GB", storage: "128GB", costPrice: 80000, sellingPrice: 95000, stock: 30, specifications: { camera: "50MP" } },
  { name: "Itel A70", brand: "Itel", model: "A70", ram: "3GB", storage: "64GB", costPrice: 52000, sellingPrice: 62000, stock: 18, specifications: { camera: "Entry level" } },
  { name: "Viva V30 Elite", brand: "Viva", model: "V30 Elite", ram: "12GB", storage: "512GB", costPrice: 1020000, sellingPrice: 1200000, stock: 5, specifications: { camera: "Flagship" } },
  { name: "Viva V15 Lite", brand: "Viva", model: "V15 Lite", ram: "6GB", storage: "128GB", costPrice: 178000, sellingPrice: 210000, stock: 14, specifications: { camera: "Mid-range" } },
];

async function seed() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error("Set SEED_ADMIN_PASSWORD (at least 12 characters) before seeding; there is no default admin password.");
  }
  await connectDB();

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@krisgen.com";
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    let referralCode;
    do {
      referralCode = User.generateReferralCode("ADMIN");
    } while (await User.findOne({ referralCode }));

    await User.create({
      name: "Krisgen Admin",
      email: adminEmail,
      phone: "08035142589",
      passwordHash: adminPassword,
      role: "admin",
      referralCode,
    });
    console.log(`Admin created: ${adminEmail}`);
  } else {
    console.log("Admin already exists, skipping.");
  }

  for (const p of sampleProducts) {
    const exists = await Product.findOne({ name: p.name });
    if (!exists) {
      await Product.create(p);
      console.log(`Product created: ${p.name}`);
    }
  }

  console.log("Seed complete.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
