const SelfAssessment = require("../models/SelfAssessment");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { startOfUTCDay, addDays } = require("../services/dateFormat");

const getTodayStatus = asyncHandler(async (req, res) => {
  const today = startOfUTCDay();
  const tomorrow = addDays(today, 1);

  const submitted = await SelfAssessment.exists({
    personnel: req.personnel._id,
    source: "daily-checkin",
    createdAt: { $gte: today, $lt: tomorrow },
  });

  res.json({ submittedToday: !!submitted });
});

const submitCheckIn = asyncHandler(async (req, res) => {
  const { sleepHours, mealsPerDay } = req.body;
  if (typeof sleepHours !== "number" || typeof mealsPerDay !== "number") {
    throw new ApiError(400, "sleepHours and mealsPerDay (numbers) are required");
  }

  await SelfAssessment.create({
    personnel: req.personnel._id,
    source: "daily-checkin",
    sleepHours,
    mealsPerDay,
  });

  res.status(201).json({ success: true });
});

module.exports = { getTodayStatus, submitCheckIn };
