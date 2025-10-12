// backend/routes/auth.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// POST /api/login  (ไม่ใช้ bcrypt — เทียบ plain text เฉพาะช่วงพัฒนา)
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  try {
    const [rows] = await pool.query("SELECT * FROM accounts WHERE username=?", [username]);
    if (rows.length === 0) return res.status(401).json({ message: "User not found" });

    const user = rows[0];

    // ✅ ถ้าใน DB เก็บเป็น plain text ให้ใช้เทียบตรง ๆ
    //    (เปลี่ยนชื่อคอลัมน์ตาม schema คุณ เช่น password หรือ password_hash)
    if (password !== user.password) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    let department = null;
    if (user.major_id) {
      const [m] = await pool.query("SELECT name_th FROM majors WHERE id=?", [user.major_id]);
      department = m[0]?.name_th || null;
    }

    res.json({
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
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
