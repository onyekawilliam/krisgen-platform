const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/storeController");

router.get("/pickup", ctrl.pickupInfo);

module.exports = router;
