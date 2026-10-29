// Central error handler. Keeps internal error detail (stack traces, raw
// Mongo errors) out of API responses in production.
function errorHandler(err, req, res, next) {
  const invalidInput = err.name === "ValidationError" || err.name === "CastError";
  const statusCode = err.statusCode || (invalidInput ? 400 : 500);
  const message = err.statusCode ? err.message : invalidInput
    ? "Invalid input: check the field types, stock quantity, and commission percentages."
    : "Something went wrong on our end.";

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.code === "SALE_REQUEST_CONFLICT" ? { code: err.code } : {}),
  });
}

module.exports = errorHandler;
