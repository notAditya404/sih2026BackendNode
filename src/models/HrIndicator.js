const mongoose = require("mongoose");
const { SHIFT_TYPE_OPTIONS } = require("../services/mlOptions");

// Raw duty logs. Right now the only writer is the admin's duty-assignment
// endpoint (POST /admin/personnel/:id/duty), but the contract notes other
// shift data may feed this table eventually - hence `source`.
const hrIndicatorSchema = new mongoose.Schema(
  {
    personnel: { type: mongoose.Schema.Types.ObjectId, ref: "Personnel", required: true },
    date: { type: Date, required: true },
    hours: { type: Number, required: true, min: 0, max: 24 },
    // Admin picks this when assigning the duty - feeds the ML model's
    // shift_type (as the mode of the last 15 days, see mlRecordBuilder.js).
    shiftType: { type: String, enum: SHIFT_TYPE_OPTIONS, required: true },
    remark: { type: String, default: "" },
    source: { type: String, default: "admin-duty-assignment" },
  },
  { timestamps: { createdAt: "assignedAt", updatedAt: false } },
);

hrIndicatorSchema.index({ personnel: 1, date: -1 });

module.exports = mongoose.model("HrIndicator", hrIndicatorSchema);
