const Referral = require("../models/Referral");
const asyncHandler = require("../utils/asyncHandler");

// A member's referrals — one flat list, one hop. No levels, no downline tree.
exports.myReferrals = asyncHandler(async (req, res) => {
  const referrals = await Referral.find({ referrer: req.user._id })
    .populate("referred", "name email createdAt")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: referrals,
    referralLink: `${process.env.CLIENT_URL}/register?ref=${req.user.referralCode}`,
  });
});

exports.adminListReferrals = asyncHandler(async (req, res) => {
  const referrals = await Referral.find()
    .populate("referrer", "name email referralCode")
    .populate("referred", "name email createdAt")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: referrals });
});
