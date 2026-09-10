const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const personnelSelfRoutes = require("./routes/personnelSelf.routes");
const adminAuthRoutes = require("./routes/adminAuth.routes");
const adminPersonnelRoutes = require("./routes/adminPersonnel.routes");
const adminRoutes = require("./routes/admin.routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.get("/health", (req, res) => res.json({ ok: true }));

// Mobile app (MANOVA) - personnel-facing.
app.use("/auth", authRoutes);
app.use("/personnel/me", personnelSelfRoutes);

// Web app (CodeNova) - admin-facing. Login/signup sit at the root per
// its contract (no /auth prefix, unlike the mobile app's).
app.use("/", adminAuthRoutes);
app.use("/personnel", adminPersonnelRoutes);
app.use("/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
