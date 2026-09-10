const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const { signToken } = require("../utils/jwt");
const { TERRAIN_TYPE_OPTIONS } = require("../services/mlOptions");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

function adminSummary(admin) {
  return { fullName: admin.fullName, role: admin.role, terrainType: admin.terrainType };
}

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, "email and password are required");
  }

  const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
  if (!admin) {
    throw new ApiError(401, "Invalid credentials");
  }

  const matches = await bcrypt.compare(password, admin.passwordHash);
  if (!matches) {
    throw new ApiError(401, "Invalid credentials");
  }

  const token = signToken({ id: admin._id, role: "admin" });
  res.json({ token, admin: adminSummary(admin) });
});

const signup = asyncHandler(async (req, res) => {
  const { fullName, email, password, terrainType } = req.body;
  if (!fullName || !email || !password || !terrainType) {
    throw new ApiError(400, "fullName, email, password and terrainType are required");
  }
  if (!TERRAIN_TYPE_OPTIONS.includes(terrainType)) {
    throw new ApiError(400, `terrainType must be one of: ${TERRAIN_TYPE_OPTIONS.join(", ")}`);
  }

  const existing = await Admin.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await Admin.create({ fullName, email: email.toLowerCase().trim(), passwordHash, terrainType });

  const token = signToken({ id: admin._id, role: "admin" });
  res.status(201).json({ token, admin: adminSummary(admin) });
});

module.exports = { login, signup };
