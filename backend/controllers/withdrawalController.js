const mongoose = require("mongoose");
const Withdrawal = require("../models/Withdrawal");
const Commission = require("../models/Commission");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { requireString, queryString } = require("../utils/inputGuards");

const transactionOptions = {
  readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" },
};

// Available balance = sum of that member's APPROVED commissions minus
// whatever they've already requested (pending/approved/paid withdrawals).
// Only approved commissions are withdrawable — pending ones are still
// subject to admin review, paid/cancelled/reversed are excluded. Commissions
// are settled by the withdrawal that pays them out, never by a separate manual
// "paid" step, so nothing is ever deducted twice.
async function computeAvailableBalance(userId, session = null) {
  const commissions = await Commission.find({ beneficiary: userId, status: "approved" }).session(session);
  const approvedMinor = commissions.reduce((sum, c) => sum + Math.round(c.commissionAmount * 100), 0);

  const withdrawals = await Withdrawal.find({
    user: userId,
    status: { $in: ["pending", "approved", "paid"] },
  }).session(session);
  const requestedMinor = withdrawals.reduce((sum, w) => sum + Math.round(w.amount * 100), 0);

  return Math.max(0, approvedMinor - requestedMinor) / 100;
}

function validAmount(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 1) return null;
  const minor = Math.round(amount * 100);
  // Whole kobo only, so the amount compares exactly against commission totals.
  return Math.abs(minor - amount * 100) < 1e-6 ? minor / 100 : null;
}

function validBankDetails(bankDetails) {
  if (!bankDetails || typeof bankDetails !== "object" || Array.isArray(bankDetails)) {
    throw new ApiError(400, "Bank details are required");
  }
  const bankName = requireString(bankDetails.bankName, "Bank name", { max: 100 });
  const accountName = requireString(bankDetails.accountName, "Account name", { max: 100 });
  const accountNumber = requireString(bankDetails.accountNumber, "Account number", { max: 10 });
  if (!/^\d{10}$/.test(accountNumber)) {
    throw new ApiError(400, "Account number must be a 10-digit Nigerian bank account number");
  }
  return { bankName, accountName, accountNumber };
}

exports.requestWithdrawal = asyncHandler(async (req, res) => {
  const amount = validAmount(req.body?.amount);
  if (amount == null) throw new ApiError(400, "Enter a valid withdrawal amount of at least ₦1");
  const bankDetails = validBankDetails(req.body?.bankDetails);

  // The balance check and the insert run in one transaction that also bumps a
  // per-member counter. Concurrent requests from the same member therefore
  // conflict on that write and are retried one after the other, so the second
  // sees the first and cannot spend the same balance twice.
  const withdrawal = await mongoose.connection.transaction(async session => {
    await User.updateOne({ _id: req.user._id }, { $inc: { withdrawalSeq: 1 } }, { session });
    const available = await computeAvailableBalance(req.user._id, session);
    if (amount > available) {
      throw new ApiError(400, `Amount exceeds your available balance of ₦${available}`);
    }
    const [created] = await Withdrawal.create([{ user: req.user._id, amount, bankDetails }], { session });
    return created;
  }, transactionOptions);

  res.status(201).json({ success: true, data: withdrawal });
});

exports.myWithdrawals = asyncHandler(async (req, res) => {
  const withdrawals = await Withdrawal.find({ user: req.user._id }).sort({ createdAt: -1 });
  const available = await computeAvailableBalance(req.user._id);
  res.json({ success: true, data: withdrawals, availableBalance: available });
});

// ----- Admin -----

exports.adminListWithdrawals = asyncHandler(async (req, res) => {
  const status = queryString(req.query.status);
  const query = status ? { status } : {};
  const withdrawals = await Withdrawal.find(query).populate("user", "name email").sort({ createdAt: -1 });
  res.json({ success: true, data: withdrawals });
});

// A payout can only move forward. "paid" and "rejected" are final, so a
// withdrawal that has been paid out can never be rejected to free its balance
// a second time.
const allowedTransitions = {
  pending: ["approved", "rejected"],
  approved: ["paid", "rejected"],
  paid: [],
  rejected: [],
};

exports.adminUpdateWithdrawal = asyncHandler(async (req, res) => {
  const { status, adminNote } = req.body;
  if (!Object.hasOwn(allowedTransitions, status)) throw new ApiError(400, "Invalid status");
  if (adminNote !== undefined && typeof adminNote !== "string") throw new ApiError(400, "Admin note must be text");
  if (!mongoose.isObjectIdOrHexString(req.params.id)) throw new ApiError(400, "Invalid withdrawal ID");

  const current = await Withdrawal.findById(req.params.id);
  if (!current) throw new ApiError(404, "Withdrawal not found");
  if (!allowedTransitions[current.status].includes(status)) {
    throw new ApiError(409, `A ${current.status} withdrawal cannot be changed to ${status}`);
  }

  // Conditional on the status we just read, so two admins acting at once
  // cannot both apply a transition.
  const set = { status, processedBy: req.user._id, processedAt: new Date() };
  if (adminNote) set.adminNote = adminNote.slice(0, 500);
  const updated = await Withdrawal.findOneAndUpdate(
    { _id: current._id, status: current.status }, { $set: set }, { new: true, runValidators: true }
  );
  if (!updated) throw new ApiError(409, "This withdrawal was just changed by someone else; refresh and try again");

  res.json({ success: true, data: updated });
});

module.exports.computeAvailableBalance = computeAvailableBalance;
