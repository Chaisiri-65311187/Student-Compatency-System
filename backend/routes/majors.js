// backend/routes/majors.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /api/majors/list
router.get("/list", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, code, name_th AS name, name_en FROM majors ORDER BY name_th"
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /majors/list error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;