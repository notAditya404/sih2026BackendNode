const HrIndicator = require("../models/HrIndicator");
const AdminPersonnel = require("../models/AdminPersonnel");
const { toDisplayDate, toDisplayDateTime, parseDisplayDate } = require("../services/dateFormat");
const { SHIFT_TYPE_OPTIONS } = require("../services/mlOptions");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

async function assertLinked(adminId, personnelId) {
  const linked = await AdminPersonnel.exists({ admin: adminId, personnel: personnelId });
  if (!linked) {
    throw new ApiError(404, "Personnel not found in your linked list");
  }
}

function toResponseShape(entry) {
  return {
    id: String(entry._id),
    date: toDisplayDate(entry.date),
    hours: entry.hours,
    shiftType: entry.shiftType,
    remark: entry.remark,
    assignedAt: toDisplayDateTime(entry.assignedAt),
  };
}

const listDuty = asyncHandler(async (req, res) => {
  await assertLinked(req.admin._id, req.params.id);

  const entries = await HrIndicator.find({ personnel: req.params.id }).sort({ assignedAt: -1 });
  res.json(entries.map(toResponseShape));
});

const assignDuty = asyncHandler(async (req, res) => {
  await assertLinked(req.admin._id, req.params.id);

  const { date, hours, shiftType, remark } = req.body;
  const parsedDate = parseDisplayDate(date);
  if (!parsedDate || typeof hours !== "number" || hours < 1 || hours > 24) {
    throw new ApiError(400, "date, and hours (1-24) are required");
  }
  if (!SHIFT_TYPE_OPTIONS.includes(shiftType)) {
    throw new ApiError(400, `shiftType must be one of: ${SHIFT_TYPE_OPTIONS.join(", ")}`);
  }

  const entry = await HrIndicator.create({
    personnel: req.params.id,
    date: parsedDate,
    hours,
    shiftType,
    remark: remark || "",
  });

  res.status(201).json(toResponseShape(entry));
});

module.exports = { listDuty, assignDuty };
