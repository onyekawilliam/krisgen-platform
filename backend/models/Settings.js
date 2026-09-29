const mongoose = require("mongoose");

// Singleton document holding platform-wide configuration admins can change
// without a redeploy — chiefly the commission rates referenced in
// services/commissionService.js. There is deliberately no matrix
// configuration here; the referral model is a single-hop override only.
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "platform", unique: true },
    directCommissionRate: { type: Number, default: 15 }, // % of gross profit, seller earns
    referralOverrideRate: { type: Number, default: 5 }, // % of gross profit, referrer earns
  },
  { timestamps: true }
);

settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ key: "platform" });
  if (!settings) settings = await this.create({ key: "platform" });
  return settings;
};

module.exports = mongoose.model("Settings", settingsSchema);
