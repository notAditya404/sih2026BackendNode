const mongoose = require("mongoose");

const supportRequestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    personnel: { type: mongoose.Schema.Types.ObjectId, ref: "Personnel", required: true },
    requestType: { type: String, enum: ["welfare", "medical", "general"], required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ["Submitted", "Acknowledged", "In Progress"],
      default: "Submitted",
    },
    allottedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
  },
  { timestamps: { createdAt: "submittedAt", updatedAt: false } },
);

module.exports = mongoose.model("SupportRequest", supportRequestSchema);
