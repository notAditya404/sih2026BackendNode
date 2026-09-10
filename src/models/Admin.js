const mongoose = require("mongoose");
const { TERRAIN_TYPE_OPTIONS } = require("../services/mlOptions");

const adminSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: "Welfare Officer" },
    // Unit's terrain - every personnel linked to this admin gets this same
    // terrain_type sent to the ML model (see src/services/mlRecordBuilder.js).
    terrainType: { type: String, enum: TERRAIN_TYPE_OPTIONS, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Admin", adminSchema);
