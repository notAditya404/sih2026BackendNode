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

// Both apps' users are in India, so timestamps that represent a real
// moment (submittedAt, lastUpdated, etc. - as opposed to a deliberately
// UTC-midnight-anchored calendar date like a duty/leave date) need to
// display in IST regardless of what timezone this server process itself
// runs in (a hosting platform's default is often UTC, which previously
// leaked straight into "12:00 am" style timestamps ~5.5 hours off from
// what an Indian user actually did). Intl's IANA timezone database
// handles the +5:30 offset correctly without any manual arithmetic.
const DISPLAY_TIMEZONE = "Asia/Kolkata";

function istParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month") - 1, day: get("day"), hour: get("hour"), minute: get("minute") };
}

function toDisplayTime(date) {
  const { hour, minute } = istParts(date);
  const ampm = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function toDisplayDateTime(date) {
  const { year, month, day, hour, minute } = istParts(date);
  const d = String(day).padStart(2, "0");
  const m = MONTHS[month];
  const ampm = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 || 12;
  return `${d} ${m} ${year}, ${displayHour}:${String(minute).padStart(2, "0")} ${ampm}`;
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

// UTC midnight for a calendar day. When called with NO argument, "today"
// is computed as of IST (Asia/Kolkata) - not this server process's raw UTC
// clock - because "today" has to match what an Indian user means by it.
// Between 12:00am and ~5:29am IST, the UTC calendar date is still
// "yesterday" - getting this wrong here was the root cause behind
// today's-snapshot, check-in-status, on-leave-today, and upcoming-duty ALL
// silently computing against the wrong day during that window, across
// every place in the backend that calls startOfUTCDay() with no argument.
//
// When an explicit `date` IS passed, it's assumed to already be a
// calendar-date value (a duty/leave date, itself UTC-midnight-anchored by
// parseDisplayDate) - this just normalizes it to UTC midnight, no timezone
// conversion, since there's no "real moment" to convert from.
function startOfUTCDay(date) {
  if (!date) {
    const { year, month, day } = istParts(new Date());
    return new Date(Date.UTC(year, month, day));
  }
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
  toDisplayTime,
  parseDisplayDate,
  startOfUTCDay,
  addDays,
  toRelativeTime,
};
