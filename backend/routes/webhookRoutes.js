const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/webhookController");

// Authenticated by Flutterwave's secret hash header, not by a login cookie.
router.post("/flutterwave", ctrl.flutterwave);

module.exports = router;
