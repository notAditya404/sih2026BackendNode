const { recomputeAllMlPredictions } = require("../services/mlPredictionRunner");
const asyncHandler = require("../utils/asyncHandler");

// See mlPredictionRunner.js - same logic the recompute-ml-predictions
// script uses, just triggered on demand from the admin app instead of a
// scheduler.
const recomputeAll = asyncHandler(async (req, res) => {
  const results = await recomputeAllMlPredictions();
  res.json(results);
});

module.exports = { recomputeAll };
