const express = require("express");
const personnelAuth = require("../middleware/personnelAuth");

const { getMe, getHomeDashboard, getWellness, getAIInsights } = require("../controllers/personnel.controller");
const { getTodayStatus, submitCheckIn } = require("../controllers/selfAssessment.controller");
const { listMySupportRequests, createSupportRequest } = require("../controllers/support.controller");
const { listMyLeaveRequests, createLeaveRequest } = require("../controllers/leave.controller");
const { getNotificationSettings, updateNotificationSettings } = require("../controllers/settings.controller");

// Mounted at /personnel/me - everything here is scoped to the logged-in
// personnel from their JWT, never a path param.
const router = express.Router();
router.use(personnelAuth);

router.get("/", getMe);
router.get("/home-dashboard", getHomeDashboard);
router.get("/wellness", getWellness);
router.get("/ai-insights", getAIInsights);

router.get("/self-assessments/today", getTodayStatus);
router.post("/self-assessments", submitCheckIn);

router.get("/support-requests", listMySupportRequests);
router.post("/support-requests", createSupportRequest);

router.get("/leave-requests", listMyLeaveRequests);
router.post("/leave-requests", createLeaveRequest);

router.get("/notification-settings", getNotificationSettings);
router.put("/notification-settings", updateNotificationSettings);

module.exports = router;
