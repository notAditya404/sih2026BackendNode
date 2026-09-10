const asyncHandler = require("../utils/asyncHandler");

const getNotificationSettings = asyncHandler(async (req, res) => {
  res.json({ dailyCheckInReminder: req.personnel.notificationSettings.dailyCheckInReminder });
});

const updateNotificationSettings = asyncHandler(async (req, res) => {
  req.personnel.notificationSettings.dailyCheckInReminder = !!req.body.dailyCheckInReminder;
  await req.personnel.save();
  res.json({ dailyCheckInReminder: req.personnel.notificationSettings.dailyCheckInReminder });
});

module.exports = { getNotificationSettings, updateNotificationSettings };
