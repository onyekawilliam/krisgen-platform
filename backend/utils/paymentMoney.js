// Convert NGN values to exact kobo before comparison. Do not round underpayments
// into matching a price, accept NaN, or overflow JavaScript's safe integer range.
function minorUnits(value) {
  if (!["number", "string"].includes(typeof value)) return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) return null;
  const amount = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : null;
}

function transactionId(value) {
  if (typeof value === "number" && !Number.isSafeInteger(value)) return null;
  if (!["number", "string"].includes(typeof value) || !/^\d{1,30}$/.test(String(value))) return null;
  const id = String(value).replace(/^0+/, "");
  return id || null;
}

module.exports = { minorUnits, transactionId };
