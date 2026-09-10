const LeaveRequest = require("../models/LeaveRequest");
const { getLinkedPersonnelDocs } = require("./adminPersonnel.controller");
const { buildPersonnelListView } = require("../services/personnelView");
const { toDisplayDate, toDisplayDateTime } = require("../services/dateFormat");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

function toResponseShape(request, personnelView) {
  return {
    id: request.id,
    personnel: personnelView
      ? { id: personnelView.id, name: personnelView.name, rank: personnelView.rank, risk: personnelView.risk }
      : { id: String(request.personnel), name: "Unknown", rank: "", risk: "Low" },
    fromDate: toDisplayDate(request.fromDate),
    toDate: toDisplayDate(request.toDate),
    reason: request.reason,
    status: request.status,
    submittedAt: toDisplayDateTime(request.submittedAt),
  };
}

const listLeaveRequests = asyncHandler(async (req, res) => {
  const personnelDocs = await getLinkedPersonnelDocs(req.admin._id);
  const personnelIds = personnelDocs.map((p) => p._id);

  const [requests, views] = await Promise.all([
    LeaveRequest.find({ personnel: { $in: personnelIds } }).sort({ submittedAt: -1 }),
    buildPersonnelListView(personnelDocs),
  ]);

  const viewById = new Map(views.map((v) => [v.id, v]));
  res.json(requests.map((r) => toResponseShape(r, viewById.get(String(r.personnel)))));
});

const decideLeaveRequest = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["Approved", "Rejected"].includes(status)) {
    throw new ApiError(400, "status must be Approved or Rejected");
  }

  const personnelDocs = await getLinkedPersonnelDocs(req.admin._id);
  const personnelIds = personnelDocs.map((p) => String(p._id));

  const request = await LeaveRequest.findOne({ id: req.params.id });
  if (!request || !personnelIds.includes(String(request.personnel))) {
    throw new ApiError(404, "Leave request not found");
  }

  request.status = status;
  request.decidedBy = req.admin._id;
  request.decidedAt = new Date();
  await request.save();

  const [view] = await buildPersonnelListView(personnelDocs.filter((p) => String(p._id) === String(request.personnel)));
  res.json(toResponseShape(request, view));
});

module.exports = { listLeaveRequests, decideLeaveRequest };
