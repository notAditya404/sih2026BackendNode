const mongoose = require("mongoose");

// Raw duty logs. Right now the only writer is the admin's duty-assignment
// endpoint (POST /admin/personnel/:id/duty), but the contract notes other
// shift data may feed this table eventually - hence `source`.
const hrIndicatorSchema = new mongoose.Schema(
  {
    personnel: { type: mongoose.Schema.Types.ObjectId, ref: "Personnel", required: true },
    date: { type: Date, required: true },
    hours: { type: Number, required: true, min: 0, max: 24 },
    remark: { type: String, default: "" },
    source: { type: String, default: "admin-duty-assignment" },
  },
  { timestamps: { createdAt: "assignedAt", updatedAt: false } },
);

hrIndicatorSchema.index({ personnel: 1, date: -1 });

module.exports = mongoose.model("HrIndicator", hrIndicatorSchema);
