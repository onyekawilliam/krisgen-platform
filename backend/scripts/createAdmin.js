// Creates a NEW admin account straight in the database, for example for the
// shop owner. It never changes an account that already exists.
//
//   PowerShell:
//     $env:ADMIN_EMAIL = "owner@example.com"
//     $env:ADMIN_NAME = "Shop Owner"                      (optional)
//     $env:NEW_ADMIN_PASSWORD = "a-temporary-password-12+-characters"
//     node scripts/createAdmin.js --db krisgenDB
//
// Give the person the temporary password privately; they should change it
// themselves on their first login (Admin -> Account). It reads MONGO_URI from
// backend/.env, never prints the password, and only works for an email that has
// no account yet.
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function createAdmin({ email, name, phone, password }) {
  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!emailPattern.test(cleanEmail)) throw new Error("Set ADMIN_EMAIL to a valid email address.");
  if (typeof password !== "string" || password.length < 12 || password.length > 72) {
    throw new Error("Set NEW_ADMIN_PASSWORD to a password of 12 to 72 characters.");
  }
  if (await User.exists({ email: cleanEmail })) {
    throw new Error(`An account with ${cleanEmail} already exists. Nothing was changed.`);
  }
  let referralCode;
  do {
    referralCode = User.generateReferralCode("ADMIN");
  } while (await User.exists({ referralCode }));

  const admin = await User.create({
    name: (typeof name === "string" && name.trim()) || "Krisgen Admin",
    email: cleanEmail,
    phone: (typeof phone === "string" && phone.trim()) || "08035142589",
    passwordHash: password, // hashed by the model's pre-save hook
    role: "admin",
    referralCode,
  });
  return admin.email;
}

async function main() {
  const dbFlag = process.argv.indexOf("--db");
  const dbName = dbFlag > -1 ? process.argv[dbFlag + 1] : undefined;
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set in backend/.env.");
  await mongoose.connect(process.env.MONGO_URI, dbName ? { dbName } : {});
  console.log(`Connected to database: ${mongoose.connection.name}`);
  try {
    const created = await createAdmin({
      email: process.env.ADMIN_EMAIL, name: process.env.ADMIN_NAME,
      phone: process.env.ADMIN_PHONE, password: process.env.NEW_ADMIN_PASSWORD,
    });
    console.log(`Admin account created for ${created}. Share the temporary password privately.`);
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { createAdmin };

if (require.main === module) {
  main().catch(error => {
    console.error(`Failed: ${error.message}`);
    process.exit(1);
  });
}
