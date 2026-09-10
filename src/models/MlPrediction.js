const mongoose = require("mongoose");

// One row per (personnel, day) - written by POST /admin/ml-predictions/recompute.
// Separate from StressPrediction (the old heuristic engine's richer, UI-facing
// snapshot) so the real model's output can be inspected/compared on its own
// without disturbing what the apps currently render. `inputs` is exactly the
// record dict predict_cli.py builds, kept alongside the result for traceability.
const mlPredictionSchema = new mongoose.Schema(
  {
    personnel: { type: mongoose.Schema.Types.ObjectId, ref: "Personnel", required: true },
    snapshotDate: { type: Date, required: true },
    inputs: {
      sleep_hours: { type: Number, required: true },
      shift_duration_hours: { type: Number, required: true },
      shift_type: { type: String, required: true },
      terrain_type: { type: String, required: true },
      leave_rejections: { type: Number, required: true },
      age: { type: Number, required: true },
      meals_per_day: { type: Number, required: true },
    },
    mlRiskScore: { type: Number, required: true },
    mlStressLevel: { type: String, required: true },
    deterministicRiskScore: { type: Number },
    deterministicStressLevel: { type: String },
  },
  { timestamps: { createdAt: "computedAt", updatedAt: false } },
);

mlPredictionSchema.index({ personnel: 1, snapshotDate: 1 }, { unique: true });

module.exports = mongoose.model("MlPrediction", mlPredictionSchema);
