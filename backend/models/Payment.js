const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    provider: { type: String, default: "flutterwave" },
    reference: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "NGN" },
    status: { type: String, enum: ["initiated", "successful", "failed"], default: "initiated" },
    providerResponse: { type: mongoose.Schema.Types.Mixed, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
