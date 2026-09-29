const mongoose = require("mongoose");

// One row per referrer -> referred relationship, created once at registration
// and kept permanently. This is the ONLY placement concept in the platform —
// there is no matrix, no levels, no spillover. Overrides (see Commission.js)
// look up this single relationship one hop, never more.
const referralSchema = new mongoose.Schema(
  {
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    referred: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Referral", referralSchema);
