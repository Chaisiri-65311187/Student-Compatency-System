// backend/routes/announcements.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /api/announcements
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM announcements ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /announcements error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/announcements
router.post("/", async (req, res) => {
  try {
    const { title, description, seats, workDate, year, department, teacher, status, location, deadline } = req.body || {};
    if (!title || !description || !teacher) return res.status(400).json({ message: "Missing required fields" });

    const [r] = await pool.query(
      `INSERT INTO announcements 
        (title, description, seats, work_date, year, department, teacher, status, location, deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, seats, workDate, year, department, teacher, status || 'open', location || null, deadline || null]
    );

    res.status(201).json({ id: r.insertId });
  } catch (err) {
    console.error("POST /announcements error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/announcements/:id  (แก้ไข)
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, description, seats, workDate, year, department, teacher, status, location, deadline } = req.body || {};

    const fields = [];
    const params = [];

    const set = (col, val) => { fields.push(`${col}=?`); params.push(val); };

    if (title !== undefined)       set("title", title);
    if (description !== undefined) set("description", description);
    if (seats !== undefined)       set("seats", seats);
    if (workDate !== undefined)    set("work_date", workDate);
    if (year !== undefined)        set("year", year);
    if (department !== undefined)  set("department", department);
    if (teacher !== undefined)     set("teacher", teacher);
    if (status !== undefined)      set("status", status);
    if (location !== undefined)    set("location", location);
    if (deadline !== undefined)    set("deadline", deadline);

    if (!fields.length) return res.status(400).json({ message: "Nothing to update" });

    params.push(id);
    await pool.query(`UPDATE announcements SET ${fields.join(", ")} WHERE id=?`, params);
    res.json({ ok: true });
  } catch (err) {
    console.error("PUT /announcements/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
