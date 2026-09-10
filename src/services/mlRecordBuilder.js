const HrIndicator = require("../models/HrIndicator");
const SelfAssessment = require("../models/SelfAssessment");
const LeaveRequest = require("../models/LeaveRequest");
const AdminPersonnel = require("../models/AdminPersonnel");
const Personnel = require("../models/Personnel");
const { startOfUTCDay, addDays } = require("./dateFormat");
const ApiError = require("../utils/ApiError");

const RECORD_WINDOW_DAYS = 15;
const LEAVE_REJECTION_WINDOW_DAYS = 90;
const DEFAULT_AGE = 30;

function average(numbers, fallback) {
  if (!numbers.length) return fallback;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

/** Most frequent value in the array; ties keep whichever is found first. */
function mode(values, fallback) {
  if (!values.length) return fallback;
  const counts = new Map();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));

  let best = values[0];
  let bestCount = 0;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  });
  return best;
}

// dob is a free-text "DD/MM/YYYY" string collected at signup (no date picker
// on the mobile app) - parsed defensively, falls back to a default age
// rather than failing the whole prediction over one bad string.
function ageFromDob(dob) {
  const match = typeof dob === "string" ? dob.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) : null;
  if (!match) return DEFAULT_AGE;

  const [, day, month, year] = match;
  const birthDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(birthDate.getTime())) return DEFAULT_AGE;

  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const hadBirthdayThisYear =
    today.getUTCMonth() > birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() >= birthDate.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;

  return age > 0 ? age : DEFAULT_AGE;
}

// A personnel can be linked to more than one admin (multi-unit edge case per
// AdminPersonnel's own docs) - the first linked admin's terrain is used.
async function terrainTypeFor(personnelId) {
  const link = await AdminPersonnel.findOne({ personnel: personnelId }).populate("admin", "terrainType");
  return link?.admin?.terrainType ?? null;
}

/**
 * Builds the exact record shape predict_cli.py sends to predict_risk() for
 * one personnel: last-15-day averages/mode for duty data, most recent diet
 * answer, unit terrain from their linked admin, leave rejections in the
 * last 90 days, and age from their signup dob.
 */
async function buildMlRecord(personnelId) {
  const today = startOfUTCDay();
  const windowStart = addDays(today, -RECORD_WINDOW_DAYS);
  const leaveWindowStart = addDays(today, -LEAVE_REJECTION_WINDOW_DAYS);

  const [duties, checkins, signupSurvey, personnel, terrainType, leaveRejections] = await Promise.all([
    HrIndicator.find({ personnel: personnelId, date: { $gte: windowStart, $lte: today } }),
    SelfAssessment.find({
      personnel: personnelId,
      source: "daily-checkin",
      createdAt: { $gte: windowStart },
    }).sort({ createdAt: -1 }),
    SelfAssessment.findOne({ personnel: personnelId, source: "signup" }),
    Personnel.findById(personnelId),
    terrainTypeFor(personnelId),
    LeaveRequest.countDocuments({
      personnel: personnelId,
      status: "Rejected",
      submittedAt: { $gte: leaveWindowStart },
    }),
  ]);

  if (!personnel) {
    throw new ApiError(404, "Personnel not found");
  }

  const sleepSamples = checkins.map((c) => c.sleepHours).filter((v) => typeof v === "number");
  const fallbackSleep = typeof signupSurvey?.sleepHours === "number" ? signupSurvey.sleepHours : 6;

  // meals_per_day is a single most-recent snapshot (like predict_cli.py's
  // "meals eaten yesterday"), not a 15-day average.
  const latestMealsCheckin = checkins.find((c) => typeof c.mealsPerDay === "number");
  const mealsPerDay = typeof latestMealsCheckin?.mealsPerDay === "number"
    ? latestMealsCheckin.mealsPerDay
    : typeof signupSurvey?.mealsPerDay === "number" ? signupSurvey.mealsPerDay : 3;

  const shiftDurations = duties.map((d) => d.hours);
  const shiftTypes = duties.map((d) => d.shiftType).filter(Boolean);

  return {
    sleep_hours: Number(average(sleepSamples, fallbackSleep).toFixed(2)),
    shift_duration_hours: Number(average(shiftDurations, 10).toFixed(2)),
    shift_type: mode(shiftTypes, "day"),
    terrain_type: terrainType ?? "plain",
    leave_rejections: leaveRejections,
    age: ageFromDob(personnel.dob),
    meals_per_day: mealsPerDay,
  };
}

module.exports = { buildMlRecord };
