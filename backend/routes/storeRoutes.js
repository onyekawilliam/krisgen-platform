const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/storeController");

router.get("/pickup", ctrl.pickupInfo);
router.get("/delivery", ctrl.deliveryInfo);

module.exports = router;
