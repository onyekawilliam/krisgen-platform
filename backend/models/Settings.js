const mongoose = require("mongoose");
const { validRate, strictNumber, guardNumericUpdates } = require("../utils/numericIntegrity");

// Keep the existing key and document ID: existing settings require no migration.
const settingsSchema = new mongoose.Schema({
  key: { type: String, default: "platform", unique: true },
  directCommissionRate: { type: Number, default: 15, required: true,
    set: strictNumber("directCommissionRate"), validate: { validator: validRate, message: "Direct commission rate must be between 0 and 100" } },
  referralOverrideRate: { type: Number, default: 5, required: true,
    set: strictNumber("referralOverrideRate"), validate: { validator: validRate, message: "Referral override rate must be between 0 and 100" } },
}, { timestamps: true });

guardNumericUpdates(settingsSchema, {
  directCommissionRate: { validate: validRate, message: "Direct commission rate must be between 0 and 100" },
  referralOverrideRate: { validate: validRate, message: "Referral override rate must be between 0 and 100" },
});

let indexReady;
settingsSchema.statics.getSettings = async function ({ session = null } = {}) {
  // Ensure uniqueness even if autoIndex is disabled. This adds no documents and
  // never drops indexes or repairs/deletes existing records.
  if (!indexReady) {
    indexReady = this.collection.createIndex({ key: 1 }, { unique: true })
      .catch(error => { indexReady = null; throw error; });
  }
  await indexReady;
  const existing = await this.findOne({ key: "platform" }).session(session);
  if (existing) return existing;
  try {
    return await this.findOneAndUpdate({ key: "platform" }, { $setOnInsert: {
      key: "platform", directCommissionRate: 15, referralOverrideRate: 5,
      createdAt: new Date(), updatedAt: new Date(),
    } }, { upsert: true, new: true, session, timestamps: false, runValidators: true });
  } catch (error) {
    const singletonCollision = error.code === 11000 &&
      (error.keyPattern?.key === 1 || error.keyValue?.key === "platform");
    if (!singletonCollision) throw error;
    if (session?.inTransaction()) {
      // A duplicate-key error aborts the transaction. Retrying a read in that
      // same transaction is invalid; ask withTransaction to rerun ALL writes.
      error.addErrorLabel("TransientTransactionError");
      throw error;
    }
    const winner = await this.findOne({ key: "platform" });
    if (winner) return winner;
    throw error;
  }
};

module.exports = mongoose.model("Settings", settingsSchema);
