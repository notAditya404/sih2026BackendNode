const Personnel = require("../models/Personnel");
const MlPrediction = require("../models/MlPrediction");
const { buildMlRecord } = require("../services/mlRecordBuilder");
const { predictRisk } = require("../services/mlClient");
const { startOfUTCDay } = require("../services/dateFormat");
const asyncHandler = require("../utils/asyncHandler");

// Processes every personnel in the system (not just this admin's linked
// list) - this is meant to be a system-wide daily ML batch job, run manually
// via this endpoint for now until a scheduler calls it. One personnel's
// failure (e.g. ML_MODEL_URL not set yet, or the model service being down)
// doesn't stop the rest - each is tried independently and reported.
const recomputeAll = asyncHandler(async (req, res) => {
  const today = startOfUTCDay();
  const allPersonnel = await Personnel.find().select("_id");

  const results = { total: allPersonnel.length, succeeded: 0, failed: 0, errors: [] };

  for (const p of allPersonnel) {
    try {
      const record = await buildMlRecord(p._id);
      const prediction = await predictRisk(record);

      await MlPrediction.findOneAndUpdate(
        { personnel: p._id, snapshotDate: today },
        {
          $set: {
            inputs: record,
            mlRiskScore: prediction.ml_predicted_risk_score,
            mlStressLevel: prediction.ml_predicted_stress_level,
            deterministicRiskScore: prediction.deterministic_risk_score,
            deterministicStressLevel: prediction.deterministic_stress_level,
          },
        },
        { upsert: true, new: true },
      );
      results.succeeded += 1;
    } catch (error) {
      results.failed += 1;
      results.errors.push({ personnel: String(p._id), message: error.message });
    }
  }

  res.json(results);
});

module.exports = { recomputeAll };
