// One-time historical backfill: computes + stores a StressPrediction
// snapshot for each of the past N days per personnel, using whatever
// duty/check-in/leave data already exists in each day's own lookback
// window (computeSnapshot() already supports an arbitrary `asOf`, it's
// just never been called for anything but "today" until now).
//
// Without this, the wellness trend charts (mobile Wellness's 30-day chart,
// the admin dashboard's 7-day trend) have no real history to plot - only
// "today" has ever been computed - so both fall back to a flat line
// (today's score carried backward across every earlier point). This is
// exactly what happens right after importing/seeding historical raw data
// (e.g. seed-demo-data) - an app that's been running normally for weeks
// accumulates real daily snapshots on its own via recompute-snapshots and
// never needs this.
//
// `npm run backfill-snapshots`            -> last 35 days
// `node src/scripts/backfillSnapshots.js 60` -> last 60 days
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Personnel = require("../models/Personnel");
const StressPrediction = require("../models/StressPrediction");
const { computeSnapshot } = require("../services/wellnessEngine");
const { startOfUTCDay, addDays } = require("../services/dateFormat");

async function run() {
  await connectDB();

  const days = Number(process.argv[2]) || 35;
  const allPersonnel = await Personnel.find().select("_id");
  const today = startOfUTCDay();

  console.log(`Backfilling ${days} days of snapshots for ${allPersonnel.length} personnel...`);

  for (const p of allPersonnel) {
    // Oldest to newest - computeSnapshot()'s trend direction compares
    // against "a week ago"'s stored snapshot, so earlier days need to
    // already be written before later ones are computed.
    for (let daysBack = days; daysBack >= 0; daysBack -= 1) {
      const asOf = addDays(today, -daysBack);
      const computed = await computeSnapshot(p._id, asOf);
      await StressPrediction.findOneAndUpdate(
        { personnel: p._id, snapshotDate: asOf },
        { $set: computed },
        { upsert: true },
      );
    }
    console.log(`  done: ${p._id}`);
  }

  console.log("Done.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
