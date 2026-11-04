require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const connectDB = require("./config/db");
const errorHandler = require("./middlewares/errorHandler");
const originCheck = require("./middlewares/originCheck");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const commissionRoutes = require("./routes/commissionRoutes");
const referralRoutes = require("./routes/referralRoutes");
const withdrawalRoutes = require("./routes/withdrawalRoutes");
const adminRoutes = require("./routes/adminRoutes");
const webhookRoutes = require("./routes/webhookRoutes");

function validateProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;
  const required = ["MONGO_URI", "CLIENT_URL", "JWT_SECRET", "FLW_SECRET_KEY", "FLW_VERIFY_URL"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }
  if (!/^https:\/\//.test(process.env.CLIENT_URL)) {
    throw new Error("CLIENT_URL must be an HTTPS frontend origin in production");
  }
  // Not fatal, so an existing deployment keeps starting, but worth flagging.
  if (!process.env.FLW_SECRET_HASH) {
    console.warn("FLW_SECRET_HASH is not set: payments made after the buyer closes the page will not be confirmed automatically.");
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.warn("RESEND_API_KEY / EMAIL_FROM are not set: password-reset emails will not be sent.");
  }
}

validateProductionConfig();
connectDB();

const app = express();

// Render sits behind a reverse proxy. Trust exactly that hop so rate limits and
// secure cookies use the original client request information.
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
// A trailing slash on CLIENT_URL would otherwise silently break CORS.
const clientOrigin = process.env.CLIENT_URL?.replace(/\/+$/, "");
// The API serves JSON only; images and pages come from Cloudinary and Vercel.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(originCheck(clientOrigin));
app.use(express.json());
app.use(cookieParser());
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

// General API rate limit; auth routes get a tighter one to slow brute force.
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, max: 600 }));
app.use(
  "/api/auth/login",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { success: false, message: "Too many login attempts, try again later." } })
);

// Guessing the current password through this form is still guessing.
app.use("/api/auth/me/password", rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { success: false, message: "Too many attempts, try again later." } }));

// Sign-up and password reset can be abused without logging in, so each gets its own cap.
app.use("/api/auth/register", rateLimit({ windowMs: 60 * 60 * 1000, max: 30, message: { success: false, message: "Too many sign-ups from this network, try again later." } }));
app.use("/api/auth/forgot-password", rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: { success: false, message: "Too many reset requests, try again later." } }));

app.get("/api/health", (req, res) => res.json({ success: true, message: "Krisgen API is running" }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/commissions", commissionRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/webhooks", webhookRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Krisgen API listening on port ${PORT}`));
