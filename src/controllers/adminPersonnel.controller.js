const Personnel = require("../models/Personnel");
const AdminPersonnel = require("../models/AdminPersonnel");
const { buildPersonnelListView } = require("../services/personnelView");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

async function getLinkedPersonnelDocs(adminId) {
  const links = await AdminPersonnel.find({ admin: adminId }).populate("personnel");
  return links.map((l) => l.personnel).filter(Boolean);
}

const listPersonnel = asyncHandler(async (req, res) => {
  const personnelDocs = await getLinkedPersonnelDocs(req.admin._id);
  res.json(await buildPersonnelListView(personnelDocs));
});

const addPersonnel = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new ApiError(400, "email is required");
  }

  const personnel = await Personnel.findOne({ email: email.toLowerCase().trim() });
  if (!personnel) {
    return res.status(404).json({ msg: "Personnel not found" });
  }

  try {
    await AdminPersonnel.create({ admin: req.admin._id, personnel: personnel._id });
  } catch (err) {
    if (err.code !== 11000) throw err; // already linked - treat as success below
  }

  const [view] = await buildPersonnelListView([personnel]);
  res.status(200).json(view);
});

module.exports = { listPersonnel, addPersonnel, getLinkedPersonnelDocs };
