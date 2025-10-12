// backend/routes/users.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /api/users?search=&role=&page=1&limit=10
router.get("/", async (req, res) => {
  try {
    const { search = "", role = "", page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where = [];
    const params = [];

    if (search) {
      where.push("(username LIKE ? OR full_name LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (role) {
      where.push("role = ?");
      params.push(role);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM accounts ${whereSql}`,
      params
    );

    const [rows] = await pool.query(
      `
      SELECT ac.id, ac.username, ac.full_name, ac.role, ac.major_id, ac.created_at,
             COALESCE(m.name_th,'-') AS dept
      FROM accounts ac
      LEFT JOIN majors m ON m.id = ac.major_id
      ${whereSql}
      ORDER BY ac.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, Number(limit), offset]
    );

    res.json({ total, rows });
  } catch (e) {
    console.error("GET /api/users error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/users  {username, password, full_name, role, major_id}
router.post("/", async (req, res) => {
  try {
    const { username, password, full_name, role, major_id = null } = req.body || {};
    if (!username || !password || !full_name || !role) {
      return res.status(400).json({ message: "missing fields" });
    }
    const [dups] = await pool.query("SELECT id FROM accounts WHERE username=?", [username]);
    if (dups.length) return res.status(409).json({ message: "username already exists" });

    const [r] = await pool.query(
      "INSERT INTO accounts(username,password,full_name,role,major_id) VALUES (?,?,?,?,?)",
      [username.trim(), String(password), full_name.trim(), role, major_id]
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    console.error("POST /api/users error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/users/:id  {password?, full_name?, role?, major_id?}
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { password, full_name, role, major_id } = req.body || {};

    const fields = [];
    const params = [];
    if (full_name !== undefined) { fields.push("full_name=?"); params.push(full_name); }
    if (role !== undefined)      { fields.push("role=?");      params.push(role); }
    if (major_id !== undefined)  { fields.push("major_id=?");  params.push(major_id); }
    if (password !== undefined && password !== "") { fields.push("password=?"); params.push(String(password)); }

    if (!fields.length) return res.status(400).json({ message: "nothing to update" });

    params.push(id);
    await pool.query(`UPDATE accounts SET ${fields.join(", ")} WHERE id=?`, params);
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/users/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/users/:id
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

// (optional) GET /api/users/majors  ใช้เติม dropdown
router.get("/majors/list", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, name_th AS name FROM majors ORDER BY name_th");
    res.json(rows);
  } catch (e) {
    console.error("GET /api/users/majors/list error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
