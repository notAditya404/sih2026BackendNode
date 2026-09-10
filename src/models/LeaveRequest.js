const mongoose = require("mongoose");

const leaveRequestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    personnel: { type: mongoose.Schema.Types.ObjectId, ref: "Personnel", required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    decidedAt: { type: Date },
  },
  { timestamps: { createdAt: "submittedAt", updatedAt: false } },
);

module.exports = mongoose.model("LeaveRequest", leaveRequestSchema);
