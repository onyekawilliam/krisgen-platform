const Commission = require("../models/Commission");
const Settings = require("../models/Settings");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const Withdrawal = require("../models/Withdrawal");
const { validRate } = require("../utils/numericIntegrity");
const { queryString } = require("../utils/inputGuards");
const { computeAvailableBalance } = require("./withdrawalController");

// Member's own earnings — costPriceSnapshot stays excluded (schema default),
// so a member can see how their commission was derived (profit, rate,
// amount) without ever seeing Krisgen's acquisition cost.
exports.myCommissions = asyncHandler(async (req, res) => {
  const commissions = await Commission.find({ beneficiary: req.user._id })
    .populate("product", "name brand model")
    .sort({ createdAt: -1 });

  // Cancelled and reversed commissions were never earned, so they stay out of
  // every total. "paid" is what has actually been paid out: paid withdrawals
  // plus any commission settled under the old manual "paid" status. "approved"
  // is approved money not yet paid out.
  const summary = commissions.reduce(
    (acc, c) => {
      if (c.status === "pending") acc.pending += c.commissionAmount;
      if (c.status === "approved") acc.approved += c.commissionAmount;
      if (c.status === "paid") acc.paid += c.commissionAmount;
      return acc;
    },
    { total: 0, pending: 0, approved: 0, paid: 0 }
  );
  // A paid withdrawal is paid out of approved commissions, which keep their
  // "approved" status, so move that amount from approved to paid.
  const paidWithdrawals = await Withdrawal.find({ user: req.user._id, status: "paid" });
  const paidOut = paidWithdrawals.reduce((sum, w) => sum + w.amount, 0);
  const settledFromApproved = Math.min(paidOut, summary.approved);
  summary.approved -= settledFromApproved;
  summary.paid += paidOut;
  summary.total = summary.pending + summary.approved + summary.paid;
  summary.available = await computeAvailableBalance(req.user._id);
  for (const key of Object.keys(summary)) summary[key] = Math.round(summary[key] * 100) / 100;

  res.json({ success: true, data: commissions, summary });
});

// ----- Admin -----

exports.adminListCommissions = asyncHandler(async (req, res) => {
  const status = queryString(req.query.status);
  const type = queryString(req.query.type);
  const query = {};
  if (status) query.status = status;
  if (type) query.type = type;

  const commissions = await Commission.find(query)
    .select("+costPriceSnapshot")
    .populate("beneficiary", "name email")
    .populate("product", "name brand model")
    // The order is the authoritative source for the customer and sale time.
    // An in-store walk-in has no buyer, so keep its saved customer snapshot
    // alongside the registered buyer relation for the admin audit trail.
    .populate({
      path: "order",
      select: "orderNumber buyer walkInCustomer createdAt payment.reference",
      populate: { path: "buyer", select: "name email phone" },
    })
    .sort({ createdAt: -1 });

  res.json({ success: true, data: commissions });
});

// Commissions only move forward. Cancelled and reversed ones are final, so a
// commission for a cancelled or refunded order cannot be brought back, and
// nothing is settled by hand: a commission is paid out through the member's
// withdrawal, which is what keeps their balance from being deducted twice.
const allowedTransitions = {
  pending: ["approved", "cancelled", "reversed"],
  approved: ["cancelled", "reversed"],
  paid: ["reversed"],
  cancelled: [],
  reversed: [],
};

exports.adminUpdateCommissionStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!Object.hasOwn(allowedTransitions, status)) throw new ApiError(400, "Invalid status");

  const commission = await Commission.findById(req.params.id);
  if (!commission) throw new ApiError(404, "Commission not found");
  if (!allowedTransitions[commission.status].includes(status)) {
    throw new ApiError(409, `A ${commission.status} commission cannot be changed to ${status}`);
  }

  const updated = await Commission.findOneAndUpdate(
    { _id: commission._id, status: commission.status }, { $set: { status } }, { new: true }
  );
  if (!updated) throw new ApiError(409, "This commission was just changed by someone else; refresh and try again");

  res.json({ success: true, data: updated });
});

exports.adminGetSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();
  res.json({ success: true, data: settings });
});

exports.adminUpdateSettings = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
      Object.keys(req.body).some(key => !["directCommissionRate", "referralOverrideRate"].includes(key))) {
    throw new ApiError(400, "Only commission rate fields may be submitted");
  }
  for (const [key, value] of Object.entries(req.body)) {
    if (!validRate(value)) throw new ApiError(400, key + " must be a finite number between 0 and 100");
  }
  const { directCommissionRate, referralOverrideRate } = req.body;
  const settings = await Settings.getSettings();

  const direct = directCommissionRate ?? settings.directCommissionRate;
  const override = referralOverrideRate ?? settings.referralOverrideRate;
  // Both are shares of the same profit; together they can never exceed all of it.
  if (direct + override > 100) {
    throw new ApiError(400, "The direct and referral override rates together cannot exceed 100% of profit");
  }
  if (directCommissionRate != null) settings.directCommissionRate = directCommissionRate;
  if (referralOverrideRate != null) settings.referralOverrideRate = referralOverrideRate;

  await settings.save();
  res.json({ success: true, data: settings });
});
