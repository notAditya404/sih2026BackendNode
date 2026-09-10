const StressPrediction = require("../models/StressPrediction");
const HrIndicator = require("../models/HrIndicator");
const SelfAssessment = require("../models/SelfAssessment");
const { getOrComputeTodaySnapshot } = require("./wellnessEngine");
const { getEffectiveScoresFor } = require("./effectiveScore");
const { startOfUTCDay, addDays, toDisplayDate, toDisplayDateTime } = require("./dateFormat");

/** Makes sure every linked personnel has a fresh snapshot for today before any admin view reads it. */
async function ensureTodaySnapshots(personnelIds) {
  await Promise.all(personnelIds.map((id) => getOrComputeTodaySnapshot(id)));
}

// Unit average - per personnel, the real ML model's result for that day
// when recompute has stored one, else the heuristic snapshot (matches
// buildPersonnelListView's per-personnel resolution, so the dashboard's
// average and the personnel tab's individual scores never disagree).
async function averageScoreForDay(personnelIds, day) {
  const scores = await getEffectiveScoresFor(personnelIds, day);
  if (!scores.size) return null;
  const values = [...scores.values()].map((s) => s.wellnessScore);
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

async function getWellnessSummary(personnelIds) {
  await ensureTodaySnapshots(personnelIds);

  const today = startOfUTCDay();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -(6 - i)));
  const scores = await Promise.all(days.map((day) => averageScoreForDay(personnelIds, day)));

  // Days before any personnel had a snapshot (e.g. a brand new admin) fall
  // back to the nearest known score rather than a misleading 0.
  let lastKnown = scores.find((s) => s !== null) ?? 0;
  const trend = days.map((day, i) => {
    const value = scores[i] ?? lastKnown;
    lastKnown = value;
    return { day: toDisplayDate(day), value };
  });

  const score = trend[trend.length - 1].value;
  const weekAgoScore = trend[0].value;
  const delta = score - weekAgoScore;
  const deltaLabel = delta === 0
    ? "No change from last week"
    : `${Math.abs(delta)} pts ${delta > 0 ? "up" : "down"} from last week`;

  return {
    score,
    deltaLabel,
    trendDirection: delta >= 0 ? "up" : "down",
    trend,
    lastUpdated: toDisplayDateTime(new Date()),
  };
}

const RISK_TREND_KEYS = ["High", "Moderate", "Low"];

async function getRiskTrend(personnelIds) {
  const today = startOfUTCDay();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -(6 - i)));

  const byDay = await Promise.all(
    days.map(async (day) => {
      const snapshots = await StressPrediction.find({ personnel: { $in: personnelIds }, snapshotDate: day });
      const counts = { High: 0, Moderate: 0, Low: 0 };
      snapshots.forEach((s) => { counts[s.riskLabel] += 1; });
      return counts;
    }),
  );

  return {
    dates: days.map(toDisplayDate),
    high: byDay.map((c) => c.High),
    moderate: byDay.map((c) => c.Moderate),
    low: byDay.map((c) => c.Low),
  };
}

// Org-wide "Top Contributing Factors" - a different, richer breakdown than
// the mobile app's 3-factor personal one, per API_CONTRACT.md. Derived by
// averaging each linked personnel's stored per-factor impact instead of
// recomputing raw duty/checkin data again here.
const CONTRIBUTING_FACTOR_META = [
  { key: "nightDuty", label: "High Night Duty Frequency", type: "red", source: "nightDutyFrequency" },
  { key: "consecutiveDays", label: "Consecutive Duty Days", type: "orange", source: "consecutiveDutyDays" },
  { key: "shortRest", label: "Short Rest Duration", type: "amber", source: "restGap" },
  { key: "workload", label: "High Workload", type: "purple", source: "deploymentLoad" },
  { key: "sleep", label: "Irregular Sleep Pattern", type: "blue", source: "restGap" },
];

function averageFactorPercent(snapshots, sourceKey) {
  const values = snapshots.map((s) => {
    if (sourceKey === "deploymentLoad") {
      const pillar = s.pillars.find((p) => p.key === "deploymentLoad");
      return pillar ? 100 - pillar.score : null;
    }
    const factor = s.aiInsights?.contributingFactors?.find((f) => f.key === sourceKey);
    return factor ? factor.impactPercent : null;
  }).filter((v) => v !== null);

  return values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : 0;
}

const KEY_INSIGHTS = [
  {
    key: "extendedDuty",
    title: "Extended Duty Hours",
    parts: [
      { text: "Personnel working more than " },
      { text: "12 hrs/day", bold: true },
      { text: " show " },
      { text: "2.4x higher", bold: true },
      { text: " stress risk." },
    ],
  },
  {
    key: "consecutiveDuty",
    title: "Consecutive Duty",
    parts: [
      { text: "Duty periods above " },
      { text: "6 consecutive days", bold: true },
      { text: " increase risk probability by " },
      { text: "1.8x", bold: true },
      { text: "." },
    ],
  },
  {
    key: "insufficientRecovery",
    title: "Insufficient Recovery",
    parts: [
      { text: "Personnel averaging below " },
      { text: "6 hrs sleep", bold: true },
      { text: " show " },
      { text: "1.6x higher", bold: true },
      { text: " stress risk." },
    ],
  },
  {
    key: "nightDutyPattern",
    title: "Night Duty Pattern",
    parts: [
      { text: "Stress indicators are " },
      { text: "18% higher", bold: true },
      { text: " in personnel with frequent night duties." },
    ],
  },
];

async function getAdminAIInsights(personnelIds) {
  await ensureTodaySnapshots(personnelIds);

  const today = startOfUTCDay();
  const [todaySnapshots, riskTrend] = await Promise.all([
    StressPrediction.find({ personnel: { $in: personnelIds }, snapshotDate: today }),
    getRiskTrend(personnelIds),
  ]);

  const riskDistribution = { total: personnelIds.length, high: 0, moderate: 0, low: 0 };
  todaySnapshots.forEach((s) => {
    if (s.riskLabel === "High") riskDistribution.high += 1;
    else if (s.riskLabel === "Moderate") riskDistribution.moderate += 1;
    else riskDistribution.low += 1;
  });

  const contributingFactors = CONTRIBUTING_FACTOR_META.map((meta) => ({
    key: meta.key,
    label: meta.label,
    value: averageFactorPercent(todaySnapshots, meta.source),
    type: meta.type,
  })).sort((a, b) => b.value - a.value);

  const fourteenDaysAgo = addDays(today, -14);
  const [personnelWithDuty, personnelWithCheckin] = await Promise.all([
    HrIndicator.distinct("personnel", { personnel: { $in: personnelIds }, date: { $gte: fourteenDaysAgo } }),
    SelfAssessment.distinct("personnel", { personnel: { $in: personnelIds }, createdAt: { $gte: fourteenDaysAgo } }),
  ]);
  const dataBackedCount = new Set([
    ...personnelWithDuty.map(String),
    ...personnelWithCheckin.map(String),
  ]).size;
  const confidence = personnelIds.length
    ? Math.round((dataBackedCount / personnelIds.length) * 100)
    : 0;
  const confidenceLabel = confidence >= 80 ? "High Confidence" : confidence >= 50 ? "Moderate Confidence" : "Low Confidence";

  const REASON_LABELS = {
    nightDuty: "Night duty",
    consecutiveDays: "Consecutive duty days",
    shortRest: "Reduced rest",
    workload: "High workload",
    sleep: "Irregular sleep",
  };
  const topFactors = contributingFactors.slice(0, 3);

  return {
    riskTrend,
    riskDistribution,
    contributingFactors,
    keyInsights: KEY_INSIGHTS,
    prediction: {
      confidence,
      confidenceLabel,
      atRiskCount: riskDistribution.high,
      reasons: topFactors.map((f) => REASON_LABELS[f.key]),
    },
    priorityFocus: topFactors.length
      ? `${topFactors[0].label} and ${topFactors[1]?.label ?? topFactors[0].label} are currently the strongest drivers of elevated personnel risk.`
      : "Not enough data yet to identify a priority focus.",
  };
}

module.exports = { getWellnessSummary, getAdminAIInsights, ensureTodaySnapshots };
