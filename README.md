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
