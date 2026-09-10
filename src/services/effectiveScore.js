const MlPrediction = require("../models/MlPrediction");
const StressPrediction = require("../models/StressPrediction");
const { bucketLevel, bucketWellness, describeWellness, getOrComputeTodaySnapshot } = require("./wellnessEngine");
const { startOfUTCDay } = require("./dateFormat");

// The score + risk level shown everywhere (personnel's own wellness score,
// admin's unit average, admin's personnel list) - the real ML model's
// result for that day when POST /admin/ml-predictions/recompute has stored
// one, otherwise the heuristic engine's snapshot. Never mixes fields from
// both for the same personnel/day - one wins outright, so the number and
// its label always agree.
function fromMlPrediction(mlPrediction) {
  const riskScore = Math.round(mlPrediction.mlRiskScore);
  const wellnessScore = Math.round(100 - mlPrediction.mlRiskScore);
  const wellnessLabel = bucketWellness(wellnessScore);
  return {
    wellnessScore,
    riskScore,
    // Bucketed from the model's own risk score (not mlStressLevel's raw
    // text) so it always matches the High/Moderate/Low vocabulary the rest
    // of the app - and both apps' badges/filters - already expect.
    riskLabel: bucketLevel(riskScore, 65, 40),
    status: wellnessLabel,
    description: describeWellness(wellnessLabel),
    source: "ml",
  };
}

function fromHeuristicSnapshot(snapshot) {
  return {
    wellnessScore: snapshot.wellnessScore,
    riskScore: snapshot.riskScore,
    riskLabel: snapshot.riskLabel,
    status: snapshot.status,
    description: snapshot.description,
    source: "heuristic",
  };
}

/** For one personnel on one day: today's ML prediction if one has been computed, else the heuristic snapshot (computed on demand only for today). */
async function getEffectiveScore(personnelId, day = startOfUTCDay()) {
  const mlPrediction = await MlPrediction.findOne({ personnel: personnelId, snapshotDate: day });
  if (mlPrediction) return fromMlPrediction(mlPrediction);

  const isToday = day.getTime() === startOfUTCDay().getTime();
  const snapshot = isToday
    ? await getOrComputeTodaySnapshot(personnelId)
    : await StressPrediction.findOne({ personnel: personnelId, snapshotDate: day });

  return snapshot ? fromHeuristicSnapshot(snapshot) : null;
}

/**
 * Batch version for a list of personnel on one day (admin views) - two
 * queries total instead of N, same ML-wins-else-heuristic resolution per
 * personnel. Personnel with neither are simply absent from the result map.
 */
async function getEffectiveScoresFor(personnelIds, day = startOfUTCDay()) {
  const [mlPredictions, snapshots] = await Promise.all([
    MlPrediction.find({ personnel: { $in: personnelIds }, snapshotDate: day }),
    StressPrediction.find({ personnel: { $in: personnelIds }, snapshotDate: day }),
  ]);

  const mlByPersonnel = new Map(mlPredictions.map((p) => [String(p.personnel), p]));
  const snapshotByPersonnel = new Map(snapshots.map((s) => [String(s.personnel), s]));

  const result = new Map();
  personnelIds.forEach((id) => {
    const key = String(id);
    const ml = mlByPersonnel.get(key);
    if (ml) {
      result.set(key, fromMlPrediction(ml));
      return;
    }
    const snapshot = snapshotByPersonnel.get(key);
    if (snapshot) result.set(key, fromHeuristicSnapshot(snapshot));
  });
  return result;
}

module.exports = { getEffectiveScore, getEffectiveScoresFor };
