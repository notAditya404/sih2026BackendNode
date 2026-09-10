const SupportRequest = require("../models/SupportRequest");
const { generateDailyId, SUPPORT_TYPE_PREFIX } = require("../services/idGenerator");
const { toDisplayDateTime } = require("../services/dateFormat");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const TITLE_BY_TYPE = {
  welfare: "Welfare Support Request",
  medical: "Medical Support Request",
  general: "General Assistance",
};

function toResponseShape(request) {
  return {
    id: request.id,
    title: request.title,
    requestType: request.requestType,
    submittedAt: toDisplayDateTime(request.submittedAt),
    status: request.status,
  };
}

const listMySupportRequests = asyncHandler(async (req, res) => {
  const requests = await SupportRequest.find({ personnel: req.personnel._id }).sort({ submittedAt: -1 });
  res.json(requests.map(toResponseShape));
});

const createSupportRequest = asyncHandler(async (req, res) => {
  const { requestType, description } = req.body;
  if (!["welfare", "medical", "general"].includes(requestType) || !description) {
    throw new ApiError(400, "requestType (welfare|medical|general) and description are required");
  }

  const id = await generateDailyId(SUPPORT_TYPE_PREFIX[requestType], SupportRequest);
  const request = await SupportRequest.create({
    id,
    personnel: req.personnel._id,
    requestType,
    title: TITLE_BY_TYPE[requestType],
    description,
  });

  res.status(201).json(toResponseShape(request));
});

module.exports = { listMySupportRequests, createSupportRequest, toResponseShape };
