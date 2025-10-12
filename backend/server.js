const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();

const allowlist = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
];

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || allowlist.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// ✅ ใช้กับทุก request (รวม preflight)
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ routes
app.use("/api/users", require("./routes/users"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/competency", require("./routes/competencyRoutes"));
app.use("/api/announcements", require("./routes/announcements")); // ✅ ย้ายมาข้างบน
app.use("/api", require("./routes/auth")); // /api/login

// health check
app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
