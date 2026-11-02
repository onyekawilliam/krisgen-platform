const ApiError = require("../utils/ApiError");

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

// The auth cookie is SameSite=None in production so a separate Vercel domain
// can use it, which means another website could make a visitor's browser send
// it. Browsers always attach an Origin header to those cross-site writes, so a
// state-changing request from any origin other than our own frontend is
// refused. Requests with no Origin (server-to-server, curl) carry no browser
// cookie ambient authority and are unaffected.
function originCheck(allowedOrigin) {
  const allowed = allowedOrigin ? allowedOrigin.replace(/\/+$/, "") : null;
  return function (req, res, next) {
    const origin = req.headers.origin;
    if (!allowed || safeMethods.has(req.method) || !origin || origin === allowed) return next();
    next(new ApiError(403, "Request origin is not allowed"));
  };
}

module.exports = originCheck;
