const mongoose = require("mongoose");

const doctorAllotmentSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    personnel: { type: mongoose.Schema.Types.ObjectId, ref: "Personnel", required: true },
    supportRequest: { type: mongoose.Schema.Types.ObjectId, ref: "SupportRequest" },
    allottedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  },
  { timestamps: { createdAt: "allottedAt", updatedAt: false } },
);

module.exports = mongoose.model("DoctorAllotment", doctorAllotmentSchema);
