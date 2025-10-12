// backend/routes/auth.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// POST /api/login  (ไม่ใช้ bcrypt — เทียบ plain text เฉพาะช่วงพัฒนา)
router.post("/login", async (req, res) => {
  const username = (req.body?.username || "").trim();
  const password = String(req.body?.password ?? "");

  try {
    if (!username || !password) {
      return res.status(400).json({ message: "missing username/password" });
    }

    // เลือกคอลัมน์ที่ต้องใช้ให้ชัด (รวม password)
    const [rows] = await pool.query(
      "SELECT id, username, full_name, role, major_id, password FROM accounts WHERE username=?",
      [username]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    const user = rows[0];

    // เปรียบเทียบรหัสแบบตรง ๆ
    if (user.password !== password) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    // ดึงสาขา (ถ้ามี)
    let department = null;
    if (user.major_id) {
      const [m] = await pool.query("SELECT name_th FROM majors WHERE id=?", [user.major_id]);
      department = m[0]?.name_th || null;
    }

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        department,
      },
    });
  } catch (err) {
    console.error("🔥 /api/login error:", err);
    // ส่ง message ออกไปด้วยเพื่อ debug ง่ายขึ้น
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
