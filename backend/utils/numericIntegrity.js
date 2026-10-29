const mongoose = require("mongoose");
const ApiError = require("./ApiError");

const validStock = value => Number.isSafeInteger(value) && value >= 0;
const validRate = value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;

function strictNumber(path, nullable = false) {
  return value => {
    if (value === undefined || (nullable && value === null)) return value;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new mongoose.Error.CastError("Number", value, path);
    }
    return value;
  };
}

// Mongoose's normal update validators skip $inc. Validate update inputs before
// casting, and guard the resulting stock value atomically in the write filter.
function guardNumericUpdates(schema, rules) {
  schema.pre(["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"], function () {
    this.setOptions({ runValidators: true, context: "query" });
    const update = this.getUpdate();
    if (Array.isArray(update)) throw new ApiError(400, "Pipeline updates are not supported for inventory or commission settings");
    if (!update) return;
    for (const [operatorOrPath, contents] of Object.entries(update)) {
      const operator = operatorOrPath.startsWith("$") ? operatorOrPath : "$set";
      const changes = operatorOrPath.startsWith("$") ? contents : { [operatorOrPath]: contents };
      if (!changes || typeof changes !== "object") continue;
      for (const [field, value] of Object.entries(changes)) {
        const name = field.split(".")[0];
        const rule = rules[name];
        if (operator === "$rename" && rules[String(value).split(".")[0]]) {
          throw new ApiError(400, "Cannot rename fields into inventory or commission settings");
        }
        if (!rule) continue;
        if (field !== name) throw new ApiError(400, `Invalid update to ${name}`);
        if (operator === "$unset" && rule.nullable) continue;
        if (operator === "$inc" && name === "stock") {
          if (!Number.isSafeInteger(value) || this.getOptions().upsert) {
            throw new ApiError(400, "Stock adjustments must be safe whole numbers and cannot use upsert");
          }
          const original = this.getFilter();
          this.setQuery({ $and: [original, {
            stock: { $gte: Math.max(0, -value), $lte: Math.min(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - value) },
            // Reject fractional legacy stock without changing historical data.
            $expr: { $eq: [{ $mod: [{ $cond: [{ $isNumber: "$stock" }, "$stock", 0] }, 1] }, 0] },
          }] });
          continue;
        }
        if (!["$set", "$setOnInsert"].includes(operator) ||
            !(rule.nullable && value === null) && !rule.validate(value)) {
          throw new ApiError(400, rule.message);
        }
      }
    }
  });
}

module.exports = { validStock, validRate, strictNumber, guardNumericUpdates };
