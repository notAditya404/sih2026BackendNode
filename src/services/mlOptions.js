// Single source of truth for the two new enums the ML model needs
// (terrain_type, shift_type). Both apps' dropdowns should mirror these
// exact values - they're sent to the model as-is, so changing them here
// means updating the model's TERRAIN_SCORE_MAP / SHIFT_TYPE_SCORE_MAP too.
const TERRAIN_TYPE_OPTIONS = [
  "plain",
  "coastal",
  "forest",
  "desert",
  "border",
  "high altitude",
  "snow",
];

const SHIFT_TYPE_OPTIONS = ["day", "night"];

module.exports = { TERRAIN_TYPE_OPTIONS, SHIFT_TYPE_OPTIONS };
