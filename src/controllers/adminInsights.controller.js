const { getLinkedPersonnelDocs } = require("./adminPersonnel.controller");
const { getWellnessSummary, getAdminAIInsights } = require("../services/adminInsights");
const asyncHandler = require("../utils/asyncHandler");

const wellnessSummary = asyncHandler(async (req, res) => {
  const personnelDocs = await getLinkedPersonnelDocs(req.admin._id);
  res.json(await getWellnessSummary(personnelDocs.map((p) => p._id)));
});

const aiInsights = asyncHandler(async (req, res) => {
  const personnelDocs = await getLinkedPersonnelDocs(req.admin._id);
  res.json(await getAdminAIInsights(personnelDocs.map((p) => p._id)));
});

module.exports = { wellnessSummary, aiInsights };
