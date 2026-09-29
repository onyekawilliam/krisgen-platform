const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/authController");
const { protect } = require("../middlewares/auth");

router.post("/register", ctrl.register);
router.post("/login", ctrl.login);
router.post("/logout", ctrl.logout);
router.post("/forgot-password", ctrl.forgotPassword);
router.post("/reset-password", ctrl.resetPassword);

router.get("/me", protect, ctrl.me);
router.patch("/me", protect, ctrl.updateProfile);

module.exports = router;
