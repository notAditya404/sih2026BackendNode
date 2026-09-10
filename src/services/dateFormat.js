// Both frontends format dates via toLocaleDateString("en-IN", { month: "short" }),
// which is where the "Sept" (not "Sep") quirk for September comes from - matching
// it exactly here so dates round-trip identically regardless of which app sent them.
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sept", "Oct", "Nov", "Dec",
];

function toDisplayDate(date) {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = MONTHS[date.getUTCMonth()];
  const y = date.getUTCFullYear();
  return `${d} ${m} ${y}`;
}

function toDisplayDateTime(date) {
  let hours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  return `${toDisplayDate(date)}, ${hours}:${minutes} ${ampm}`;
}

// First-3-letters lookup covers every real-world spelling we expect to see
// ("Sep"/"Sept"/"September", "Jun"/"June", ...) without a variant table.
const MONTH_BY_PREFIX = MONTHS.reduce((map, name, index) => {
  map[name.slice(0, 3).toLowerCase()] = index;
  return map;
}, {});

// Accepts "09 Sept 2026" / "09 Sep 2026" / "9 September 2026" style strings
// (both frontends send dates already formatted this way, e.g. the web app's
// <input type="date"> gets converted to this format before the API call).
function parseDisplayDate(input) {
  if (!input) return null;

  const match = String(input).trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) {
    // Fall back to whatever Date() can make of it (covers ISO strings too).
    const fallback = new Date(input);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const [, day, monthName, year] = match;
  const monthIndex = MONTH_BY_PREFIX[monthName.slice(0, 3).toLowerCase()];
  if (monthIndex === undefined) return null;

  return new Date(Date.UTC(Number(year), monthIndex, Number(day)));
}

function startOfUTCDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function toRelativeTime(date) {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;

  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
}

module.exports = {
  toDisplayDate,
  toDisplayDateTime,
  parseDisplayDate,
  startOfUTCDay,
  addDays,
  toRelativeTime,
};
