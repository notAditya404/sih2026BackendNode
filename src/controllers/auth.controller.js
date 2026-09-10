const bcrypt = require("bcryptjs");
const Personnel = require("../models/Personnel");
const SelfAssessment = require("../models/SelfAssessment");
const { signToken } = require("../utils/jwt");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

function personnelSummary(personnel) {
  return { fullName: personnel.fullName, rank: personnel.rank };
}

// The app's login screen only ever collects one identifier, labeled
// "User ID" - since signup never collects a separate username, that
// identifier is the email address.
const login = asyncHandler(async (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) {
    throw new ApiError(400, "userId and password are required");
  }

  const personnel = await Personnel.findOne({ email: userId.toLowerCase().trim() });
  if (!personnel) {
    throw new ApiError(401, "Invalid credentials");
  }

  const matches = await bcrypt.compare(password, personnel.passwordHash);
  if (!matches) {
    throw new ApiError(401, "Invalid credentials");
  }

  const token = signToken({ id: personnel._id, role: "personnel" });
  res.json({ token, personnel: personnelSummary(personnel) });
});

const signup = asyncHandler(async (req, res) => {
  const {
    fullName, email, rank, dob, gender, bloodGroup,
    sleepHours, dietQuality, workPressure, lastLeave, password,
  } = req.body;

  if (!fullName || !email || !rank || !password) {
    throw new ApiError(400, "fullName, email, rank and password are required");
  }

  const existing = await Personnel.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const personnel = await Personnel.create({
    fullName, email: email.toLowerCase().trim(), rank, dob, gender, bloodGroup, passwordHash,
  });

  // The onboarding wellness survey becomes this personnel's first
  // self_assessments row, per API_CONTRACT.md.
  await SelfAssessment.create({
    personnel: personnel._id,
    source: "signup",
    sleepHours, dietQuality, workPressure, lastLeave,
  });

  const token = signToken({ id: personnel._id, role: "personnel" });
  res.status(201).json({ token, personnel: personnelSummary(personnel) });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "currentPassword and newPassword are required");
  }

  const matches = await bcrypt.compare(currentPassword, req.personnel.passwordHash);
  if (!matches) {
    throw new ApiError(400, "Current password is incorrect");
  }

  req.personnel.passwordHash = await bcrypt.hash(newPassword, 10);
  await req.personnel.save();

  res.json({ success: true });
});

module.exports = { login, signup, changePassword };
