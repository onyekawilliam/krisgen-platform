const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true }, // snapshot of product name at time of order
    quantity: { type: Number, required: true, min: 1 },
    sellingPriceSnapshot: { type: Number, required: true }, // per unit, at time of order
    costPriceSnapshot: { type: Number, required: true, select: false }, // per unit — admin only
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // The affiliate who gets direct-sale commission on this order, if any.
    // Set when the buyer checked out through an affiliate's sale link, OR
    // when the buyer themself is an affiliate selling to a walk-in and
    // records the sale on their own behalf. Null = plain customer purchase,
    // no commission generated at all.
    soldBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    items: [orderItemSchema],

    totalAmount: { type: Number, required: true }, // sum of sellingPriceSnapshot * quantity

    status: {
      type: String,
      enum: ["pending_payment", "paid", "processing", "delivered", "cancelled", "refunded"],
      default: "pending_payment",
    },

    payment: {
      provider: { type: String, default: "flutterwave" },
      reference: { type: String, index: true },
      verified: { type: Boolean, default: false },
      verifiedAt: { type: Date },
      raw: { type: mongoose.Schema.Types.Mixed, select: false }, // provider response, admin-only
    },

    shippingAddress: {
      fullName: String,
      phone: String,
      address: String,
      city: String,
      state: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
