const crypto = require("crypto");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { settleProviderTransaction } = require("../services/onlinePaymentService");

// Compares digests, not the raw strings, so the check takes the same time
// whatever the attacker sends and works for headers of any length.
function secretMatches(supplied, expected) {
  if (typeof supplied !== "string" || !supplied) return false;
  const digest = value => crypto.createHash("sha256").update(value).digest();
  return crypto.timingSafeEqual(digest(supplied), digest(expected));
}

// Flutterwave calls this when a charge finishes, whether or not the buyer's
// browser is still open. Without it a customer who pays and then closes the
// tab (or loses signal) before our verify call would be charged with the order
// still "pending payment". Flutterwave resends on any non-200 answer.
exports.flutterwave = asyncHandler(async (req, res) => {
  const secretHash = process.env.FLW_SECRET_HASH;
  if (!secretHash) throw new ApiError(503, "Payment webhook is not configured");
  if (!secretMatches(req.get("verif-hash"), secretHash)) throw new ApiError(401, "Invalid webhook signature");

  const { event, data } = req.body || {};
  // Only a finished, successful charge matters. The body is a hint about
  // WHICH transaction to look at; the amount, currency and reference are
  // always re-read from Flutterwave itself.
  if (event !== "charge.completed" || data?.status !== "successful" || data?.id == null) {
    return res.json({ success: true, handled: false });
  }

  try {
    const outcome = await settleProviderTransaction(data.id);
    return res.json({ success: true, ...outcome });
  } catch (err) {
    // Flutterwave says it did not succeed: nothing to record, and retrying
    // would not change that. Provider outages and processing errors are
    // re-thrown so the 5xx makes Flutterwave deliver the event again.
    if (err.statusCode === 400) return res.json({ success: true, handled: false });
    throw err;
  }
});
