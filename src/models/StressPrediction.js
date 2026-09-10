const mongoose = require("mongoose");

// One document per (personnel, day) - a daily snapshot of the wellness
// engine's output for that personnel. This is what both contracts call
// `stress_predictions`: the mobile app's /wellness and /ai-insights read
// the latest snapshot for the logged-in personnel, the web app's
// GET /personnel reads it for `risk`/`riskScore`, and GET /admin/wellness-summary
// averages a week of snapshots across an admin's linked personnel.
const pillarSchema = new mongoose.Schema(
  {
    key: String,
    label: String,
    score: Number,
    status: String,
  },
  { _id: false },
);

const factorSchema = new mongoose.Schema(
  {
    key: String,
    label: String,
    value: String,
  },
  { _id: false },
);

const contributingFactorSchema = new mongoose.Schema(
  {
    key: String,
    label: String,
    description: String,
    impact: String,
    impactPercent: Number,
  },
  { _id: false },
);

const stressPredictionSchema = new mongoose.Schema(
  {
    personnel: { type: mongoose.Schema.Types.ObjectId, ref: "Personnel", required: true },
    snapshotDate: { type: Date, required: true },

    wellnessScore: { type: Number, required: true },
    riskScore: { type: Number, required: true },
    riskLabel: { type: String, enum: ["High", "Moderate", "Low"], required: true },
    status: { type: String, required: true },
    description: { type: String, required: true },
    trendDirection: { type: String, enum: ["Improving", "Stable", "Declining"], required: true },

    pillars: [pillarSchema],
    influencingFactors: [factorSchema],

    atAGlance: {
      dutyLoad: { value: String, note: String },
      avgRestGap: { value: String, note: String },
      nightDuties: { value: String, note: String },
    },

    aiInsights: {
      summaryTitle: String,
      summaryDescription: String,
      outlookScore: Number,
      outlookLabel: String,
      contributingFactors: [contributingFactorSchema],
      prediction: { text: String, riskPercent: Number, riskLabel: String },
      recommendation: { title: String, description: String },
    },
  },
  { timestamps: { createdAt: "computedAt", updatedAt: false } },
);

stressPredictionSchema.index({ personnel: 1, snapshotDate: 1 }, { unique: true });

module.exports = mongoose.model("StressPrediction", stressPredictionSchema);
