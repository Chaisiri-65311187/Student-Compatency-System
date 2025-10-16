// backend/routes/accounts.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

/* =====================================================
   CONFIG: Multer สำหรับอัปโหลดภาพโปรไฟล์
===================================================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/avatars");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${req.params.id}_${Date.now()}${ext}`;
    cb(null, safeName);
  },
});
const upload = multer({ storage });

/* =====================================================
   HELPER: คืน URL เต็ม + สร้าง default avatar
===================================================== */
function fullAvatarUrl(row, req) {
  if (row.avatar_url) {
    if (row.avatar_url.startsWith("http")) return row.avatar_url;
    const base = `${req.protocol}://${req.get("host")}`;
    return `${base}${row.avatar_url}`;
  }

  // ถ้าไม่มีรูป → สร้าง default avatar (SVG ชื่อย่อ + สีพื้น)
  const initials = (row.full_name || row.username || "?")
    .split(" ")
    .map((w) => w[0]?.toUpperCase())
    .join("")
    .slice(0, 2);

  const colors = ["#6f42c1", "#0d6efd", "#dc3545", "#198754", "#fd7e14", "#20c997"];
  const bg = colors[Math.floor(Math.random() * colors.length)];
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'>
      <rect width='100%' height='100%' fill='${bg}'/>
      <text x='50%' y='55%' font-size='48' fill='white' text-anchor='middle' font-family='sans-serif'>${initials}</text>
    </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/* =====================================================
   1) GET /api/accounts — รายชื่อผู้ใช้ทั้งหมด
===================================================== */
router.get("/", async (req, res) => {
  try {
    const { role, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params = [];
    let where = "";

    if (role) {
      where = "WHERE role = ?";
      params.push(role);
    }

    const [rows] = await db.query(
      `
      SELECT
        id, username, full_name, first_name, last_name,
        role, major_id, year_level, manual_gpa,
        avatar_url, email, phone, line_id, facebook, github
      FROM accounts
      ${where}
      ORDER BY id
      LIMIT ? OFFSET ?
      `,
      [...params, Number(limit), offset]
    );

    rows.forEach((r) => (r.avatar_url = fullAvatarUrl(r, req)));

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM accounts ${where}`,
      params
    );

    res.json({ rows, total });
  } catch (e) {
    console.error("GET /accounts error:", e);
    res.status(500).json({ message: "server error" });
  }
});

/* =====================================================
   2) GET /api/accounts/:id — ดึงข้อมูลรายคน
===================================================== */
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        id, username, full_name, first_name, last_name,
        role, major_id, year_level, manual_gpa,
        avatar_url, email, phone, line_id, facebook, github
      FROM accounts
      WHERE id = ?
      `,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    const row = rows[0];
    row.avatar_url = fullAvatarUrl(row, req);
    res.json(row);
  } catch (e) {
    console.error("GET /accounts/:id error:", e);
    res.status(500).json({ message: "server error" });
  }
});

/* =====================================================
   3) PUT /api/accounts/:id — แก้ไขโปรไฟล์ผู้ใช้
===================================================== */
router.put("/:id", async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      full_name,
      email,
      phone,
      line_id,
      facebook,
      github,
      avatar_url,
    } = req.body;

    await db.query(
      `
      UPDATE accounts
      SET
        first_name = ?,
        last_name = ?,
        full_name = ?,
        email = ?,
        phone = ?,
        line_id = ?,
        facebook = ?,
        github = ?,
        avatar_url = ?
      WHERE id = ?
      `,
      [
        first_name,
        last_name,
        full_name,
        email,
        phone,
        line_id,
        facebook,
        github,
        avatar_url,
        req.params.id,
      ]
    );

    res.json({ message: "อัปเดตข้อมูลเรียบร้อย" });
  } catch (e) {
    console.error("PUT /accounts/:id error:", e);
    res.status(500).json({ message: "server error" });
  }
});

/* =====================================================
   4) POST /api/accounts/:id/avatar — อัปโหลดรูปโปรไฟล์
===================================================== */
router.post("/:id/avatar", upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "ไม่พบไฟล์ที่อัปโหลด" });

    const relPath = `/uploads/avatars/${req.file.filename}`;
    await db.query("UPDATE accounts SET avatar_url = ? WHERE id = ?", [
      relPath,
      req.params.id,
    ]);

    const fullUrl = `${req.protocol}://${req.get("host")}${relPath}`;
    res.json({ message: "อัปโหลดรูปสำเร็จ", url: fullUrl });
  } catch (e) {
    console.error("POST /accounts/:id/avatar error:", e);
    res.status(500).json({ message: "server error" });
  }
});

module.exports = router;
