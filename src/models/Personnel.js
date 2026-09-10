const mongoose = require("mongoose");

const personnelSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    rank: { type: String, required: true },
    dob: { type: String },
    gender: { type: String },
    bloodGroup: { type: String },
    verified: { type: Boolean, default: true },
    notificationSettings: {
      dailyCheckInReminder: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Personnel", personnelSchema);
