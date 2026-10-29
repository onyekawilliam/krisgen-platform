const mongoose = require("mongoose");
const { validStock, validRate, strictNumber, guardNumericUpdates } = require("../utils/numericIntegrity");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    brand: {
      type: String,
      required: true,
      enum: ["Tecno", "Infinix", "Itel", "Viva", "Samsung", "Redmi", "Realme", "Other"],
    },
    model: { type: String, required: true, trim: true },
    images: [{ type: String }],

    ram: { type: String },
    storage: { type: String },
    colors: [{ type: String }],
    specifications: {
      camera: String,
      battery: String,
      display: String,
      processor: String,
      other: String,
    },
    description: { type: String },

    // COST PRICE: never select by default. Only admin-facing queries should
    // explicitly .select('+costPrice'). See productController for enforcement.
    costPrice: { type: Number, required: true, select: false },
    sellingPrice: { type: Number, required: true },

    stock: { type: Number, required: true, default: 0, set: strictNumber("stock"),
      validate: { validator: validStock, message: "Stock must be a non-negative safe whole number" } },
    isActive: { type: Boolean, default: true },

    // Per-product override of the platform default commission rate (percentage, e.g. 15 = 15%)
    commissionRateOverride: {
      type: Number,
      set: strictNumber("commissionRateOverride", true),
      validate: { validator: value => value == null || validRate(value), message: "Commission percentage must be between 0 and 100" },
      default: null,
      min: [0, "Commission percentage cannot be less than 0"],
      max: [100, "Commission percentage cannot be greater than 100"],
    },
  },
  { timestamps: true }
);

guardNumericUpdates(productSchema, {
  stock: { validate: validStock, message: "Stock must be a non-negative safe whole number" },
  commissionRateOverride: { validate: validRate, nullable: true, message: "Commission percentage must be between 0 and 100" },
});

productSchema.index({ brand: 1, isActive: 1 });
productSchema.index({ name: "text", model: "text", description: "text" });

// Safety net: even if a query accidentally includes costPrice, strip it before
// sending to a non-admin. Controllers are the primary guard; this is defense in depth.
productSchema.methods.toCustomerJSON = function () {
  const obj = this.toObject();
  delete obj.costPrice;
  return obj;
};

module.exports = mongoose.model("Product", productSchema);
