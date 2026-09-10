const { startOfUTCDay } = require("./dateFormat");

// A Pending leave request whose date range has already fully passed
// without an admin ever deciding it is stale - not actually pending
// anything anymore. Shown as "Expired" instead of sitting there looking
// like it still needs action. Derived at read time, never stored - same
// "derived, not stored" principle as Personnel's Active/On Leave status
// (see personnelView.js), so this can never drift out of sync with today.
function deriveLeaveStatus(request) {
  if (request.status === "Pending" && request.toDate < startOfUTCDay()) {
    return "Expired";
  }
  return request.status;
}

module.exports = { deriveLeaveStatus };
