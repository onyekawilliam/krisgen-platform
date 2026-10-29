const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/adminController");
const { protect, adminOnly } = require("../middlewares/auth");

router.use(protect, adminOnly);

router.get("/payments/review", ctrl.listPaymentReviews);
router.get("/stats", ctrl.dashboardStats);
router.get("/members", ctrl.listMembers);
router.get("/members/:id", ctrl.getMember);
router.patch("/members/:id/status", ctrl.setMemberStatus);
router.post("/orders/in-store", ctrl.recordInStoreSale);

module.exports = router;
