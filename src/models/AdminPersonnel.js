const mongoose = require("mongoose");

// Links an admin to a personnel by email (see API_CONTRACT.md "POST /personnel").
// A personnel can be linked to more than one admin; each admin only ever
// sees the personnel they've linked, never "everyone in the system".
const adminPersonnelSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    personnel: { type: mongoose.Schema.Types.ObjectId, ref: "Personnel", required: true },
  },
  { timestamps: true },
);

adminPersonnelSchema.index({ admin: 1, personnel: 1 }, { unique: true });

module.exports = mongoose.model("AdminPersonnel", adminPersonnelSchema);
