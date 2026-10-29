const User = require("../models/User");
const Order = require("../models/Order");
const PaymentReceipt = require("../models/PaymentReceipt");
const Commission = require("../models/Commission");
const Product = require("../models/Product");
const Withdrawal = require("../models/Withdrawal");
const Referral = require("../models/Referral");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { recordInStoreSale } = require("../services/inStoreSaleService");

exports.listMembers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const query = { role: "customer" };
  if (search) {
    query.$or = [
      { name: new RegExp(search, "i") },
      { email: new RegExp(search, "i") },
      { referralCode: new RegExp(search, "i") },
    ];
  }
  const members = await User.find(query)
    .populate("referredBy", "name email referralCode")
    .sort({ createdAt: -1 });
  res.json({ success: true, data: members });
});

exports.getMember = asyncHandler(async (req, res) => {
  const member = await User.findById(req.params.id);
  if (!member) throw new ApiError(404, "Member not found");

  const [referrals, orders, commissions] = await Promise.all([
    Referral.find({ referrer: member._id }).populate("referred", "name email"),
    Order.find({ buyer: member._id }).sort({ createdAt: -1 }),
    Commission.find({ beneficiary: member._id }).sort({ createdAt: -1 }),
  ]);

  res.json({ success: true, data: { member, referrals, orders, commissions } });
});

exports.setMemberStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["active", "suspended"].includes(status)) throw new ApiError(400, "Invalid status");

  const member = await User.findById(req.params.id);
  if (!member) throw new ApiError(404, "Member not found");
  if (member.role === "admin") throw new ApiError(400, "Cannot change status of an admin account");

  member.status = status;
  await member.save();
  res.json({ success: true, data: member });
});

exports.dashboardStats = asyncHandler(async (req, res) => {
  const [memberCount, productCount, orders, commissions, pendingWithdrawals, paymentReviewCount] = await Promise.all([
    User.countDocuments({ role: "customer" }),
    Product.countDocuments({ isActive: true }),
    Order.find({ status: { $in: ["paid", "processing", "delivered"] } }),
    Commission.find(),
    Withdrawal.countDocuments({ status: "pending" }),
    PaymentReceipt.countDocuments({ resolutionRequired: true }),
  ]);

  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalCommissionsOwed = commissions
    .filter((c) => c.status === "pending" || c.status === "approved")
    .reduce((sum, c) => sum + c.commissionAmount, 0);

  res.json({
    success: true,
    data: {
      memberCount,
      productCount,
      orderCount: orders.length,
      totalRevenue,
      totalCommissionsOwed,
      pendingWithdrawals,
      paymentReviewCount,
    },
  });
});

exports.recordInStoreSale = asyncHandler(async (req, res) => {
  const { order, replayed } = await recordInStoreSale(req.body, req.user._id);
  res.status(replayed ? 200 : 201).json({
    success: true,
    message: replayed ? "Sale already recorded" : "In-store sale recorded successfully",
    data: order,
  });
});

// Successful provider payments needing reconciliation; no refund is initiated.
exports.listPaymentReviews = asyncHandler(async (req, res) => {
  const receipts = await PaymentReceipt.find({ resolutionRequired: true })
    .populate("order", "orderNumber status").sort({ verifiedAt: -1 });
  res.json({ success: true, data: receipts });
});
