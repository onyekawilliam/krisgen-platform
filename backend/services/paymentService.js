const fetch = require("node-fetch");
const ApiError = require("../utils/ApiError");

/**
 * Verifies a transaction reference directly with Flutterwave's API.
 * The frontend telling us "payment succeeded" is never trusted on its own —
 * this server-to-server call is the only source of truth for whether an
 * order should be marked paid.
 *
 * Docs: https://developer.flutterwave.com/docs/verify-transactions
 */
async function verifyFlutterwaveTransaction(transactionId) {
  const url = `${process.env.FLW_VERIFY_URL}/${encodeURIComponent(transactionId)}/verify`;

  const response = await fetch(url, {
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
    },
  });

  if (!response.ok) throw new ApiError(502, "Payment provider verification is temporarily unavailable");
  const data = await response.json();

  if (data.status !== "success" || data.data?.status !== "successful") {
    return { verified: false, raw: data };
  }

  return {
    verified: true,
    transactionId: data.data.id,
    amount: data.data.amount,
    currency: data.data.currency,
    reference: data.data.tx_ref,
    raw: data,
  };
}

module.exports = { verifyFlutterwaveTransaction };
