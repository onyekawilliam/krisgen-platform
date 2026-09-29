const Withdrawal = require("../models/Withdrawal");
const Commission = require("../models/Commission");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// Available balance = sum of that member's APPROVED commissions minus
// whatever they've already requested (pending/approved/paid withdrawals).
// Only approved commissions are withdrawable — pending ones are still
// subject to admin review, paid/cancelled/reversed are excluded.
async function computeAvailableBalance(userId) {
  const commissions = await Commission.find({ beneficiary: userId, status: "approved" });
  const approvedTotal = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);

  const withdrawals = await Withdrawal.find({
    user: userId,
    status: { $in: ["pending", "approved", "paid"] },
  });
  const alreadyRequested = withdrawals.reduce((sum, w) => sum + w.amount, 0);

  return Math.max(0, approvedTotal - alreadyRequested);
}

exports.requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount, bankDetails } = req.body;
  if (!amount || amount <= 0) throw new ApiError(400, "Enter a valid withdrawal amount");
  if (!bankDetails?.accountNumber || !bankDetails?.bankName) {
    throw new ApiError(400, "Bank details are required");
  }

  const available = await computeAvailableBalance(req.user._id);
  if (amount > available) throw new ApiError(400, `Amount exceeds your available balance of ₦${available}`);

  const withdrawal = await Withdrawal.create({
    user: req.user._id,
    amount,
    bankDetails,
  });

  res.status(201).json({ success: true, data: withdrawal });
});

exports.myWithdrawals = asyncHandler(async (req, res) => {
  const withdrawals = await Withdrawal.find({ user: req.user._id }).sort({ createdAt: -1 });
  const available = await computeAvailableBalance(req.user._id);
  res.json({ success: true, data: withdrawals, availableBalance: available });
});

// ----- Admin -----

exports.adminListWithdrawals = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = status ? { status } : {};
  const withdrawals = await Withdrawal.find(query).populate("user", "name email").sort({ createdAt: -1 });
  res.json({ success: true, data: withdrawals });
});

exports.adminUpdateWithdrawal = asyncHandler(async (req, res) => {
  const { status, adminNote } = req.body;
  const allowed = ["pending", "approved", "rejected", "paid"];
  if (!allowed.includes(status)) throw new ApiError(400, "Invalid status");

  const withdrawal = await Withdrawal.findById(req.params.id);
  if (!withdrawal) throw new ApiError(404, "Withdrawal not found");

  withdrawal.status = status;
  if (adminNote) withdrawal.adminNote = adminNote;
  withdrawal.processedBy = req.user._id;
  withdrawal.processedAt = new Date();
  await withdrawal.save();

  res.json({ success: true, data: withdrawal });
});
