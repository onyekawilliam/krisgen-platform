// Sets a new password for an EXISTING admin account, straight in the database.
// Use it when you are locked out and cannot use the "Forgot your password?" email.
//
//   PowerShell:
//     $env:ADMIN_EMAIL = "you@example.com"
//     $env:NEW_ADMIN_PASSWORD = "a-long-password-of-12-or-more-characters"
//     node scripts/setAdminPassword.js --db krisgenDB
//
// It reads MONGO_URI from backend/.env. --db picks the database inside that
// cluster; leave it out to use whatever database name the URI already names.
// It never creates accounts, only works on role "admin", never prints the
// password, and signs the admin out everywhere else.
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

async function setAdminPassword({ email, password }) {
  if (typeof email !== "string" || !email.trim()) throw new Error("Set ADMIN_EMAIL to the admin's email address.");
  if (typeof password !== "string" || password.length < 12 || password.length > 72) {
    throw new Error("Set NEW_ADMIN_PASSWORD to a password of 12 to 72 characters.");
  }
  const admin = await User.findOne({ email: email.trim().toLowerCase(), role: "admin" }).select("+passwordHash");
  if (!admin) throw new Error(`No admin account found with that email (${email.trim().toLowerCase()}).`);
  admin.passwordHash = password; // hashed by the model's pre-save hook, which also signs out older sessions
  await admin.save();
  return admin.email;
}

async function main() {
  const dbFlag = process.argv.indexOf("--db");
  const dbName = dbFlag > -1 ? process.argv[dbFlag + 1] : undefined;
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set in backend/.env.");
  await mongoose.connect(process.env.MONGO_URI, dbName ? { dbName } : {});
  console.log(`Connected to database: ${mongoose.connection.name}`);
  try {
    const updated = await setAdminPassword({ email: process.env.ADMIN_EMAIL, password: process.env.NEW_ADMIN_PASSWORD });
    console.log(`Password updated for ${updated}. Log in with the new password.`);
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { setAdminPassword };

if (require.main === module) {
  main().catch(error => {
    console.error(`Failed: ${error.message}`);
    process.exit(1);
  });
}
