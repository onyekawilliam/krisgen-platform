const ApiError = require("./ApiError");

// Request bodies and query strings are attacker-controlled JSON: a "string"
// field can arrive as an object such as {"$ne": null}. Every field that feeds
// a database query or a string method goes through one of these first.
function isString(value) {
  return typeof value === "string";
}

function requireString(value, label, { max = 200, min = 1 } = {}) {
  if (!isString(value)) throw new ApiError(400, `${label} must be text`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new ApiError(400, min > 1
      ? `${label} must be between ${min} and ${max} characters`
      : `${label} is required and must be at most ${max} characters`);
  }
  return trimmed;
}

// Optional filter in a query string: returns the string or undefined, and
// ignores array/object forms such as ?status[$ne]=x.
function queryString(value) {
  return isString(value) && value.length <= 200 ? value : undefined;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { isString, requireString, queryString, escapeRegExp };
