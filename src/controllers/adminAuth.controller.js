const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const { signToken } = require("../utils/jwt");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

function adminSummary(admin) {
  return { fullName: admin.fullName, role: admin.role };
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
  const { fullName, email, password } = req.body;
  if (!fullName || !email || !password) {
    throw new ApiError(400, "fullName, email and password are required");
  }

  const existing = await Admin.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await Admin.create({ fullName, email: email.toLowerCase().trim(), passwordHash });

  const token = signToken({ id: admin._id, role: "admin" });
  res.status(201).json({ token, admin: adminSummary(admin) });
});

module.exports = { login, signup };
