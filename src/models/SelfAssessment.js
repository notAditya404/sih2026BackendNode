const mongoose = require("mongoose");

// Covers both the signup wellness survey (source: "signup" - dietQuality/
// workPressure/lastLeave) and the daily check-in (source: "daily-checkin" -
// mood/stressLevel). sleepHours is asked both times, same bucket vocabulary
// ("7-8 hrs" etc.) either way.
const selfAssessmentSchema = new mongoose.Schema(
  {
    personnel: { type: mongoose.Schema.Types.ObjectId, ref: "Personnel", required: true },
    source: { type: String, enum: ["signup", "daily-checkin"], required: true },
    mood: { type: String },
    sleepHours: { type: String },
    stressLevel: { type: String },
    dietQuality: { type: String },
    workPressure: { type: String },
    lastLeave: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

selfAssessmentSchema.index({ personnel: 1, createdAt: -1 });

module.exports = mongoose.model("SelfAssessment", selfAssessmentSchema);
