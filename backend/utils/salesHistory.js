const Order = require("../models/Order");
const Commission = require("../models/Commission");

// True when a phone appears in any order or commission. Such a phone is never
// deleted, so those records stay complete; it can only be hidden.
async function isInSalesHistory(productId) {
  return Boolean(await Order.exists({ "items.product": productId }) || await Commission.exists({ product: productId }));
}

module.exports = { isInSalesHistory };
