const { verifyToken } = require("../utils/jwt");
const Personnel = require("../models/Personnel");

// Both contracts are explicit: any authenticated request that comes back
// with a 401 makes the app auto-logout, so every failure path here must
// be a 401 - never 403/500 - for a missing, malformed, expired, or
// wrong-role token.
module.exports = async function personnelAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ msg: "Missing token" });
    }

    const payload = verifyToken(token);
    if (payload.role !== "personnel") {
      return res.status(401).json({ msg: "Invalid token" });
    }

    const personnel = await Personnel.findById(payload.id);
    if (!personnel) {
      return res.status(401).json({ msg: "Invalid token" });
    }

    req.personnel = personnel;
    next();
  } catch {
    return res.status(401).json({ msg: "Invalid or expired token" });
  }
};
