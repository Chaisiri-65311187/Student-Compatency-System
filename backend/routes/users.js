// backend/routes/users.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

/**
 * GET /api/users
 * Query:
 *  - search: string (ค้นหา username/full_name)
 *  - role:   "student" | "teacher" | "admin" | ""
 *  - page:   number (default 1)
 *  - limit:  number (default 10)
 */
router.get("/", async (req, res) => {
  try {
    const { search = "", role = "", page = 1, limit = 10 } = req.query;
    const PAGE = Math.max(1, Number(page) || 1);
    const LIMIT = Math.max(1, Number(limit) || 10);
    const offset = (PAGE - 1) * LIMIT;

    const where = [];
    const params = [];
    if (search) {
      where.push("(ac.username LIKE ? OR ac.full_name LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (role) {
      where.push("ac.role = ?");
      params.push(role);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM accounts ac ${whereSql}`,
      params
    );

    const [rows] = await pool.query(
      `
      SELECT
        ac.id, ac.username, ac.full_name, ac.role, ac.major_id,
        ac.year_level, ac.created_at,
        COALESCE(m.name_th, m.name_en, '') AS major_name
      FROM accounts ac
      LEFT JOIN majors m ON m.id = ac.major_id
      ${whereSql}
      ORDER BY ac.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, LIMIT, offset]
    );

    res.json({ total, rows });
  } catch (e) {
    console.error("GET /api/users error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/users/:id
 * ดึงข้อมูลผู้ใช้รายคน (รวมชื่อสาขา)
 */
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      `
      SELECT
        ac.id, ac.username, ac.full_name, ac.role, ac.major_id,
        ac.year_level, ac.created_at,
        COALESCE(m.name_th, m.name_en, '') AS major_name
      FROM accounts ac
      LEFT JOIN majors m ON m.id = ac.major_id
      WHERE ac.id = ?
      `,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: "Not found" });
    res.json(rows[0]);
  } catch (e) {
    console.error("GET /api/users/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/users
 * body: { username, password, full_name, role, major_id?, year_level? }
 * - บันทึก year_level เฉพาะ role = "student"
 */
router.post("/", async (req, res) => {
  try {
    const {
      username, password, full_name, role,
      major_id = null,
      year_level = null
    } = req.body || {};

    if (!username || !password || !full_name || !role) {
      return res.status(400).json({ message: "missing fields" });
    }

    const [dups] = await pool.query("SELECT id FROM accounts WHERE username=?", [username]);
    if (dups.length) return res.status(409).json({ message: "username already exists" });

    const yr = role === "student" ? (year_level ?? null) : null;

    const [r] = await pool.query(
      `
      INSERT INTO accounts(username, password, full_name, role, major_id, year_level)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [username.trim(), String(password), full_name.trim(), role, major_id, yr]
    );

    res.status(201).json({ id: r.insertId });
  } catch (e) {
    console.error("POST /api/users error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /api/users/:id
 * body: { password?, full_name?, role?, major_id?, year_level? }
 * - year_level จะถูกเก็บเฉพาะเมื่อ role เป็น "student" (ถ้าส่ง role มาด้วย)
 * - ถ้าไม่ส่ง role มา จะอ้างอิง role เดิมในฐานข้อมูลเพื่อพิจารณา year_level
 */
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    let { password, full_name, role, major_id, year_level, manual_gpa } = req.body || {};

    // ถ้าไม่ส่ง role มา ต้องไปดู role เดิม เพื่อคุม year_level ให้ถูก
    if (role === undefined) {
      const [[row]] = await pool.query("SELECT role FROM accounts WHERE id=?", [id]);
      if (!row) return res.status(404).json({ message: "Not found" });
      role = row.role;
    }

    const fields = [];
    const params = [];

    if (full_name !== undefined) { fields.push("full_name=?"); params.push(full_name); }
    if (role !== undefined) { fields.push("role=?"); params.push(role); }
    if (major_id !== undefined) { fields.push("major_id=?"); params.push(major_id); }
    if (year_level !== undefined) {
      fields.push("year_level=?");
      params.push(role === "student" ? year_level : null);
    }
    if (manual_gpa !== undefined) {
      fields.push("manual_gpa=?");
      params.push(Number(manual_gpa) || null);
    }
    if (password !== undefined && password !== "") {
      fields.push("password=?");
      params.push(String(password));
    }

    if (!fields.length) return res.status(400).json({ message: "nothing to update" });

    params.push(id);
    await pool.query(`UPDATE accounts SET ${fields.join(", ")} WHERE id=?`, params);
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/users/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * DELETE /api/users/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await pool.query("DELETE FROM accounts WHERE id=?", [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/users/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
