const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String, required: true },
    availability: { type: String, enum: ["Available", "In Session"], default: "Available" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Doctor", doctorSchema);
