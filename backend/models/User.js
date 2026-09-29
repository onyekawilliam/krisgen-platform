const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    status: { type: String, enum: ["active", "suspended"], default: "active" },

    // Referral identity
    referralCode: { type: String, required: true, unique: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Earnings summary (denormalized for fast dashboard reads; source of truth is Commission collection)
    balance: { type: Number, default: 0 }, // withdrawable, i.e. paid-out-eligible commissions not yet withdrawn

    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash")) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.createPasswordResetToken = function () {
  const rawToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  return rawToken;
};

// Generates a short, unique-enough referral code. Uniqueness is still enforced by
// the schema index; caller should retry on collision (astronomically rare).
userSchema.statics.generateReferralCode = function (name) {
  const prefix = (name || "KRG").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "KRG";
  const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}${suffix}`;
};

module.exports = mongoose.model("User", userSchema);
