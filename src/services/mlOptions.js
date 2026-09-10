// Single source of truth for the two new enums the ML model needs
// (terrain_type, shift_type). Values copied verbatim from the model repo's
// stress_engine.py (TERRAIN_SCORE_MAP / SHIFT_TYPE_SCORE_MAP) - note
// "high altitude/snow" is ONE combined key there, not two separate options.
const TERRAIN_TYPE_OPTIONS = [
  "plain",
  "coastal",
  "forest",
  "desert",
  "border",
  "high altitude/snow",
];

const SHIFT_TYPE_OPTIONS = ["day", "night"];

module.exports = { TERRAIN_TYPE_OPTIONS, SHIFT_TYPE_OPTIONS };
