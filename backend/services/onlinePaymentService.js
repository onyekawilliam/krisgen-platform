const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const PaymentReceipt = require("../models/PaymentReceipt");
const ApiError = require("../utils/ApiError");
const { minorUnits, transactionId: normalizeTransactionId } = require("../utils/paymentMoney");
const { generateCommissionsForOrder } = require("./commissionService");
const { verifyFlutterwaveTransaction } = require("./paymentService");

const transactionOptions = {
  readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" },
};
const fulfilledStatuses = ["paid", "processing", "delivered", "refunded"];

function result(order, receipt) {
  return {
    status: order.status, paymentReceived: true,
    requiresResolution: Boolean(order.payment.resolutionRequired || receipt.resolutionRequired),
    transactionId: receipt.transactionId,
  };
}

function copyPayment(order, receipt) {
  order.payment.provider = "flutterwave";
  order.payment.transactionId = receipt.transactionId;
  order.payment.reference = receipt.reference;
  order.payment.amount = receipt.amount;
  order.payment.currency = receipt.currency;
  order.payment.verified = true; // External success, independently of fulfillment.
  order.payment.verifiedAt = receipt.verifiedAt;
}

async function markReview(receiptId, reason) {
  return mongoose.connection.transaction(async session => {
    const receipt = await PaymentReceipt.findById(receiptId).session(session);
    const order = receipt?.order && await Order.findById(receipt.order).session(session);
    if (!receipt || !order) return null;
    if (receipt.status === "fulfilled") return result(order, receipt);
    receipt.status = "review";
    receipt.resolutionRequired = true;
    receipt.resolutionReason = reason;
    if (!order.payment.transactionId && !fulfilledStatuses.includes(order.status)) copyPayment(order, receipt);
    order.payment.resolutionRequired = true;
    order.payment.resolutionReason = reason;
    if (!fulfilledStatuses.includes(order.status)) order.status = "payment_review";
    await receipt.save({ session });
    await order.save({ session });
    return result(order, receipt);
  }, transactionOptions);
}

async function fulfill(receiptId) {
  return mongoose.connection.transaction(async session => {
    const receipt = await PaymentReceipt.findById(receiptId).session(session);
    const order = await Order.findById(receipt.order).select("+items.costPriceSnapshot").session(session);
    if (!order) throw new ApiError(404, "Order not found");
    if (receipt.status === "fulfilled") return result(order, receipt);
    if (receipt.status === "review" && receipt.resolutionReason !== "processing_error") {
      return result(order, receipt);
    }
    const existingPayment = order.payment.transactionId;
    if ((existingPayment && existingPayment !== receipt.transactionId) ||
        (fulfilledStatuses.includes(order.status) && order.payment.verified)) {
      receipt.status = "review";
      receipt.resolutionRequired = true;
      receipt.resolutionReason = "duplicate_payment";
      order.payment.resolutionRequired = true;
      order.payment.resolutionReason = "duplicate_payment";
      await receipt.save({ session });
      await order.save({ session });
      return result(order, receipt);
    }
    if (order.status !== "pending_payment" &&
        !(order.status === "payment_review" && receipt.resolutionReason === "processing_error")) {
      const error = new Error("Order is no longer payable");
      error.reviewReason = "order_not_payable";
      throw error;
    }
    const expectedAmount = minorUnits(order.totalAmount);
    const actualAmount = minorUnits(receipt.amount);
    if (expectedAmount == null || actualAmount !== expectedAmount || expectedAmount <= 0) {
      const error = new Error("Payment amount does not match this order");
      error.reviewReason = "amount_mismatch";
      throw error;
    }
    if (receipt.currency !== (order.payment.currency || "NGN")) {
      const error = new Error("Payment currency does not match this order");
      error.reviewReason = "currency_mismatch";
      throw error;
    }
    // New checkouts consolidate product lines. Reject malformed historical
    // snapshots for review rather than generating incomplete commissions.
    const seen = new Set();
    let snapshotTotal = 0;
    for (const item of order.items) {
      const id = String(item.product);
      const price = minorUnits(item.sellingPriceSnapshot);
      if (seen.has(id) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || price == null ||
          !Number.isFinite(item.costPriceSnapshot)) {
        const error = new Error("Order items require review");
        error.reviewReason = "invalid_order_items";
        throw error;
      }
      seen.add(id);
      snapshotTotal += price * item.quantity;
    }
    if (!seen.size || !Number.isSafeInteger(snapshotTotal) || snapshotTotal !== expectedAmount) {
      const error = new Error("Order totals require review");
      error.reviewReason = "invalid_order_items";
      throw error;
    }
    for (const item of order.items) {
      const update = await Product.updateOne(
        { _id: item.product, isActive: true, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } }, { session }
      );
      if (update.modifiedCount !== 1) {
        const error = new Error("Payment received but stock is unavailable");
        error.reviewReason = "stock_unavailable";
        throw error;
      }
    }
    // This write serializes different transactions paying the same order as
    // well as duplicate verification callbacks. Every write shares the session.
    copyPayment(order, receipt);
    order.payment.resolutionRequired = false;
    order.payment.resolutionReason = undefined;
    order.status = "paid";
    await order.save({ session });
    await generateCommissionsForOrder(order, { session });
    receipt.status = "fulfilled";
    receipt.resolutionRequired = false;
    receipt.resolutionReason = undefined;
    await receipt.save({ session });
    return result(order, receipt);
  }, transactionOptions);
}

// Asks Flutterwave about a transaction and stores the answer as a durable
// receipt, matched to the order that issued its reference (or kept for admin
// review when no order did). Shared by the buyer's callback and the webhook.
async function createReceiptFromProvider(id) {
  const receiptId = `flutterwave:${id}`;
  let receipt;
  const verified = await verifyFlutterwaveTransaction(id);
  if (!verified.verified) throw new ApiError(400, "Payment could not be verified");
  if (normalizeTransactionId(verified.transactionId) !== id ||
      typeof verified.reference !== "string" || !verified.reference ||
      typeof verified.currency !== "string" || !verified.currency ||
      !Number.isFinite(Number(verified.amount)) || Number(verified.amount) <= 0) {
    throw new ApiError(502, "Payment provider returned incomplete or inconsistent details");
  }
  const owner = await Order.findOne({
    "payment.expectedReferences": verified.reference, saleType: "online",
  }).select("_id");
  const receiptData = {
    _id: receiptId, transactionId: id, order: owner?._id || null,
    reference: verified.reference, amount: Number(verified.amount), currency: verified.currency,
    verifiedAt: new Date(), raw: verified.raw,
    status: owner ? "received" : "review", resolutionRequired: true,
    resolutionReason: owner ? "processing_pending" : "unmatched_reference",
  };
  try {
    receipt = await PaymentReceipt.findOneAndUpdate({ _id: receiptId },
      { $setOnInsert: receiptData }, { upsert: true, new: true });
  } catch (err) {
    if (err.code !== 11000) throw err;
    receipt = await PaymentReceipt.findById(receiptId);
  }
  return receipt;
}

async function verifyOrderPayment({ orderId, transactionId }, buyerId) {
  if (!mongoose.isObjectIdOrHexString(orderId)) throw new ApiError(400, "Invalid order ID");
  const id = normalizeTransactionId(transactionId);
  if (!id) throw new ApiError(400, "Invalid transaction ID");
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found");
  if (!order.buyer || String(order.buyer) !== String(buyerId)) throw new ApiError(403, "Not your order");
  if (order.saleType === "in_store") throw new ApiError(400, "In-store sales cannot be verified through Flutterwave");
  const receiptId = `flutterwave:${id}`;
  let receipt = await PaymentReceipt.findById(receiptId);
  if (receipt?.order && String(receipt.order) !== String(order._id)) {
    throw new ApiError(409, "This payment belongs to another order");
  }
  // Historical fulfilled orders are preserved; never decrement them again.
  if (!receipt && order.payment.verified && fulfilledStatuses.includes(order.status) &&
      !order.payment.expectedReferences?.length) {
    return { status: order.status, paymentReceived: true, requiresResolution: Boolean(order.payment.resolutionRequired) };
  }
  if (!receipt) receipt = await createReceiptFromProvider(id);
  if (!receipt.order || String(receipt.order) !== String(order._id)) {
    throw new ApiError(400, "Payment reference does not match this order. The successful payment has been retained for admin review.");
  }
  try {
    const outcome = await fulfill(receiptId);
    if (["amount_mismatch", "currency_mismatch"].includes(receipt.resolutionReason)) {
      throw new ApiError(400, "Payment details do not match this order; admin review is required");
    }
    return outcome;
  } catch (err) {
    if (err.statusCode) throw err;
    const reason = err.reviewReason || "processing_error";
    // The durable receipt is intentionally outside the fulfillment transaction.
    // Even if this review update fails, admins can see the received payment.
    let outcome;
    try { outcome = await markReview(receiptId, reason); } catch { /* receipt remains received/review */ }
    if (reason === "stock_unavailable" || reason === "order_not_payable" || reason === "invalid_order_items") {
      return outcome || { status: "payment_review", paymentReceived: true, requiresResolution: true };
    }
    if (reason === "amount_mismatch" || reason === "currency_mismatch") {
      throw new ApiError(400, "Payment amount or currency does not match this order. Payment retained for admin review.");
    }
    throw new ApiError(503, "Payment received, but order processing could not finish. Retry verification with the same transaction ID; do not pay again.");
  }
}

// Called by the Flutterwave webhook, with no logged-in buyer. The webhook body
// is never trusted for amounts or references: only the transaction ID is used,
// and everything else comes from asking Flutterwave directly. The outcome goes
// through the same fulfillment transaction as the buyer's own callback, so a
// webhook racing that callback (or being delivered twice) still deducts stock
// and creates commissions exactly once.
async function settleProviderTransaction(rawTransactionId) {
  const id = normalizeTransactionId(rawTransactionId);
  if (!id) return { handled: false, reason: "invalid_transaction_id" };
  const receiptId = `flutterwave:${id}`;
  const receipt = (await PaymentReceipt.findById(receiptId)) || (await createReceiptFromProvider(id));
  if (!receipt.order) return { handled: true, reason: "unmatched_reference" };
  try {
    const outcome = await fulfill(receiptId);
    return { handled: true, status: outcome.status };
  } catch (err) {
    if (err.statusCode) throw err;
    const reason = err.reviewReason || "processing_error";
    try { await markReview(receiptId, reason); } catch { /* receipt stays received/review */ }
    // Anything but a transient processing error is retained for an admin, so
    // Flutterwave should not keep resending it. A transient error should be retried.
    if (reason === "processing_error") {
      throw new ApiError(503, "Payment received, but order processing could not finish");
    }
    return { handled: true, reason };
  }
}

module.exports = { verifyOrderPayment, settleProviderTransaction };
