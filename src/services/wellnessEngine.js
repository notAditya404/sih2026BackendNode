const StressPrediction = require("../models/StressPrediction");
const HrIndicator = require("../models/HrIndicator");
const SelfAssessment = require("../models/SelfAssessment");
const Personnel = require("../models/Personnel");
const { startOfUTCDay, addDays, toDisplayDate } = require("./dateFormat");

const DUTY_WINDOW_DAYS = 14;
const CHECKIN_WINDOW_DAYS = 14;

// workPressure is only ever collected at signup now (daily check-in dropped
// mood/stressLevel in favor of raw sleep_hours + meals_per_day, which feed
// the ML model directly - see mlRecordBuilder.js).
const PRESSURE_SCORE = { Low: 90, Moderate: 65, High: 35, "Very High": 15 };
const LEAVE_RECENCY_SCORE = {
  "This month": 90,
  "1-3 months ago": 70,
  "3-6 months ago": 45,
  "6+ months ago": 20,
};

function average(numbers, fallback) {
  if (!numbers.length) return fallback;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

// sleepHours and mealsPerDay are raw numbers now (not bucketed strings) -
// bucketed into a 0-100 score here for the old heuristic engine's pillars,
// same thresholds as before, just computed from the number directly.
function sleepHoursToScore(hours) {
  if (typeof hours !== "number") return undefined;
  if (hours < 5) return 30;
  if (hours < 6) return 55;
  if (hours < 7) return 75;
  if (hours < 8) return 90;
  return 95;
}

function mealsPerDayToScore(meals) {
  if (typeof meals !== "number") return undefined;
  if (meals <= 0) return 20;
  if (meals === 1) return 45;
  if (meals === 2) return 70;
  return 95;
}

function bucketStatus(score) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Manageable";
  return "Needs Attention";
}

function bucketWellness(score) {
  if (score >= 85) return "Thriving";
  if (score >= 65) return "Balanced";
  if (score >= 45) return "Needs Attention";
  return "At Risk";
}

function bucketLevel(score, high, moderate) {
  if (score >= high) return "High";
  if (score >= moderate) return "Moderate";
  return "Low";
}

/** Longest run of consecutive calendar days (ending today or earlier) that have at least one duty entry. */
function currentDutyStreak(sortedDistinctDates) {
  if (!sortedDistinctDates.length) return 0;

  let streak = 1;
  for (let i = sortedDistinctDates.length - 1; i > 0; i -= 1) {
    const diffDays = (sortedDistinctDates[i] - sortedDistinctDates[i - 1]) / 86400000;
    if (diffDays === 1) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

async function gatherRawMetrics(personnelId, asOf) {
  const dutyWindowStart = addDays(asOf, -DUTY_WINDOW_DAYS);
  const checkinWindowStart = addDays(asOf, -CHECKIN_WINDOW_DAYS);

  const [duties, checkins, signupSurvey, personnel] = await Promise.all([
    HrIndicator.find({ personnel: personnelId, date: { $gte: dutyWindowStart, $lte: asOf } }).sort({ date: 1 }),
    SelfAssessment.find({
      personnel: personnelId,
      source: "daily-checkin",
      createdAt: { $gte: checkinWindowStart },
    }).sort({ createdAt: 1 }),
    SelfAssessment.findOne({ personnel: personnelId, source: "signup" }),
    Personnel.findById(personnelId),
  ]);

  return { duties, checkins, signupSurvey, personnel, asOf };
}

function computeDutyMetrics(duties) {
  if (!duties.length) {
    return { avgHoursPerDutyDay: null, nightDutyCount: 0, consecutiveDutyDays: 0, distinctDayCount: 0 };
  }

  const hoursByDay = new Map();
  duties.forEach((d) => {
    const key = startOfUTCDay(d.date).getTime();
    hoursByDay.set(key, (hoursByDay.get(key) || 0) + d.hours);
  });

  const sortedDates = [...hoursByDay.keys()].sort((a, b) => a - b).map((t) => new Date(t));
  const totalHours = duties.reduce((sum, d) => sum + d.hours, 0);

  return {
    avgHoursPerDutyDay: totalHours / hoursByDay.size,
    // No explicit day/night flag exists on a duty entry (the admin's assign-duty
    // form only collects date/hours/remark) - a >=10hr shift is used as a proxy
    // for one that runs into the night, pending a real duty-type field.
    nightDutyCount: duties.filter((d) => d.hours >= 10).length,
    consecutiveDutyDays: currentDutyStreak(sortedDates),
    distinctDayCount: hoursByDay.size,
  };
}

function computeCheckinMetrics(checkins, signupSurvey) {
  const sleepSamples = checkins.map((c) => sleepHoursToScore(c.sleepHours)).filter((v) => v !== undefined);
  const mealsSamples = checkins.map((c) => mealsPerDayToScore(c.mealsPerDay)).filter((v) => v !== undefined);

  const fallbackSleep = signupSurvey ? sleepHoursToScore(signupSurvey.sleepHours) : undefined;
  const fallbackMeals = signupSurvey ? mealsPerDayToScore(signupSurvey.mealsPerDay) : undefined;
  // Daily check-in no longer asks a stress question directly - this always
  // falls back to the signup survey's workPressure answer.
  const pressureScore = signupSurvey ? PRESSURE_SCORE[signupSurvey.workPressure] ?? 60 : 60;

  return {
    sleepScore: average(sleepSamples, fallbackSleep ?? 70),
    mealsScore: average(mealsSamples, fallbackMeals ?? 65),
    pressureScore,
    leaveRecencyScore: signupSurvey ? LEAVE_RECENCY_SCORE[signupSurvey.lastLeave] ?? 60 : 60,
    lastLeaveAnswer: signupSurvey ? signupSurvey.lastLeave : null,
    hasCheckins: checkins.length > 0,
  };
}

function computePillars(duty, checkin) {
  const dutyLoadScore = duty.avgHoursPerDutyDay === null
    ? 80
    : duty.avgHoursPerDutyDay <= 8 ? 90 : duty.avgHoursPerDutyDay <= 10 ? 70 : duty.avgHoursPerDutyDay <= 12 ? 50 : 25;

  const consecutiveScore = duty.consecutiveDutyDays <= 3 ? 90
    : duty.consecutiveDutyDays <= 5 ? 70
    : duty.consecutiveDutyDays <= 7 ? 45
    : 20;

  const nightDutyScore = duty.nightDutyCount === 0 ? 95
    : duty.nightDutyCount <= 2 ? 75
    : duty.nightDutyCount <= 4 ? 55
    : 30;

  const pillarScores = {
    dutyBalance: Math.round(dutyLoadScore * 0.6 + consecutiveScore * 0.4),
    restRecovery: Math.round(checkin.sleepScore * 0.7 + dutyLoadScore * 0.3),
    nightDutyImpact: Math.round(nightDutyScore),
    deploymentLoad: Math.round(dutyLoadScore * 0.5 + consecutiveScore * 0.5),
    recoveryConsistency: Math.round(checkin.leaveRecencyScore * 0.5 + checkin.sleepScore * 0.3 + checkin.mealsScore * 0.2),
  };

  const pillars = [
    { key: "dutyBalance", label: "Duty Balance", score: pillarScores.dutyBalance, status: bucketStatus(pillarScores.dutyBalance) },
    { key: "restRecovery", label: "Rest & Recovery", score: pillarScores.restRecovery, status: bucketStatus(pillarScores.restRecovery) },
    { key: "nightDutyImpact", label: "Night Duty Impact", score: pillarScores.nightDutyImpact, status: bucketStatus(pillarScores.nightDutyImpact) },
    { key: "deploymentLoad", label: "Deployment Load", score: pillarScores.deploymentLoad, status: bucketStatus(pillarScores.deploymentLoad) },
    { key: "recoveryConsistency", label: "Recovery Consistency", score: pillarScores.recoveryConsistency, status: bucketStatus(pillarScores.recoveryConsistency) },
  ];

  const wellnessScore = Math.round(
    Object.values(pillarScores).reduce((sum, s) => sum + s, 0) / Object.values(pillarScores).length,
  );

  return { pillars, wellnessScore, dutyLoadScore, nightDutyScore, consecutiveScore };
}

function computeInfluencingFactors(duty, checkin, personnel, asOf) {
  const dutyHoursLevel = duty.avgHoursPerDutyDay === null ? "Low"
    : duty.avgHoursPerDutyDay <= 8 ? "Low"
    : duty.avgHoursPerDutyDay <= 10 ? "Moderate"
    : duty.avgHoursPerDutyDay <= 12 ? "High"
    : "Very High";

  const nightDutiesLevel = duty.nightDutyCount >= 5 ? "High" : duty.nightDutyCount >= 3 ? "Elevated" : "Within limits";
  const restGapHrs = duty.avgHoursPerDutyDay === null ? 8 : Math.max(0, 24 - duty.avgHoursPerDutyDay);
  const restGapLevel = restGapHrs >= 8 ? "Good" : restGapHrs >= 6 ? "Fair" : "Poor";
  const consecutiveLevel = duty.consecutiveDutyDays <= 3 ? "Normal" : duty.consecutiveDutyDays <= 5 ? "Elevated" : "High";
  const leaveLevel = !checkin.lastLeaveAnswer ? "Unknown"
    : checkin.lastLeaveAnswer === "6+ months ago" ? "Needs Attention"
    : checkin.lastLeaveAnswer === "3-6 months ago" ? "Fair"
    : "Good";

  // No wearable integration exists anywhere in the system - reporting that
  // honestly rather than fabricating a sensor reading nobody's sending.
  const wearableValue = "Not Connected";

  const deploymentDays = Math.max(0, Math.round((asOf - personnel.createdAt) / 86400000));

  return [
    { key: "dutyHours", label: "Duty Hours", value: dutyHoursLevel },
    { key: "nightDuties", label: "Night Duties", value: nightDutiesLevel },
    { key: "restGap", label: "Rest Gap", value: restGapLevel },
    { key: "consecutiveDutyDays", label: "Consecutive Duty Days", value: consecutiveLevel },
    { key: "workloadTrend", label: "Workload Trend", value: "Stable" },
    { key: "deploymentDuration", label: "Deployment Duration", value: `${deploymentDays} Days` },
    { key: "leaveRecoveryPattern", label: "Leave / Recovery Pattern", value: leaveLevel },
    { key: "wearableData", label: "Wearable Data", value: wearableValue },
  ];
}

function computeAtAGlance(duty) {
  const dutyLoadValue = duty.avgHoursPerDutyDay === null ? "Low"
    : duty.avgHoursPerDutyDay <= 8 ? "Low"
    : duty.avgHoursPerDutyDay <= 10 ? "Moderate"
    : duty.avgHoursPerDutyDay <= 12 ? "High"
    : "Very High";
  const dutyLoadNote = dutyLoadValue === "Low" || dutyLoadValue === "Moderate" ? "Within healthy range" : "Above healthy range";

  const restGapHrs = duty.avgHoursPerDutyDay === null ? 8 : Math.max(0, 24 - duty.avgHoursPerDutyDay);
  const restGapNote = restGapHrs >= 8 ? "Good" : restGapHrs >= 6 ? "Fair" : "Low";

  const nightDutiesNote = duty.nightDutyCount <= 2 ? "Manageable" : duty.nightDutyCount <= 4 ? "Elevated" : "High";

  return {
    dutyLoad: { value: dutyLoadValue, note: dutyLoadNote },
    avgRestGap: { value: `${restGapHrs.toFixed(1)} hrs`, note: restGapNote },
    nightDuties: { value: String(duty.nightDutyCount), note: nightDutiesNote },
  };
}

function computePersonalAIInsights(wellnessScore, riskScore, riskLabel, duty, nightDutyScore, consecutiveScore, checkin) {
  const factorCandidates = [
    {
      key: "nightDutyFrequency",
      label: "Night Duty Frequency",
      description: `${duty.nightDutyCount} long/night-leaning shift(s) in the last ${DUTY_WINDOW_DAYS} days.`,
      impactPercent: Math.round(100 - nightDutyScore),
    },
    {
      key: "consecutiveDutyDays",
      label: "Consecutive Duty Days",
      description: `Currently on a ${duty.consecutiveDutyDays}-day active duty streak.`,
      impactPercent: Math.round(100 - consecutiveScore),
    },
    {
      key: "restGap",
      label: "Rest Gap",
      description: `Average sleep pattern trending ${checkin.sleepScore >= 75 ? "healthy" : "short"}.`,
      impactPercent: Math.round(100 - checkin.sleepScore),
    },
  ]
    .map((f) => ({
      ...f,
      impact: f.impactPercent >= 65 ? "High Impact" : f.impactPercent >= 35 ? "Moderate Impact" : "Low Impact",
    }))
    .sort((a, b) => b.impactPercent - a.impactPercent);

  const top = factorCandidates[0];
  const outlookLabel = bucketWellness(wellnessScore);

  return {
    summaryTitle: "Your Wellness Outlook",
    summaryDescription: `Based on your recent duty pattern and check-ins, your outlook is currently ${outlookLabel.toLowerCase()}.`,
    outlookScore: wellnessScore,
    outlookLabel,
    contributingFactors: factorCandidates,
    prediction: {
      text: riskLabel === "Low"
        ? "Your stress risk is currently low - keep up the balance."
        : `${top.label} is the strongest driver of elevated stress risk right now.`,
      riskPercent: riskScore,
      riskLabel,
    },
    recommendation: {
      title: `Focus on ${top.label}`,
      description: `Reducing ${top.label.toLowerCase()} over the next few days should have the biggest impact on your wellness score.`,
    },
  };
}

async function computeTrendDirection(personnelId, asOf, wellnessScore) {
  const weekAgo = startOfUTCDay(addDays(asOf, -7));
  const previous = await StressPrediction.findOne({ personnel: personnelId, snapshotDate: weekAgo });
  if (!previous) return "Stable";

  const delta = wellnessScore - previous.wellnessScore;
  if (delta >= 3) return "Improving";
  if (delta <= -3) return "Declining";
  return "Stable";
}

/** Computes (but does not persist) a full snapshot for one personnel as of `asOf` (defaults to today, UTC midnight). */
async function computeSnapshot(personnelId, asOf = startOfUTCDay()) {
  const { duties, checkins, signupSurvey, personnel } = await gatherRawMetrics(personnelId, asOf);

  const duty = computeDutyMetrics(duties);
  const checkin = computeCheckinMetrics(checkins, signupSurvey);
  const { pillars, wellnessScore, nightDutyScore, consecutiveScore } = computePillars(duty, checkin);

  const riskScore = 100 - wellnessScore;
  const riskLabel = bucketLevel(riskScore, 65, 40);
  const wellnessLabel = bucketWellness(wellnessScore);
  const trendDirection = await computeTrendDirection(personnelId, asOf, wellnessScore);

  const descriptions = {
    Thriving: "You're maintaining an excellent balance of duty and recovery.",
    Balanced: "You're maintaining a good balance of duty and recovery.",
    "Needs Attention": "Your recent duty load and recovery pattern need some attention.",
    "At Risk": "Your recent duty load and recovery pattern show signs of strain.",
  };

  return {
    wellnessScore,
    riskScore,
    riskLabel,
    status: wellnessLabel,
    description: descriptions[wellnessLabel],
    trendDirection,
    pillars,
    influencingFactors: computeInfluencingFactors(duty, checkin, personnel, asOf),
    atAGlance: computeAtAGlance(duty),
    aiInsights: computePersonalAIInsights(wellnessScore, riskScore, riskLabel, duty, nightDutyScore, consecutiveScore, checkin),
  };
}

/** Returns today's snapshot for a personnel, computing + storing it if missing or stale (>1hr old). */
async function getOrComputeTodaySnapshot(personnelId) {
  const today = startOfUTCDay();
  const existing = await StressPrediction.findOne({ personnel: personnelId, snapshotDate: today });

  const isStale = !existing || Date.now() - existing.computedAt.getTime() > 60 * 60 * 1000;
  if (!isStale) return existing;

  const computed = await computeSnapshot(personnelId, today);
  return StressPrediction.findOneAndUpdate(
    { personnel: personnelId, snapshotDate: today },
    { $set: computed },
    { new: true, upsert: true },
  );
}

module.exports = {
  computeSnapshot,
  getOrComputeTodaySnapshot,
  bucketLevel,
  bucketWellness,
};
