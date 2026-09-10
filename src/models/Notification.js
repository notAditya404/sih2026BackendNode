const mongoose = require("mongoose");

// Listed in both contracts' DB notes with no endpoint attached yet - kept
// here as schema scaffolding for whenever in-app notification delivery
// gets built; nothing in this backend writes to it yet.
const notificationSchema = new mongoose.Schema(
  {
    personnel: { type: mongoose.Schema.Types.ObjectId, ref: "Personnel", required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

module.exports = mongoose.model("Notification", notificationSchema);
