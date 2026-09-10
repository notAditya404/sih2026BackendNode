// The "daily job" API_CONTRACT.md describes: computes every personnel's
// risk score once a day and stores it, which is what GET /admin/wellness-summary's
// 7-day trend and history are built from. Intended to run once a day via
// an external scheduler (cron, a hosting platform's scheduled job, etc.) -
// `npm run recompute-snapshots`.
//
// The API itself doesn't depend on this running: personnel.controller.js
// and personnelView.js compute+store today's snapshot on demand the first
// time anyone asks for it. This script just makes sure "today" (and,
// implicitly, every future "yesterday") has one on file even if nobody
// happened to read it that day - which is what the 7-day trend needs.
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Personnel = require("../models/Personnel");
const { getOrComputeTodaySnapshot } = require("../services/wellnessEngine");

async function run() {
  await connectDB();

  const allPersonnel = await Personnel.find().select("_id");
  console.log(`Computing today's snapshot for ${allPersonnel.length} personnel...`);

  for (const p of allPersonnel) {
    await getOrComputeTodaySnapshot(p._id);
  }

  console.log("Done.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
