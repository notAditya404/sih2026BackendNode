// One-shot demo dataset: 2 admins + 10 personnel (5 linked to each), with
// ~60 days of realistic duty logs, daily check-ins, and leave requests -
// enough for both the heuristic engine and (once ML_MODEL_URL is set) the
// real ML model to have real data to work with. Every persona is deliberately
// different (well-rested day-shift personnel through sleep-deprived,
// leave-denied night-shift personnel) so `npm run recompute-ml-predictions`
// actually produces a spread of risk scores, not 10 identical ones.
//
// Safe to re-run: deletes any previous run's demo data first (matched by
// the @manova.local email domain, used only by this script) and rebuilds
// it fresh with new randomized day-to-day values.
//
// All accounts use the password: Sih@2026
//
// `npm run seed-demo-data`
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");

const Admin = require("../models/Admin");
const Personnel = require("../models/Personnel");
const AdminPersonnel = require("../models/AdminPersonnel");
const HrIndicator = require("../models/HrIndicator");
const SelfAssessment = require("../models/SelfAssessment");
const LeaveRequest = require("../models/LeaveRequest");
const StressPrediction = require("../models/StressPrediction");
const MlPrediction = require("../models/MlPrediction");

const PASSWORD = "Sih@2026";
const DAYS_BACK = 60;
const DUTY_REMARKS = [
  "Perimeter patrol - Gate 3",
  "Convoy escort duty",
  "Camp administration duty",
  "Border outpost watch",
  "Checkpoint duty",
  "Night vigil - Sector 4",
  "Supply line security",
  "Quick reaction team standby",
  "Route clearance patrol",
  "Post sentry duty",
];
const LEAVE_REASONS = ["Family function", "Medical appointment", "Personal emergency", "Festival leave", "Rest & recuperation"];
const GENDER_OPTIONS = ["Male", "Female"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomFloat(min, max, decimals = 1) {
  return Number((Math.random() * (max - min) + min).toFixed(decimals));
}
function pick(arr) {
  return arr[randomInt(0, arr.length - 1)];
}
function daysAgo(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}
function dobForAge(age) {
  const year = new Date().getUTCFullYear() - age;
  const month = String(randomInt(1, 12)).padStart(2, "0");
  const day = String(randomInt(1, 28)).padStart(2, "0");
  return `${day}/${month}/${year}`;
}
function leaveId(date, sequence) {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `LV-${yy}${mm}${dd}-${String(sequence).padStart(3, "0")}`;
}

const ADMINS = [
  { fullName: "Capt. Vikram Rathore", email: "admin1.demo@manova.local", terrainType: "border" },
  { fullName: "Maj. Ananya Desai", email: "admin2.demo@manova.local", terrainType: "high altitude/snow" },
];

// Each persona drives every generated data point for that personnel -
// duty frequency/hours/shift mix, check-in adherence, sleep/meals range,
// and leave rejection count - so the resulting risk scores actually vary.
const PERSONAS = [
  { adminIdx: 0, fullName: "Constable Arjun Kumar", rank: "Constable", age: 24, sleep: [7, 8.5], meals: [3, 3], dutyProb: 0.5, nightChance: 0.1, hours: [7, 9], rejections: 0, checkinRate: 0.85, workPressure: "Low", lastLeave: "This month" },
  { adminIdx: 0, fullName: "Naik Rohan Sharma", rank: "Naik", age: 27, sleep: [6, 7.5], meals: [2, 3], dutyProb: 0.55, nightChance: 0.25, hours: [8, 10], rejections: 1, checkinRate: 0.8, workPressure: "Moderate", lastLeave: "1-3 months ago" },
  { adminIdx: 0, fullName: "Havildar Suresh Yadav", rank: "Havildar", age: 33, sleep: [5, 6.5], meals: [2, 3], dutyProb: 0.6, nightChance: 0.4, hours: [9, 11], rejections: 2, checkinRate: 0.75, workPressure: "Moderate", lastLeave: "3-6 months ago" },
  { adminIdx: 0, fullName: "Lance Naik Deepak Singh", rank: "Lance Naik", age: 29, sleep: [3.5, 5], meals: [1, 2], dutyProb: 0.7, nightChance: 0.6, hours: [11, 14], rejections: 4, checkinRate: 0.7, workPressure: "High", lastLeave: "6+ months ago" },
  { adminIdx: 0, fullName: "Head Constable Manoj Verma", rank: "Head Constable", age: 31, sleep: [5, 6.5], meals: [2, 3], dutyProb: 0.5, nightChance: 0.3, hours: [8, 10], rejections: 2, checkinRate: 0.65, workPressure: "Moderate", lastLeave: "3-6 months ago" },
  { adminIdx: 1, fullName: "Constable Karan Mehta", rank: "Constable", age: 23, sleep: [7, 8.5], meals: [3, 3], dutyProb: 0.45, nightChance: 0.15, hours: [7, 9], rejections: 0, checkinRate: 0.9, workPressure: "Low", lastLeave: "This month" },
  { adminIdx: 1, fullName: "Naik Vijay Patil", rank: "Naik", age: 28, sleep: [6, 7], meals: [2, 3], dutyProb: 0.55, nightChance: 0.3, hours: [8, 10], rejections: 1, checkinRate: 0.8, workPressure: "Moderate", lastLeave: "1-3 months ago" },
  { adminIdx: 1, fullName: "Havildar Ramesh Chandra", rank: "Havildar", age: 36, sleep: [4.5, 6], meals: [1, 2], dutyProb: 0.65, nightChance: 0.5, hours: [10, 12], rejections: 3, checkinRate: 0.7, workPressure: "High", lastLeave: "3-6 months ago" },
  { adminIdx: 1, fullName: "Lance Naik Ajay Nair", rank: "Lance Naik", age: 40, sleep: [3, 4.5], meals: [0, 1], dutyProb: 0.75, nightChance: 0.7, hours: [12, 15], rejections: 6, checkinRate: 0.6, workPressure: "Very High", lastLeave: "6+ months ago" },
  { adminIdx: 1, fullName: "Sub Inspector Farhan Ali", rank: "Sub Inspector", age: 26, sleep: [6.5, 8], meals: [2, 3], dutyProb: 0.5, nightChance: 0.2, hours: [8, 9], rejections: 1, checkinRate: 0.85, workPressure: "Low", lastLeave: "This month" },
];

async function run() {
  await connectDB();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // --- Clean up any previous run's demo data first, so this is safe to re-run ---
  const oldAdmins = await Admin.find({ email: { $regex: /@manova\.local$/ } }).select("_id");
  const oldPersonnel = await Personnel.find({ email: { $regex: /@manova\.local$/ } }).select("_id");
  const oldAdminIds = oldAdmins.map((a) => a._id);
  const oldPersonnelIds = oldPersonnel.map((p) => p._id);
  if (oldPersonnelIds.length || oldAdminIds.length) {
    console.log("Removing previous demo data...");
    await Promise.all([
      HrIndicator.deleteMany({ personnel: { $in: oldPersonnelIds } }),
      SelfAssessment.deleteMany({ personnel: { $in: oldPersonnelIds } }),
      LeaveRequest.deleteMany({ personnel: { $in: oldPersonnelIds } }),
      StressPrediction.deleteMany({ personnel: { $in: oldPersonnelIds } }),
      MlPrediction.deleteMany({ personnel: { $in: oldPersonnelIds } }),
      AdminPersonnel.deleteMany({ $or: [{ admin: { $in: oldAdminIds } }, { personnel: { $in: oldPersonnelIds } }] }),
      Personnel.deleteMany({ _id: { $in: oldPersonnelIds } }),
      Admin.deleteMany({ _id: { $in: oldAdminIds } }),
    ]);
  }

  // --- Admins ---
  const admins = await Admin.create(
    ADMINS.map((a) => ({ ...a, passwordHash, role: "Welfare Officer" })),
  );
  console.log(`Created ${admins.length} admins.`);

  // --- Personnel + signup self-assessment + admin links ---
  const personnelDocs = [];
  for (const persona of PERSONAS) {
    const email = `${persona.fullName.split(" ").pop().toLowerCase()}.${randomInt(100, 999)}.demo@manova.local`;
    const personnel = await Personnel.create({
      fullName: persona.fullName,
      email,
      passwordHash,
      rank: persona.rank,
      dob: dobForAge(persona.age),
      gender: pick(GENDER_OPTIONS),
      bloodGroup: pick(BLOOD_GROUPS),
    });
    await SelfAssessment.create({
      personnel: personnel._id,
      source: "signup",
      sleepHours: randomFloat(...persona.sleep),
      mealsPerDay: randomInt(...persona.meals),
      workPressure: persona.workPressure,
      lastLeave: persona.lastLeave,
    });
    await AdminPersonnel.create({ admin: admins[persona.adminIdx]._id, personnel: personnel._id });
    personnelDocs.push({ personnel, persona });
  }
  console.log(`Created ${personnelDocs.length} personnel, linked to their admin.`);

  // --- 60 days of duty logs + daily check-ins, persona-driven ---
  const dutyDocs = [];
  const checkinDocs = [];
  for (const { personnel, persona } of personnelDocs) {
    for (let daysBack = DAYS_BACK; daysBack >= 1; daysBack -= 1) {
      const date = daysAgo(daysBack);

      if (Math.random() < persona.dutyProb) {
        dutyDocs.push({
          personnel: personnel._id,
          date,
          hours: randomFloat(...persona.hours),
          shiftType: Math.random() < persona.nightChance ? "night" : "day",
          remark: pick(DUTY_REMARKS),
          source: "admin-duty-assignment",
          assignedAt: date,
        });
      }

      if (Math.random() < persona.checkinRate) {
        checkinDocs.push({
          personnel: personnel._id,
          source: "daily-checkin",
          sleepHours: randomFloat(...persona.sleep),
          mealsPerDay: randomInt(...persona.meals),
          createdAt: date,
        });
      }
    }
  }
  await HrIndicator.collection.insertMany(dutyDocs);
  await SelfAssessment.collection.insertMany(checkinDocs);
  console.log(`Inserted ${dutyDocs.length} duty entries and ${checkinDocs.length} daily check-ins.`);

  // --- Leave requests: persona.rejections Rejected + a couple Approved + one Pending, spread across the window ---
  const leaveDocs = [];
  let sequenceToday = 1;
  for (const { personnel, persona } of personnelDocs) {
    const admin = admins[persona.adminIdx];
    const requestCount = persona.rejections + 2; // + Approved history + 1 Pending
    const slots = Array.from({ length: requestCount }, (_, i) =>
      Math.floor((i + 1) * (DAYS_BACK / (requestCount + 1))),
    );

    slots.forEach((daysBack, i) => {
      const isPending = i === slots.length - 1;
      const status = isPending ? "Pending" : i < persona.rejections ? "Rejected" : "Approved";
      const fromDate = daysAgo(daysBack);
      const toDate = daysAgo(Math.max(0, daysBack - randomInt(1, 3)));
      const submittedAt = daysAgo(daysBack + randomInt(2, 5));

      leaveDocs.push({
        id: leaveId(submittedAt, sequenceToday++),
        personnel: personnel._id,
        fromDate,
        toDate,
        reason: pick(LEAVE_REASONS),
        status,
        decidedBy: isPending ? undefined : admin._id,
        decidedAt: isPending ? undefined : daysAgo(daysBack + 1),
        submittedAt,
      });
    });
  }
  await LeaveRequest.collection.insertMany(leaveDocs);
  console.log(`Inserted ${leaveDocs.length} leave requests.`);

  console.log("\nDone. Login with any of these (password for all: " + PASSWORD + "):");
  admins.forEach((a) => console.log(`  Admin:     ${a.email}`));
  personnelDocs.forEach(({ personnel }) => console.log(`  Personnel: ${personnel.email}`));

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
