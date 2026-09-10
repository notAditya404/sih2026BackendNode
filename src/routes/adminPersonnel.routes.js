const express = require("express");
const adminAuth = require("../middleware/adminAuth");
const { listPersonnel, addPersonnel } = require("../controllers/adminPersonnel.controller");

// Mounted at /personnel (no /me - that prefix belongs to the mobile app's
// own personnel-self routes).
const router = express.Router();
router.use(adminAuth);

router.get("/", listPersonnel);
router.post("/", addPersonnel);

module.exports = router;
