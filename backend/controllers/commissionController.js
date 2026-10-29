const Commission = require("../models/Commission");
const Settings = require("../models/Settings");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { validRate } = require("../utils/numericIntegrity");

// Member's own earnings — costPriceSnapshot stays excluded (schema default),
// so a member can see how their commission was derived (profit, rate,
// amount) without ever seeing Krisgen's acquisition cost.
exports.myCommissions = asyncHandler(async (req, res) => {
  const commissions = await Commission.find({ beneficiary: req.user._id })
    .populate("product", "name brand model")
    .sort({ createdAt: -1 });

  const summary = commissions.reduce(
    (acc, c) => {
      acc.total += c.commissionAmount;
      if (c.status === "pending") acc.pending += c.commissionAmount;
      if (c.status === "approved") acc.approved += c.commissionAmount;
      if (c.status === "paid") acc.paid += c.commissionAmount;
      return acc;
    },
    { total: 0, pending: 0, approved: 0, paid: 0 }
  );

  res.json({ success: true, data: commissions, summary });
});

// ----- Admin -----

exports.adminListCommissions = asyncHandler(async (req, res) => {
  const { status, type } = req.query;
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

exports.adminUpdateCommissionStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ["pending", "approved", "paid", "cancelled", "reversed"];
  if (!allowed.includes(status)) throw new ApiError(400, "Invalid status");

  const commission = await Commission.findById(req.params.id);
  if (!commission) throw new ApiError(404, "Commission not found");

  commission.status = status;
  await commission.save();

  res.json({ success: true, data: commission });
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

  if (directCommissionRate != null) settings.directCommissionRate = directCommissionRate;
  if (referralOverrideRate != null) settings.referralOverrideRate = referralOverrideRate;

  await settings.save();
  res.json({ success: true, data: settings });
});
