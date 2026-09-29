const crypto = require("crypto");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Commission = require("../models/Commission");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { verifyFlutterwaveTransaction } = require("../services/paymentService");
const { generateCommissionsForOrder, reverseCommissionsForOrder } = require("../services/commissionService");

// Creates a pending order from selling-price snapshots taken server-side —
// the frontend sends product IDs and quantities only, never prices.
// `sellerCode` is optional: pass an affiliate's referral code at checkout if
// this purchase is being recorded as a sale made by that affiliate (e.g. the
// affiliate is checking out on behalf of a walk-in customer). If omitted,
// this is a plain customer purchase with soldBy = null (no commission).
exports.createOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Order must contain at least one item");
  }

 // Automatically credit the member who originally referred this buyer
const buyer = await User.findById(req.user._id).select("referredBy");
const soldBy = buyer?.referredBy || null;

  const orderItems = [];
  let totalAmount = 0;
  for (const line of items) {
    const product = await Product.findById(line.productId).select("+costPrice");
    if (!product || !product.isActive) throw new ApiError(400, `Product ${line.productId} is unavailable`);
    if (product.stock < line.quantity) throw new ApiError(400, `${product.name} is out of stock`);

    orderItems.push({
      product: product._id,
      name: product.name,
      quantity: line.quantity,
      sellingPriceSnapshot: product.sellingPrice,
      costPriceSnapshot: product.costPrice,
    });
    totalAmount += product.sellingPrice * line.quantity;
  }

  const order = await Order.create({
    orderNumber: `KRG-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
    buyer: req.user._id,
    soldBy,
    items: orderItems,
    totalAmount,
    shippingAddress,
    status: "pending_payment",
  });

  res.status(201).json({
    success: true,
    data: { orderId: order._id, orderNumber: order.orderNumber, totalAmount },
  });
});

// Called after the frontend redirects back from Flutterwave with a
// transaction_id. This is the ONLY place an order moves to "paid" — the
// amount and status are re-verified against Flutterwave's API, never taken
// from the query string / frontend claim.
exports.verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, transactionId } = req.body;

  const order = await Order.findById(orderId).select("+items.costPriceSnapshot");
  if (!order) throw new ApiError(404, "Order not found");
  if (order.buyer.toString() !== req.user._id.toString()) throw new ApiError(403, "Not your order");
  if (order.status === "paid") {
    return res.json({ success: true, message: "Order already confirmed", data: { status: order.status } });
  }

  const result = await verifyFlutterwaveTransaction(transactionId);

  if (!result.verified || Math.round(result.amount) !== Math.round(order.totalAmount)) {
    order.payment.reference = transactionId;
    order.payment.verified = false;
    order.payment.raw = result.raw;
    await order.save();
    throw new ApiError(400, "Payment could not be verified");
  }

  order.status = "paid";
  order.payment = {
    provider: "flutterwave",
    reference: result.reference,
    verified: true,
    verifiedAt: new Date(),
    raw: result.raw,
  };
  await order.save();

  // Decrement stock now that payment is confirmed
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
  }

  await generateCommissionsForOrder(order);

  res.json({ success: true, data: { status: order.status } });
});

exports.myOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ buyer: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: orders });
});

exports.cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (order.buyer.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Not your order");
  }

  if (order.status !== "pending_payment") {
    throw new ApiError(
      400,
      "Only orders awaiting payment can be cancelled"
    );
  }

  order.status = "cancelled";
  await order.save();

  res.json({
    success: true,
    message: "Order cancelled",
    data: order,
  });
});

// ----- Admin -----

exports.adminListOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = status ? { status } : {};
  const orders = await Order.find(query)
  .populate("buyer", "name email phone")
  .populate("items.product", "brand model name")
  .sort({ createdAt: -1 });
  res.json({ success: true, data: orders });
});

exports.adminUpdateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ["processing", "delivered", "cancelled", "refunded"];
  if (!allowed.includes(status)) throw new ApiError(400, "Invalid status");

  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  order.status = status;
  await order.save();

  if (status === "cancelled" || status === "refunded") {
    await reverseCommissionsForOrder(order._id);
  }

  res.json({ success: true, data: order });
});
