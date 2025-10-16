// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const app = express();

/* ====== Core middleware ====== */
app.set("trust proxy", 1); // ถ้าอยู่หลัง proxy จะอ่าน IP/Proto ได้ถูก
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

/* ====== CORS ====== */
const corsOptions = {
  origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));

/* ====== Request logger (optional แต่แนะนำ) ====== */
app.use(morgan("dev"));

/* ====== Router loader (รองรับ CJS/ESM) ====== */
function loadRouter(modPath) {
  const m = require(modPath);
  if (typeof m === "function") return m;                         // module.exports = router
  if (m && typeof m.default === "function") return m.default;    // export default router
  console.error(`❌ Route "${modPath}" export invalid:`, { type: typeof m, defaultType: m && typeof m.default });
  process.exit(1);
}

const contactRouter = require("./routes/contact");

/* ====== Mount routes ====== */
app.use("/api", loadRouter("./routes/auth"));
app.use("/api/users", loadRouter("./routes/users"));
app.use("/api/admin", loadRouter("./routes/admin"));
app.use("/api/competency", loadRouter("./routes/competency")); // <- ตรวจให้ตรงชื่อไฟล์
app.use("/api/announcements", loadRouter("./routes/announcements"));
app.use("/api/majors", loadRouter("./routes/majors"));
app.use("/api/accounts", loadRouter("./routes/accounts")); // ✅ route โปรไฟล์
app.use("/uploads", express.static(require("path").join(__dirname, "uploads"))); // ✅ เสิร์ฟไฟล์รูป
app.use("/api/contact", contactRouter);

/* ====== Health ====== */
app.get("/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

/* ====== 404 & Error handler ====== */
app.use((req, res, next) => {
  res.status(404).json({ message: "Not Found", path: req.originalUrl });
});
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Server error" });
});

/* ====== Start ====== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
