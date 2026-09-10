const Counter = require("../models/Counter");
const { istParts } = require("./dateFormat");

// Generates contract-style IDs like "WS-260910-001" / "LV-260910-004":
// prefix + 2-digit-year+month+day + a per-day sequence number, so IDs stay
// short, sortable, and collision-free without a separate counters table.
//
// "Today" for the date part is IST (Asia/Kolkata), not this server
// process's raw UTC clock - otherwise IDs generated between 12:00am and
// ~5:29am IST would be dated "yesterday" while the request's own
// submittedAt (correctly IST-formatted) shows today.
//
// The sequence number comes from an atomic Counter.findOneAndUpdate($inc),
// not a countDocuments()-then-create() read, so two requests submitted at
// the same moment on the same day can never collide on the same ID.
async function generateDailyId(prefix, Model) {
  const { year, month, day } = istParts(new Date());
  const yy = String(year).slice(-2);
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const datePart = `${yy}${mm}${dd}`;
  const idPrefix = `${prefix}-${datePart}-`;

  const counter = await Counter.findOneAndUpdate(
    { _id: idPrefix },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true },
  );
  const sequence = String(counter.sequence).padStart(3, "0");

  return `${idPrefix}${sequence}`;
}

const SUPPORT_TYPE_PREFIX = {
  welfare: "WS",
  medical: "MS",
  general: "GS",
};

module.exports = { generateDailyId, SUPPORT_TYPE_PREFIX };
