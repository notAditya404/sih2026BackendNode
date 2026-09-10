const mongoose = require("mongoose");

// Backs generateDailyId()'s per-day sequence numbers with an atomic $inc
// instead of count-then-create, so two concurrent submissions on the same
// day can never be handed the same sequence number.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0 },
});

module.exports = mongoose.model("Counter", counterSchema);
