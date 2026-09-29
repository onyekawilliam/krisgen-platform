const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/orderController");
const { protect, adminOnly } = require("../middlewares/auth");

router.post("/", protect, ctrl.createOrder);
router.post("/verify-payment", protect, ctrl.verifyPayment);
router.get("/mine", protect, ctrl.myOrders);
router.patch("/:id/cancel", protect, ctrl.cancelMyOrder);

router.get("/admin/all", protect, adminOnly, ctrl.adminListOrders);
router.patch("/admin/:id/status", protect, adminOnly, ctrl.adminUpdateOrderStatus);

module.exports = router;
