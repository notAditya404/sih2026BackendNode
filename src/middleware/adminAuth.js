const { verifyToken } = require("../utils/jwt");
const Admin = require("../models/Admin");

module.exports = async function adminAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ msg: "Missing token" });
    }

    const payload = verifyToken(token);
    if (payload.role !== "admin") {
      return res.status(401).json({ msg: "Invalid token" });
    }

    const admin = await Admin.findById(payload.id);
    if (!admin) {
      return res.status(401).json({ msg: "Invalid token" });
    }

    req.admin = admin;
    next();
  } catch {
    return res.status(401).json({ msg: "Invalid or expired token" });
  }
};
