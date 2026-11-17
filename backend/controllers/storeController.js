const asyncHandler = require("../utils/asyncHandler");
const Settings = require("../models/Settings");
const { NIGERIAN_STATES } = require("../utils/nigeria");

// What customers need to know about collecting from the shop. Public: it holds
// no private data, only what the owner chose to publish in Settings.
// The states customers can choose from, and the towns where delivery is off.
exports.deliveryInfo = asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();
  res.json({
    success: true,
    data: {
      states: NIGERIAN_STATES,
      pickupOnlyAreas: (settings.pickupOnlyAreas || []).map((a) => ({ state: a.state, town: a.town })),
      pickupEnabled: settings.pickupEnabled !== false,
    },
  });
});

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
