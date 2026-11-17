const asyncHandler = require("../utils/asyncHandler");
const Settings = require("../models/Settings");

// What customers need to know about collecting from the shop. Public: it holds
// no private data, only what the owner chose to publish in Settings.
exports.pickupInfo = asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();
  res.json({
    success: true,
    data: {
      enabled: settings.pickupEnabled !== false,
      address: settings.pickupAddress || "",
      instructions: settings.pickupInstructions || "",
    },
  });
});
