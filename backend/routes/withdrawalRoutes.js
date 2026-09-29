const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/withdrawalController");
const { protect, adminOnly } = require("../middlewares/auth");

router.post("/", protect, ctrl.requestWithdrawal);
router.get("/mine", protect, ctrl.myWithdrawals);

router.get("/admin/all", protect, adminOnly, ctrl.adminListWithdrawals);
router.patch("/admin/:id", protect, adminOnly, ctrl.adminUpdateWithdrawal);

module.exports = router;
