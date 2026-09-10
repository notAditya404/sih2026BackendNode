const HrIndicator = require("../models/HrIndicator");
const StressPrediction = require("../models/StressPrediction");
const { getOrComputeTodaySnapshot } = require("../services/wellnessEngine");
const { toDisplayDate, startOfUTCDay, addDays } = require("../services/dateFormat");
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
  const assignedDuty = await getLatestAssignedDuty(req.personnel._id);

  res.json({
    personnel: { fullName: req.personnel.fullName },
    wellnessStatus: { label: snapshot.status, description: snapshot.description, trend: snapshot.trendDirection },
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

  res.json({
    score: snapshot.wellnessScore,
    status: snapshot.status,
    description: snapshot.description,
    lastUpdated: `Today, ${new Date(snapshot.computedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}`,
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
