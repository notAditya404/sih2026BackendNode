const express = require("express");
const adminAuth = require("../middleware/adminAuth");

const { wellnessSummary, aiInsights } = require("../controllers/adminInsights.controller");
const { listDuty, assignDuty } = require("../controllers/adminDuty.controller");
const { listLeaveRequests, decideLeaveRequest } = require("../controllers/adminLeave.controller");
const { listSupportRequests, allocateSupportRequest, listDoctors } = require("../controllers/adminSupport.controller");

// Mounted at /admin.
const router = express.Router();
router.use(adminAuth);

router.get("/wellness-summary", wellnessSummary);
router.get("/ai-insights", aiInsights);

router.get("/personnel/:id/duty", listDuty);
router.post("/personnel/:id/duty", assignDuty);

router.get("/leave-requests", listLeaveRequests);
router.patch("/leave-requests/:id", decideLeaveRequest);

router.get("/support-requests", listSupportRequests);
router.patch("/support-requests/:id", allocateSupportRequest);

router.get("/doctors", listDoctors);

module.exports = router;
