const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/commissionController");
const { protect, adminOnly } = require("../middlewares/auth");

router.get("/mine", protect, ctrl.myCommissions);

router.get("/admin/all", protect, adminOnly, ctrl.adminListCommissions);
router.patch("/admin/:id/status", protect, adminOnly, ctrl.adminUpdateCommissionStatus);
router.get("/admin/settings", protect, adminOnly, ctrl.adminGetSettings);
router.patch("/admin/settings", protect, adminOnly, ctrl.adminUpdateSettings);

module.exports = router;
