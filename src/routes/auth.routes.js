const express = require("express");
const personnelAuth = require("../middleware/personnelAuth");
const { login, signup, changePassword } = require("../controllers/auth.controller");

const router = express.Router();

router.post("/login", login);
router.post("/signup", signup);
router.post("/change-password", personnelAuth, changePassword);

module.exports = router;
