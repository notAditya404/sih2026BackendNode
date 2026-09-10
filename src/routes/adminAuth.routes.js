const express = require("express");
const { login, signup } = require("../controllers/adminAuth.controller");

// Mounted at / (root) - the web contract's login/signup have no prefix,
// unlike the mobile app's /auth/login.
const router = express.Router();

router.post("/login", login);
router.post("/signup", signup);

module.exports = router;
