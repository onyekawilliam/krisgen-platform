// Central error handler. Keeps internal error detail (stack traces, raw
// Mongo errors) out of API responses in production.
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.statusCode ? err.message : "Something went wrong on our end.";

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
}

module.exports = errorHandler;
