const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Referral = require("../models/Referral");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function sendTokenCookie(res, token) {
  res.cookie(process.env.COOKIE_NAME || "krisgen_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// Registration is always free — no fee, no commission generated here.
// If a ?ref=CODE was supplied, record the referral relationship (one hop,
// permanent) but nothing financial happens at this step.
exports.register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, refCode } = req.body;

  if (!name || !email || !phone || !password) {
    throw new ApiError(400, "Name, email, phone and password are required");
  }
  if (password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new ApiError(409, "An account with this email already exists");

  let referralCode;
  do {
    referralCode = User.generateReferralCode(name);
  } while (await User.findOne({ referralCode }));

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    phone,
    passwordHash: password, // hashed by pre-save hook
    referralCode,
  });

  if (refCode) {
    const referrer = await User.findOne({ referralCode: refCode });
    if (referrer && referrer._id.toString() !== user._id.toString()) {
      user.referredBy = referrer._id;
      await user.save();
      await Referral.create({ referrer: referrer._id, referred: user._id });
    }
  }

  const token = signToken(user._id);
  sendTokenCookie(res, token);

  res.status(201).json({
    success: true,
    data: publicUser(user),
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, "Email and password are required");

  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }
  if (user.status === "suspended") throw new ApiError(403, "This account has been suspended");

  const token = signToken(user._id);
  sendTokenCookie(res, token);

  res.json({ success: true, data: publicUser(user) });
});

exports.logout = asyncHandler(async (req, res) => {
  res.clearCookie(process.env.COOKIE_NAME || "krisgen_token");
  res.json({ success: true, message: "Logged out" });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: publicUser(req.user) });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  if (name) req.user.name = name;
  if (phone) req.user.phone = phone;
  await req.user.save();
  res.json({ success: true, data: publicUser(req.user) });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() });
  // Always respond the same way whether or not the account exists, to avoid
  // leaking which emails are registered.
  if (user) {
    const rawToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
    // TODO: send `rawToken` via email/SMS provider. Never log/return it.
  }
  res.json({ success: true, message: "If that account exists, a reset link has been sent." });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 8) {
    throw new ApiError(400, "A valid token and a password of at least 8 characters are required");
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  }).select("+passwordResetToken +passwordResetExpires");

  if (!user) throw new ApiError(400, "Reset token is invalid or has expired");

  user.passwordHash = newPassword; // re-hashed by pre-save hook
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  res.json({ success: true, message: "Password updated. You can now log in." });
});

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    referralCode: user.referralCode,
    balance: user.balance,
    createdAt: user.createdAt,
  };
}

exports.publicUser = publicUser;
