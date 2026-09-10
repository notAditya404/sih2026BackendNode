const Personnel = require("../models/Personnel");
const MlPrediction = require("../models/MlPrediction");
const { buildMlRecord } = require("./mlRecordBuilder");
const { predictRisk } = require("./mlClient");
const { startOfUTCDay } = require("./dateFormat");

// Shared by POST /admin/ml-predictions/recompute (mlPredictions.controller.js)
// and the recompute-ml-predictions script, so there's one place that owns
// "how a recompute run works" - the route is for triggering it on demand
// from the app, the script is for a scheduler (cron, a hosting platform's
// scheduled job) to call it once a day without going through HTTP/auth.
//
// Processes every personnel in the system (not just one admin's linked
// list) - a system-wide daily ML batch job. One personnel's failure (e.g.
// ML_MODEL_URL not set yet, or the model service being down) doesn't stop
// the rest - each is tried independently and reported.
async function recomputeAllMlPredictions() {
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

  return results;
}

module.exports = { recomputeAllMlPredictions };
