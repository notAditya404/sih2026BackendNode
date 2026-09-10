const ApiError = require("../utils/ApiError");

function notFound(req, res) {
  res.status(404).json({ msg: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ msg: err.message });
  }

  if (err.code === 11000) {
    return res.status(409).json({ msg: "That value is already in use." });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({ msg: err.message });
  }

  console.error(err);
  return res.status(500).json({ msg: "Something went wrong. Please try again." });
}

module.exports = { notFound, errorHandler };
