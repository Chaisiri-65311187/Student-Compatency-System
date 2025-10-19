// backend/routes/auth.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

/* ---------- helpers ---------- */

// พยายามใช้ bcrypt ถ้ามี และ hash เป็นรูปแบบ bcrypt ($2...)
async function verifyPassword(inputPassword, userRow) {
  const hash = userRow?.password_hash || userRow?.passwordHash;
  // ถ้ามี bcrypt-hash ให้ลองใช้ bcrypt
  if (hash && typeof hash === "string" && hash.startsWith("$2")) {
    try {
      const bcrypt = require("bcrypt"); // ถ้าไม่ได้ติดตั้ง จะ throw แล้วไป fallback ด้านล่าง
      return await bcrypt.compare(String(inputPassword), String(hash));
    } catch (e) {
      console.warn("bcrypt not available → fallback to plain compare");
      // ไม่มี bcrypt แต่เป็น hash → ปฏิเสธเพื่อความปลอดภัย
      return false;
    }
  }
  // กรณีเก็บ plain text ชั่วคราวตอนพัฒนา
  const plain = userRow?.password || userRow?.pass || null;
  if (plain == null) return false;
  return String(inputPassword) === String(plain);
}

/* ---------- routes ---------- */

// POST /api/login   (body: { username?, email?, password })
router.post("/login", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    if (!password || (!username && !email)) {
      return res
        .status(400)
        .json({ message: "กรอกอีเมลหรือชื่อผู้ใช้ และรหัสผ่าน" });
    }

    // ค้นหาตาม email ถ้ามี ไม่งั้นใช้ username
    const key = email ? "email" : "username";
    const value = email ?? username;

    // ใช้ placeholder column name อย่างปลอดภัยด้วย "??"
    const [rows] = await pool.query(
      "SELECT * FROM accounts WHERE ?? = ? LIMIT 1",
      [key, value]
    );

    if (!rows.length) {
      return res.status(401).json({ message: "อีเมล/ผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง" });
    }

    const user = rows[0];

    const ok = await verifyPassword(password, user);
    if (!ok) {
      return res.status(401).json({ message: "อีเมล/ผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง" });
    }

    // ดึงชื่อสาขาแบบกันพัง (ไม่มีก็ไม่เป็นไร)
    let department = null;
    try {
      if (user.major_id != null) {
        const [m] = await pool.query(
          "SELECT name_th FROM majors WHERE id=?",
          [user.major_id]
        );
        department = m?.[0]?.name_th ?? null;
      }
    } catch (e) {
      console.warn("Lookup major failed:", e.message);
    }

    // Payload ส่งกลับ (อย่าคืนรหัสผ่าน)
    const payload = {
      id: user.id,
      username: user.username ?? null,
      email: user.email ?? null,
      full_name: user.full_name ?? null,
      role: user.role ?? "student",
      year_level: user.year_level ?? null,
      major_id: user.major_id ?? null,
      department,
    };

    // TODO: เปลี่ยนเป็น JWT จริงเมื่อพร้อม
    return res.json({ user: payload, token: "dummy-token" });
  } catch (err) {
    console.error("🔥 /api/login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/logout", (req, res) => {
  try {
    // ถ้ามี session/cookie ก็ลบที่นี่ (ตอนนี้ยังไม่มี ก็คืน ok เฉยๆ)
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
