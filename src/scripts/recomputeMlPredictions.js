// The ML equivalent of recomputeDailySnapshots.js - run this once a day via
// an external scheduler (cron, a hosting platform's scheduled job, Windows
// Task Scheduler, etc.) instead of hitting POST /admin/ml-predictions/recompute
// by hand every time. Needs ML_MODEL_URL set (see mlClient.js) - if it isn't,
// every personnel fails with a clear message and this still exits cleanly.
//
// `npm run recompute-ml-predictions`
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { recomputeAllMlPredictions } = require("../services/mlPredictionRunner");

async function run() {
  await connectDB();

  const results = await recomputeAllMlPredictions();
  console.log(`Processed ${results.total} personnel - ${results.succeeded} succeeded, ${results.failed} failed.`);
  if (results.errors.length) {
    console.log("Errors:");
    results.errors.forEach((e) => console.log(`  ${e.personnel}: ${e.message}`));
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
