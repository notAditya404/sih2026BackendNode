const LeaveRequest = require("../models/LeaveRequest");
const StressPrediction = require("../models/StressPrediction");
const { getOrComputeTodaySnapshot } = require("./wellnessEngine");
const { startOfUTCDay, toRelativeTime } = require("./dateFormat");

/** Personnel IDs (as strings) with an Approved leave request covering today. */
async function getPersonnelIdsOnLeaveToday(personnelIds) {
  const today = startOfUTCDay();
  const approved = await LeaveRequest.find({
    personnel: { $in: personnelIds },
    status: "Approved",
    fromDate: { $lte: today },
    toDate: { $gte: today },
  }).select("personnel");

  return new Set(approved.map((r) => String(r.personnel)));
}

function workloadFromSnapshot(snapshot) {
  const dutyBalance = snapshot.pillars.find((p) => p.key === "dutyBalance");
  return dutyBalance ? 100 - dutyBalance.score : 50;
}

/**
 * Builds the { id, name, rank, risk, riskScore, workload, status, updated }
 * shape GET /personnel returns, for a list of personnel documents. `status`
 * is derived from leave_requests, never a stored flag - see API_CONTRACT.md.
 */
async function buildPersonnelListView(personnelDocs) {
  const ids = personnelDocs.map((p) => p._id);
  const onLeaveIds = await getPersonnelIdsOnLeaveToday(ids);

  await Promise.all(personnelDocs.map((p) => getOrComputeTodaySnapshot(p._id)));
  const today = startOfUTCDay();
  const snapshots = await StressPrediction.find({ personnel: { $in: ids }, snapshotDate: today });
  const snapshotByPersonnel = new Map(snapshots.map((s) => [String(s.personnel), s]));

  return personnelDocs.map((p) => {
    const snapshot = snapshotByPersonnel.get(String(p._id));
    return {
      id: String(p._id),
      name: p.fullName,
      rank: p.rank,
      risk: snapshot?.riskLabel ?? "Low",
      riskScore: snapshot?.riskScore ?? 0,
      workload: snapshot ? workloadFromSnapshot(snapshot) : 0,
      status: onLeaveIds.has(String(p._id)) ? "On Leave" : "Active",
      updated: snapshot ? toRelativeTime(snapshot.computedAt) : "Never",
    };
  });
}

module.exports = { getPersonnelIdsOnLeaveToday, buildPersonnelListView };
