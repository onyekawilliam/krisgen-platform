const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/productController");
const { protect, adminOnly } = require("../middlewares/auth");

router.get("/", ctrl.listProducts);
router.get("/:id", ctrl.getProduct);

router.get("/admin/all", protect, adminOnly, ctrl.adminListProducts);
router.get("/admin/:id", protect, adminOnly, ctrl.adminGetProduct);
router.post("/admin", protect, adminOnly, ctrl.createProduct);
router.patch("/admin/:id", protect, adminOnly, ctrl.updateProduct);
router.delete("/admin/:id", protect, adminOnly, ctrl.deactivateProduct);

module.exports = router;
