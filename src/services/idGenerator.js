// Generates contract-style IDs like "WS-260910-001" / "LV-260910-004":
// prefix + 2-digit-year+month+day + a per-day sequence number, so IDs stay
// short, sortable, and collision-free without a separate counters table.
async function generateDailyId(prefix, Model) {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const datePart = `${yy}${mm}${dd}`;
  const idPrefix = `${prefix}-${datePart}-`;

  const countToday = await Model.countDocuments({ id: { $regex: `^${idPrefix}` } });
  const sequence = String(countToday + 1).padStart(3, "0");

  return `${idPrefix}${sequence}`;
}

const SUPPORT_TYPE_PREFIX = {
  welfare: "WS",
  medical: "MS",
  general: "GS",
};

module.exports = { generateDailyId, SUPPORT_TYPE_PREFIX };
