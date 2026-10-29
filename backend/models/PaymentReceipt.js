const mongoose = require("mongoose");

// The provider transaction ID is the primary key: uniqueness does not depend on
// autoIndex or on changing historical Order.payment.reference indexes.
const paymentReceiptSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  provider: { type: String, enum: ["flutterwave"], default: "flutterwave" },
  transactionId: { type: String, required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
  reference: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  verifiedAt: { type: Date, required: true },
  status: { type: String, enum: ["received", "fulfilled", "review"], default: "received" },
  resolutionRequired: { type: Boolean, default: true, index: true },
  resolutionReason: { type: String, default: "processing_pending" },
  raw: { type: mongoose.Schema.Types.Mixed, select: false },
}, { timestamps: true });

module.exports = mongoose.model("PaymentReceipt", paymentReceiptSchema);
