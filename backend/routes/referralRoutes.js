const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/referralController");
const { protect, adminOnly } = require("../middlewares/auth");

router.get("/mine", protect, ctrl.myReferrals);
router.get("/admin/all", protect, adminOnly, ctrl.adminListReferrals);

module.exports = router;
