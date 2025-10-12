const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();

const allowlist = [
  "http://localhost:5173"
];

const corsOptions = {
  origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  optionsSuccessStatus: 204,
};

// ✅ ใช้กับทุก request (รวม preflight)
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


function loadRouter(modPath) {
  const m = require(modPath);
  if (typeof m === "function") return m;                    // CommonJS: module.exports = router
  if (m && typeof m.default === "function") return m.default; // ESM transpile: export default router
  console.error(`❌ Route "${modPath}" export invalid:`, { type: typeof m, defaultType: m && typeof m.default });
  process.exit(1);
}

// ✅ routes (ใช้ loadRouter)
app.use("/api/users",         loadRouter("./routes/users"));
app.use("/api/admin",         loadRouter("./routes/admin"));
app.use("/api/competency",    loadRouter("./routes/competencyRoutes"));
app.use("/api/announcements", loadRouter("./routes/announcements"));
app.use("/api",               loadRouter("./routes/auth")); // /api/login

// health check
app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
