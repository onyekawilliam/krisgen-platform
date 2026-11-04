const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Referral = require("../models/Referral");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { isString, requireString } = require("../utils/inputGuards");
const mailer = require("../services/emailService");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function cookieOptions() {
  const production = process.env.NODE_ENV === "production";
  const configuredSameSite = process.env.COOKIE_SAME_SITE?.toLowerCase();
  const sameSite = ["lax", "strict", "none"].includes(configuredSameSite)
    ? configuredSameSite
    : production ? "none" : "lax";

  return {
    httpOnly: true,
    // SameSite=None requires Secure. Production traffic is always HTTPS.
    secure: production || sameSite === "none",
    sameSite,
    path: "/",
  };
}

function sendTokenCookie(res, token) {
  res.cookie(process.env.COOKIE_NAME || "krisgen_token", token, {
    ...cookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// Registration is always free — no fee, no commission generated here.
// If a ?ref=CODE was supplied, record the referral relationship (one hop,
// permanent) but nothing financial happens at this step.
exports.register = asyncHandler(async (req, res) => {
  const { password, refCode } = req.body;
  if (![req.body.name, req.body.email, req.body.phone, password].every(isString) ||
      !req.body.name.trim() || !req.body.email.trim() || !req.body.phone.trim() || !password) {
    throw new ApiError(400, "Name, email, phone and password are required");
  }
  const name = requireString(req.body.name, "Name", { max: 100 });
  const email = requireString(req.body.email, "Email", { max: 254 }).toLowerCase();
  const phone = requireString(req.body.phone, "Phone", { max: 40, min: 7 });
  if (!emailPattern.test(email)) throw new ApiError(400, "Enter a valid email address");
  if (password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }
  if (password.length > 72) {
    // bcrypt silently ignores everything past 72 bytes.
    throw new ApiError(400, "Password must be at most 72 characters");
  }

  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, "An account with this email already exists");

  let referralCode;
  do {
    referralCode = User.generateReferralCode(name);
  } while (await User.findOne({ referralCode }));

  let user;
  try {
    user = await User.create({
      name,
      email,
      phone,
      passwordHash: password, // hashed by pre-save hook
      referralCode,
    });
  } catch (err) {
    // Two sign-ups with the same email racing past the check above.
    if (err.code === 11000) throw new ApiError(409, "An account with this email already exists");
    throw err;
  }

  // refCode must be plain text: an object such as {"$ne": null} would otherwise
  // be run as a query operator and match an arbitrary user as the referrer.
  if (isString(refCode) && refCode.trim()) {
    const referrer = await User.findOne({ referralCode: refCode.trim() });
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
  if (!isString(email) || !isString(password) || !email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }
  if (user.status === "suspended") throw new ApiError(403, "This account has been suspended");

  const token = signToken(user._id);
  sendTokenCookie(res, token);

  res.json({ success: true, data: publicUser(user) });
});

exports.logout = asyncHandler(async (req, res) => {
  res.clearCookie(process.env.COOKIE_NAME || "krisgen_token", cookieOptions());
  res.json({ success: true, message: "Logged out" });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: publicUser(req.user) });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  if (name !== undefined) req.user.name = requireString(name, "Name", { max: 100 });
  if (phone !== undefined) req.user.phone = requireString(phone, "Phone", { max: 40, min: 7 });
  await req.user.save();
  res.json({ success: true, data: publicUser(req.user) });
});

// Lets a signed-in person choose a new password. The current password is
// required, so someone who finds an unlocked screen cannot take over the
// account. Changing it signs out every other session, so a fresh cookie is
// issued here to keep this device logged in.
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!isString(currentPassword) || !isString(newPassword) || !currentPassword) {
    throw new ApiError(400, "Enter your current password and a new password");
  }
  if (newPassword.length < 8 || newPassword.length > 72) {
    throw new ApiError(400, "The new password must be 8 to 72 characters");
  }
  if (newPassword === currentPassword) {
    throw new ApiError(400, "The new password must be different from the current one");
  }

  const user = await User.findById(req.user._id).select("+passwordHash");
  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(400, "Your current password is not correct");
  }

  user.passwordHash = newPassword; // hashed by the pre-save hook, which also records passwordChangedAt
  await user.save();
  sendTokenCookie(res, signToken(user._id));
  res.json({ success: true, message: "Password updated. Other devices have been signed out." });
});

// The link is only ever sent by email. The one exception is local development
// with no mail provider set up, where it is printed to this server's own console
// so the flow can be tried; that branch never runs in production.
async function deliverResetEmail(user, link) {
  if (!mailer.isConfigured() && process.env.NODE_ENV === "development") {
    console.log(`[dev only] Password reset link for ${user.email}: ${link}`);
    return;
  }
  await mailer.sendEmail({ to: user.email, ...mailer.passwordResetMessage({ name: user.name, link }) });
}

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = isString(email) ? await User.findOne({ email: email.trim().toLowerCase() }) : null;
  // Always respond the same way whether or not the account exists, to avoid
  // leaking which emails are registered.
  if (user) {
    const rawToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
    const link = `${(process.env.CLIENT_URL || "").replace(/\/+$/, "")}/reset-password?token=${rawToken}`;
    // Not awaited: a slow or failing mail provider must not change how long the
    // request takes, which would reveal whether the account exists. The token
    // is never logged or returned in the response.
    deliverResetEmail(user, link).catch(error =>
      console.error(`Password reset email for user ${user._id} was not sent: ${error.message}`));
  }
  res.json({ success: true, message: "If that account exists, a reset link has been sent." });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!isString(token) || !isString(newPassword) || !token || newPassword.length < 8 || newPassword.length > 72) {
    throw new ApiError(400, "A valid token and a password of 8 to 72 characters are required");
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
