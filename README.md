# SIH 2026 Backend

Express + MongoDB backend implementing both API contracts for the MANOVA
project:

- **Mobile app (MANOVA)** — `personnel`-facing endpoints under `/auth` and `/personnel/me/*`.
- **Web app (CodeNova)** — `admin`-facing endpoints under `/` (login/signup), `/personnel`, and `/admin/*`.

Both apps talk to the same database — see each app's own `API_CONTRACT.md`
(mobile app repo root / web app repo root) for the exact request/response
shapes this implements.

## Setup

```bash
npm install
cp .env.example .env   # fill in MONGODB_URI and a real JWT_SECRET
npm run seed            # seeds the 3 doctors GET /admin/doctors expects
npm run dev              # starts on http://localhost:3000
```

## How the "AI" parts work

Neither contract's `stress_predictions` table is backed by a real trained
model here - `src/services/wellnessEngine.js` computes a deterministic
wellness/risk score from `hr_indicators` (duty logs) and `self_assessments`
(signup survey + daily check-ins), documented inline with the reasoning
behind each threshold. It's a heuristic stand-in, not a claim of real ML -
swap `computeSnapshot()` for a real model's output whenever one exists; the
rest of the API surface won't need to change.

A personnel's snapshot is computed the first time anyone asks for it each
day (and cached for an hour), so the API works correctly with zero manual
setup. `npm run recompute-snapshots` additionally computes today's snapshot
for every personnel up front - intended to run once a day via an external
scheduler so `GET /admin/wellness-summary`'s 7-day trend always has a real
history, not just today's point.

## The real ML model pipeline

Separate from the heuristic engine above, there's now a path to the actual
trained model (a regressor + classifier, driven the same way as its own
`predict_cli.py`):

1. `src/services/mlOptions.js` - the two new enums the model needs:
   `terrainType` (set once per admin at admin signup - every personnel
   linked to that admin shares their unit's terrain) and `shiftType` (set
   per duty entry when an admin assigns duty).
2. `src/services/mlRecordBuilder.js` - for one personnel, builds the exact
   record shape `predict_cli.py` sends to `predict_risk()`: 15-day average
   sleep hours and shift duration, 15-day mode shift type, the personnel's
   unit terrain, leave rejections in the last 90 days, age (from their
   signup `dob`), and their most recent meals-per-day answer.
3. `src/services/mlClient.js` - POSTs that record to `ML_MODEL_URL` and
   expects back `{ ml_predicted_risk_score, ml_predicted_stress_level,
   deterministic_risk_score, deterministic_stress_level }` - the same shape
   `predict_risk()` already returns, so wrapping it in a small HTTP service
   (Flask/FastAPI, whatever) needs no translation on either side.
4. `POST /admin/ml-predictions/recompute` - runs this for every personnel in
   the system and stores the result in `MlPrediction` (one row per
   personnel per day). Each personnel is tried independently and reported,
   so one failure doesn't stop the rest.

**Not connected yet** - `ML_MODEL_URL` is unset until the model's repo is
deployed somewhere reachable from this backend. Until then, the recompute
endpoint returns a clear per-personnel 503 instead of faking a score.

## Folder structure

```
src/
  config/      Mongo connection
  models/      Mongoose schemas (see each contract's "How this maps to a database")
  middleware/  JWT auth (separate for personnel vs admin tokens) + error handling
  services/    date formatting, ID generation, the wellness/risk engine, admin-side aggregation
  controllers/ one file per resource
  routes/      thin route -> controller wiring
  scripts/     seed.js, recomputeDailySnapshots.js
```

## Auth

Both `/auth/login` (mobile) and `/login` (web) return a JWT in `token`,
which the app attaches as `Authorization: Bearer <token>` on every
subsequent request. Per both contracts, **any** authenticated route
returns exactly `401` for a missing/invalid/expired token - never
`403` - so the frontends' auto-logout-on-401 behavior works correctly.
