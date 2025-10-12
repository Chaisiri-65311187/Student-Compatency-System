// backend/routes/admin.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/ping", (req, res) => res.json({ ok: true }));

/** GET /api/admin/overview
 * สรุปจำนวนผู้ใช้จากตาราง accounts เท่านั้น
 */
// GET /api/admin/overview
router.get("/overview", async (req, res) => {
  try {
    const [[{ totalUsers }]]    = await pool.query("SELECT COUNT(*) AS totalUsers FROM accounts");
    const [[{ totalStudents }]] = await pool.query("SELECT COUNT(*) AS totalStudents FROM accounts WHERE role='student'");
    const [[{ totalTeachers }]] = await pool.query("SELECT COUNT(*) AS totalTeachers FROM accounts WHERE role='teacher'");
    const [[{ totalAdmins }]]   = await pool.query("SELECT COUNT(*) AS totalAdmins FROM accounts WHERE role='admin'");
    res.json({ totalUsers, totalStudents, totalTeachers, totalAdmins, totalAnnouncements: 0, pendingReviews: 0 });
  } catch (e) {
    console.error("GET /admin/overview error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/admin/recent-users
router.get("/recent-users", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT ac.id, ac.username, ac.full_name AS name, ac.role,
             COALESCE(m.name_th,'-') AS dept, ac.created_at
      FROM accounts ac
      LEFT JOIN majors m ON m.id = ac.major_id
      ORDER BY ac.created_at DESC
      LIMIT 10
    `);
    res.json(rows);
  } catch (e) {
    console.error("GET /admin/recent-users error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
