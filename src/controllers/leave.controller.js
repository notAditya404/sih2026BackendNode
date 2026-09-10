const LeaveRequest = require("../models/LeaveRequest");
const { generateDailyId } = require("../services/idGenerator");
const { toDisplayDate, toDisplayDateTime, parseDisplayDate } = require("../services/dateFormat");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

function toResponseShape(request) {
  return {
    id: request.id,
    fromDate: toDisplayDate(request.fromDate),
    toDate: toDisplayDate(request.toDate),
    reason: request.reason,
    status: request.status,
    submittedAt: toDisplayDateTime(request.submittedAt),
  };
}

const listMyLeaveRequests = asyncHandler(async (req, res) => {
  const requests = await LeaveRequest.find({ personnel: req.personnel._id }).sort({ submittedAt: -1 });
  res.json(requests.map(toResponseShape));
});

const createLeaveRequest = asyncHandler(async (req, res) => {
  const { fromDate, toDate, reason } = req.body;
  const parsedFrom = parseDisplayDate(fromDate);
  const parsedTo = parseDisplayDate(toDate);

  if (!parsedFrom || !parsedTo || !reason) {
    throw new ApiError(400, "fromDate, toDate and reason are required");
  }
  if (parsedTo < parsedFrom) {
    throw new ApiError(400, "toDate cannot be before fromDate");
  }

  const id = await generateDailyId("LV", LeaveRequest);
  const request = await LeaveRequest.create({
    id,
    personnel: req.personnel._id,
    fromDate: parsedFrom,
    toDate: parsedTo,
    reason,
  });

  res.status(201).json(toResponseShape(request));
});

module.exports = { listMyLeaveRequests, createLeaveRequest, toResponseShape };
