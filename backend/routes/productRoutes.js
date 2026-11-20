const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/productController");
const { protect, adminOnly } = require("../middlewares/auth");
const productImageUpload = require("../middlewares/productImageUpload");
const productVideoUpload = require("../middlewares/productVideoUpload");

router.get("/", ctrl.listProducts);
router.get("/:id", ctrl.getProduct);

router.get("/admin/all", protect, adminOnly, ctrl.adminListProducts);
router.get("/admin/:id", protect, adminOnly, ctrl.adminGetProduct);
router.post("/admin", protect, adminOnly, ctrl.createProduct);
router.patch("/admin/:id", protect, adminOnly, ctrl.updateProduct);
router.delete("/admin/:id", protect, adminOnly, ctrl.deactivateProduct);
router.delete("/admin/:id/permanent", protect, adminOnly, ctrl.deleteProduct);
router.post("/admin/:id/images", protect, adminOnly, productImageUpload, ctrl.addProductPhoto);
router.delete("/admin/:id/images/:index", protect, adminOnly, ctrl.deleteProductPhoto);
router.post("/admin/:id/images/:index/primary", protect, adminOnly, ctrl.makePrimaryPhoto);
router.post("/admin/:id/videos", protect, adminOnly, productVideoUpload, ctrl.addProductVideo);
router.delete("/admin/:id/videos/:index", protect, adminOnly, ctrl.deleteProductVideo);

module.exports = router;
