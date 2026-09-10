const HrIndicator = require("../models/HrIndicator");
const StressPrediction = require("../models/StressPrediction");
const { getOrComputeTodaySnapshot } = require("../services/wellnessEngine");
const { getEffectiveScore } = require("../services/effectiveScore");
const { toDisplayDate, toDisplayTime, startOfUTCDay, addDays } = require("../services/dateFormat");
const asyncHandler = require("../utils/asyncHandler");

const getMe = asyncHandler(async (req, res) => {
  const p = req.personnel;
  res.json({
    fullName: p.fullName,
    rank: p.rank,
    verified: p.verified,
    personalInfo: { dob: p.dob, gender: p.gender, email: p.email, bloodGroup: p.bloodGroup },
  });
});

async function getLatestAssignedDuty(personnelId) {
  const latest = await HrIndicator.findOne({ personnel: personnelId }).sort({ assignedAt: -1 });
  if (!latest) return null;

  return { date: toDisplayDate(latest.date), hours: latest.hours, remark: latest.remark };
}

const getHomeDashboard = asyncHandler(async (req, res) => {
  const snapshot = await getOrComputeTodaySnapshot(req.personnel._id);
  const effective = await getEffectiveScore(req.personnel._id);
  const assignedDuty = await getLatestAssignedDuty(req.personnel._id);

  res.json({
    personnel: { fullName: req.personnel.fullName },
    // score/riskLevel reflect the real ML model once POST /admin/ml-predictions/recompute
    // has run for today - description/trend still come from the heuristic
    // engine, which doesn't have a real-ML equivalent yet.
    wellnessStatus: {
      score: effective?.wellnessScore ?? snapshot.wellnessScore,
      label: effective?.status ?? snapshot.status,
      riskLevel: effective?.riskLabel ?? snapshot.riskLabel,
      description: snapshot.description,
      trend: snapshot.trendDirection,
    },
    atAGlance: snapshot.atAGlance,
    assignedDuty,
  });
});

// 11 evenly-spaced points across the last 30 days, matching the contract
// example's point count, ending at today's already-computed score. Days
// with no stored snapshot (the daily job hasn't run that far back yet)
// carry forward the nearest earlier known score instead of guessing.
async function buildThirtyDayTrend(personnelId, todaySnapshot) {
  const today = startOfUTCDay();
  const days = Array.from({ length: 11 }, (_, i) => addDays(today, -(30 - i * 3)));

  const snapshots = await StressPrediction.find({ personnel: personnelId, snapshotDate: { $in: days } });
  const byDate = new Map(snapshots.map((s) => [s.snapshotDate.getTime(), s.wellnessScore]));

  let lastKnown = todaySnapshot.wellnessScore;
  const points = days.map((d, i) => {
    if (i === days.length - 1) return todaySnapshot.wellnessScore;
    const value = byDate.get(d.getTime());
    if (value !== undefined) lastKnown = value;
    return lastKnown;
  });

  return {
    rangeLabel: "Last 30 Days",
    points,
    summary: `Your wellness score is currently ${todaySnapshot.status.toLowerCase()}, trending ${todaySnapshot.trendDirection.toLowerCase()}.`,
  };
}

const getWellness = asyncHandler(async (req, res) => {
  const snapshot = await getOrComputeTodaySnapshot(req.personnel._id);
  const effective = await getEffectiveScore(req.personnel._id);

  res.json({
    // score/status/riskLevel reflect the real ML model once it's connected
    // and recomputed for today - pillars/influencingFactors/trend stay on
    // the heuristic engine, which has no real-ML equivalent for them yet.
    score: effective?.wellnessScore ?? snapshot.wellnessScore,
    status: effective?.status ?? snapshot.status,
    riskLevel: effective?.riskLabel ?? snapshot.riskLabel,
    description: snapshot.description,
    lastUpdated: `Today, ${toDisplayTime(snapshot.computedAt)}`,
    pillars: snapshot.pillars,
    influencingFactors: snapshot.influencingFactors,
    trend: await buildThirtyDayTrend(req.personnel._id, snapshot),
  });
});

const getAIInsights = asyncHandler(async (req, res) => {
  const snapshot = await getOrComputeTodaySnapshot(req.personnel._id);
  res.json(snapshot.aiInsights);
});

module.exports = { getMe, getHomeDashboard, getWellness, getAIInsights };
