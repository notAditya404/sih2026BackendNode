const ApiError = require("../utils/ApiError");

// Talks to the real trained model (predict_cli.py's regressor/classifier)
// once it's deployed - not connected yet, per the plan: the model's own repo
// gets wrapped in a tiny HTTP service later (e.g. a Flask/FastAPI endpoint
// that calls predict_risk() and returns its result as JSON), and its URL
// goes in ML_MODEL_URL. Until then this throws a clear error instead of
// silently faking a score - the rest of the pipeline (gathering the record,
// storing the result) is already wired and doesn't need to change later.
//
// Expected request:  POST {record}  - exact same shape as predict_cli.py's
//   `record` dict: { sleep_hours, shift_duration_hours, shift_type,
//   terrain_type, leave_rejections, age, meals_per_day }
// Expected response: the same shape predict_risk() returns:
//   { ml_predicted_risk_score, ml_predicted_stress_level,
//     deterministic_risk_score, deterministic_stress_level }
const REQUEST_TIMEOUT_MS = 10000;

async function predictRisk(record) {
  const modelUrl = process.env.ML_MODEL_URL;
  if (!modelUrl) {
    throw new ApiError(503, "ML model not connected yet - set ML_MODEL_URL once the model service is deployed");
  }

  let response;
  try {
    response = await fetch(modelUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
      // mlPredictionRunner.js awaits this once per personnel in a
      // sequential loop - without a timeout, a Flask service that's hung
      // (not erroring, just stuck) rather than down would block that
      // single call forever and silently stall the rest of that day's
      // batch for every remaining personnel.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      throw new ApiError(504, "ML model service timed out");
    }
    throw error;
  }

  if (!response.ok) {
    throw new ApiError(502, `ML model service returned ${response.status}`);
  }

  return response.json();
}

module.exports = { predictRisk };
