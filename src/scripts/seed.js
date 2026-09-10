require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Doctor = require("../models/Doctor");

// There's no endpoint in either contract for creating a doctor (only
// GET /admin/doctors) - they're expected to be provisioned directly,
// which in practice means seeding them.
const DOCTORS = [
  { name: "Dr. Aarav Mehta", role: "Medical Officer", availability: "Available" },
  { name: "Dr. Simran Kaur", role: "Counsellor", availability: "Available" },
  { name: "Dr. Rohan Verma", role: "Clinical Psychologist", availability: "In Session" },
];

async function seed() {
  await connectDB();

  for (const doctor of DOCTORS) {
    await Doctor.findOneAndUpdate({ name: doctor.name }, doctor, { upsert: true });
  }

  console.log(`Seeded ${DOCTORS.length} doctors.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
