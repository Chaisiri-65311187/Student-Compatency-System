// routes/contact.js
const express = require("express");
const router = express.Router();
const pool = require("../db"); // ปรับ path ถ้า db.js อยู่คนละที่

// ป้องกันยิงถี่ ๆ แบบเบสิค (5 รายการ / นาที / IP)
const rateWindowMs = 60 * 1000;
const maxPerWindow = 5;
const hits = new Map();
function basicRateLimit(req, res, next) {
  const ip = req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress || "unknown";
  const now = Date.now();
  const slot = Math.floor(now / rateWindowMs);
  const key = `${ip}:${slot}`;
  const n = (hits.get(key) || 0) + 1;
  hits.set(key, n);
  if (n > maxPerWindow) return res.status(429).json({ message: "Too many requests, please try again later." });
  next();
}

// POST /api/contact  (ไม่ต้องล็อกอิน)
router.post("/", basicRateLimit, async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ message: "กรอกข้อมูลไม่ครบ (name, email, message)" });
    }
    // ขนาดข้อความกันหลุดมือ
    if (String(message).length > 5000) {
      return res.status(400).json({ message: "ข้อความยาวเกินไป (สูงสุด 5000 ตัวอักษร)" });
    }
    const ip = req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress || null;
    const ua = req.headers["user-agent"] || null;

    await pool.query(
      "INSERT INTO contact_messages (name, email, message, ip_address, user_agent) VALUES (?,?,?,?,?)",
      [name.trim(), email.trim(), message.trim(), ip, ua]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/contact error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// (ทางเลือก) GET /api/contact  — แสดงรายการ (สำหรับแอดมิน)
router.get("/", async (req, res) => {
  try {
    // TODO: ใส่ middleware ตรวจ role=admin ถ้าระบบคุณมี
    const [rows] = await pool.query(
      "SELECT id, name, email, LEFT(message, 400) AS message_preview, status, created_at FROM contact_messages ORDER BY id DESC"
    );
    res.json({ items: rows || [] });
  } catch (e) {
    console.error("GET /api/contact error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// (ทางเลือก) GET รายการเต็มตาม id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query("SELECT * FROM contact_messages WHERE id=?", [id]);
    if (!rows || !rows.length) return res.status(404).json({ message: "Not found" });
    res.json(rows[0]);
  } catch (e) {
    console.error("GET /api/contact/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// (ทางเลือก) PUT เปลี่ยนสถานะ (new/read/archived)
router.put("/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    if (!["new", "read", "archived"].includes(status)) {
      return res.status(400).json({ message: "invalid status" });
    }
    await pool.query("UPDATE contact_messages SET status=? WHERE id=?", [status, id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/contact/:id/status error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
