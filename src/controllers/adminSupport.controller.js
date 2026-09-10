const SupportRequest = require("../models/SupportRequest");
const Doctor = require("../models/Doctor");
const DoctorAllotment = require("../models/DoctorAllotment");
const { getLinkedPersonnelDocs } = require("./adminPersonnel.controller");
const { buildPersonnelListView } = require("../services/personnelView");
const { toDisplayDateTime } = require("../services/dateFormat");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

function toResponseShape(request, personnelView) {
  return {
    id: request.id,
    requestType: request.requestType,
    title: request.title,
    description: request.description,
    status: request.status,
    submittedAt: toDisplayDateTime(request.submittedAt),
    personnel: personnelView
      ? { name: personnelView.name, rank: personnelView.rank, risk: personnelView.risk }
      : { name: "Unknown", rank: "", risk: "Low" },
  };
}

const listSupportRequests = asyncHandler(async (req, res) => {
  const personnelDocs = await getLinkedPersonnelDocs(req.admin._id);
  const personnelIds = personnelDocs.map((p) => p._id);

  const [requests, views] = await Promise.all([
    SupportRequest.find({ personnel: { $in: personnelIds } }).sort({ submittedAt: -1 }),
    buildPersonnelListView(personnelDocs),
  ]);

  const viewById = new Map(views.map((v) => [v.id, v]));
  res.json(requests.map((r) => toResponseShape(r, viewById.get(String(r.personnel)))));
});

const allocateSupportRequest = asyncHandler(async (req, res) => {
  const { doctor: doctorName } = req.body;
  if (!doctorName) {
    throw new ApiError(400, "doctor is required");
  }

  const personnelDocs = await getLinkedPersonnelDocs(req.admin._id);
  const personnelIds = personnelDocs.map((p) => String(p._id));

  const request = await SupportRequest.findOne({ id: req.params.id });
  if (!request || !personnelIds.includes(String(request.personnel))) {
    throw new ApiError(404, "Support request not found");
  }

  const doctor = await Doctor.findOne({ name: doctorName });
  if (!doctor) {
    throw new ApiError(404, "Doctor not found");
  }

  request.status = "In Progress";
  request.allottedDoctor = doctor._id;
  await request.save();

  await DoctorAllotment.create({
    doctor: doctor._id,
    personnel: request.personnel,
    supportRequest: request._id,
    allottedBy: req.admin._id,
  });

  const [view] = await buildPersonnelListView(personnelDocs.filter((p) => String(p._id) === String(request.personnel)));
  res.json(toResponseShape(request, view));
});

const listDoctors = asyncHandler(async (req, res) => {
  const doctors = await Doctor.find().sort({ name: 1 });
  res.json(doctors.map((d) => ({ id: String(d._id), name: d.name, role: d.role, availability: d.availability })));
});

module.exports = { listSupportRequests, allocateSupportRequest, listDoctors };
