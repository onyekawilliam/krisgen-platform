const crypto = require("crypto");
const Product = require("../models/Product");
const Referral = require("../models/Referral");
const Commission = require("../models/Commission");
const Settings = require("../models/Settings");

/**
 * Generates commission records for a paid order. Called exactly once, from
 * the payment verification flow (never trust the frontend to trigger this).
 *
 * Rules encoded here:
 *  - No commission at all unless the order has a soldBy (an affiliate made
 *    the sale). A plain customer purchase with no seller generates nothing.
 *  - Commission is computed on GROSS PROFIT (selling - cost), never on the
 *    selling price. Rates come from Settings, with an optional per-product
 *    override.
 *  - The direct seller earns commissionRate. If that seller was themselves
 *    referred by someone, the referrer earns ONE override on the same sale,
 *    at referralOverrideRate. This never chains further — the override
 *    lookup does exactly one hop up the Referral collection.
 *  - Every commission stores its own snapshot of price/cost/profit so later
 *    product price changes can never alter it.
 *  - idempotencyKey prevents the same order from generating commissions twice
 *    even if this function is accidentally called more than once for it.
 */
async function generateCommissionsForOrder(order) {

  // console.log("=== COMMISSION DEBUG ===");
  // console.log("Order:", order._id);
  // console.log("soldBy:", order.soldBy);
  // console.log("Items:", order.items);

  if (!order.soldBy) {
    return []; // plain customer purchase — no seller, no commission
  }

  const settings = await Settings.getSettings();
  const created = [];

  for (const item of order.items) {
    const product = await Product.findById(item.product).select("+costPrice");
    if (!product) continue;

    const rate =
      typeof product.commissionRateOverride === "number"
        ? product.commissionRateOverride
        : settings.directCommissionRate;

    const grossProfitUnit = item.sellingPriceSnapshot - item.costPriceSnapshot;
    const grossProfit = grossProfitUnit * item.quantity;
    const commissionAmount = round2(grossProfit * (rate / 100));

    const directKey = idKey(order._id, item.product, "direct");
    const existingDirect = await Commission.findOne({ idempotencyKey: directKey });
    if (!existingDirect) {

      // // console.log("Creating direct commission:", {
      //   beneficiary: order.soldBy,
      //   grossProfit,
      //   rate,
      //   commissionAmount,
      // });

      const directCommission = await Commission.create({
        order: order._id,
        product: item.product,
        beneficiary: order.soldBy,
        type: "direct",
        sourceSeller: null,
        quantity: item.quantity,
        sellingPriceSnapshot: item.sellingPriceSnapshot,
        costPriceSnapshot: item.costPriceSnapshot,
        grossProfitSnapshot: grossProfit,
        commissionRate: rate,
        commissionAmount,
        status: "pending",
        idempotencyKey: directKey,
      });
      created.push(directCommission);
    }

    // One-hop override: does the seller have a referrer?
    const referral = await Referral.findOne({ referred: order.soldBy });
    if (referral) {
      const overrideRate = settings.referralOverrideRate;
      const overrideAmount = round2(grossProfit * (overrideRate / 100));
      const overrideKey = idKey(order._id, item.product, "override");
      const existingOverride = await Commission.findOne({ idempotencyKey: overrideKey });
      if (!existingOverride) {
        const overrideCommission = await Commission.create({
          order: order._id,
          product: item.product,
          beneficiary: referral.referrer,
          type: "override",
          sourceSeller: order.soldBy,
          quantity: item.quantity,
          sellingPriceSnapshot: item.sellingPriceSnapshot,
          costPriceSnapshot: item.costPriceSnapshot,
          grossProfitSnapshot: grossProfit,
          commissionRate: overrideRate,
          commissionAmount: overrideAmount,
          status: "pending",
          idempotencyKey: overrideKey,
        });
        created.push(overrideCommission);
      }
    }
  }

  return created;
}

/**
 * Reverses all commissions tied to an order (e.g. on cancellation/refund).
 * Paid commissions are marked "reversed" rather than deleted, preserving the
 * audit trail; pending/approved ones are simply cancelled.
 */
async function reverseCommissionsForOrder(orderId) {
  const commissions = await Commission.find({ order: orderId });
  for (const c of commissions) {
    c.status = c.status === "paid" ? "reversed" : "cancelled";
    await c.save();
  }
  return commissions;
}

function idKey(orderId, productId, type) {
  return crypto
    .createHash("sha256")
    .update(`${orderId}:${productId}:${type}`)
    .digest("hex");
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { generateCommissionsForOrder, reverseCommissionsForOrder };
