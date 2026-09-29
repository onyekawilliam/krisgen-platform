const mongoose = require("mongoose");

// Every field here is a SNAPSHOT taken at the moment the order was paid.
// Later changes to a product's price must never alter an existing commission
// record — that's the whole point of storing these instead of recomputing
// from the live Product document.
const commissionSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },

    // Who earns this specific commission record.
    beneficiary: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // "direct"  = beneficiary made the sale themselves (soldBy on the order)
    // "override" = beneficiary referred the person who made the sale (one hop only)
    type: { type: String, enum: ["direct", "override"], required: true },

    // For override rows, who the direct seller was (informational / audit trail)
    sourceSeller: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    quantity: { type: Number, required: true },
    sellingPriceSnapshot: { type: Number, required: true }, // per unit
    costPriceSnapshot: { type: Number, required: true, select: false }, // per unit, admin only
    grossProfitSnapshot: { type: Number, required: true }, // (selling - cost) * quantity

    commissionRate: { type: Number, required: true }, // percentage applied, e.g. 15 or 5
    commissionAmount: { type: Number, required: true }, // grossProfit * rate

    status: {
      type: String,
      enum: ["pending", "approved", "paid", "cancelled", "reversed"],
      default: "pending",
    },

    // Guards against double-generation if an order webhook fires twice etc.
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Commission", commissionSchema);
