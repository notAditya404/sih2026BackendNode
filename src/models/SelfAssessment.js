const mongoose = require("mongoose");

// Covers both the signup wellness survey (source: "signup" - workPressure/
// lastLeave also collected) and the daily check-in (source: "daily-checkin").
// sleepHours and mealsPerDay are asked both times, as raw numbers - this is
// what feeds the ML model directly (see services/mlRecordBuilder.js), no
// mood/stressLevel/dietQuality bucket vocabulary anymore.
const selfAssessmentSchema = new mongoose.Schema(
  {
    personnel: { type: mongoose.Schema.Types.ObjectId, ref: "Personnel", required: true },
    source: { type: String, enum: ["signup", "daily-checkin"], required: true },
    sleepHours: { type: Number, min: 0, max: 24 },
    mealsPerDay: { type: Number, min: 0 },
    workPressure: { type: String },
    lastLeave: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

selfAssessmentSchema.index({ personnel: 1, createdAt: -1 });

module.exports = mongoose.model("SelfAssessment", selfAssessmentSchema);
