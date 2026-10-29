const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/productController");
const { protect, adminOnly } = require("../middlewares/auth");
const productImageUpload = require("../middlewares/productImageUpload");

router.get("/", ctrl.listProducts);
router.get("/:id", ctrl.getProduct);

router.get("/admin/all", protect, adminOnly, ctrl.adminListProducts);
router.get("/admin/:id", protect, adminOnly, ctrl.adminGetProduct);
router.post("/admin", protect, adminOnly, ctrl.createProduct);
router.patch("/admin/:id", protect, adminOnly, ctrl.updateProduct);
router.delete("/admin/:id", protect, adminOnly, ctrl.deactivateProduct);
router.post("/admin/:id/image", protect, adminOnly, productImageUpload, ctrl.uploadProductImage);
router.delete("/admin/:id/image", protect, adminOnly, ctrl.deleteProductImage);

module.exports = router;
