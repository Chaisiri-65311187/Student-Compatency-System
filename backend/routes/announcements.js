// backend/routes/announcements.js
const express = require("express");
const router = express.Router();
const pool = require("../db"); // mysql2/promise instance

/* helpers */
function normInt(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function nullableStr(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}
function toDateOrNull(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function toTimeOrNull(v) {
  if (!v) return null;
  const s = String(v).slice(0, 8);
  return /^\d{2}:\d{2}(:\d{2})?$/.test(s) ? s.slice(0, 5) + ":00" : null;
}

/* ------------------------ GET /api/announcements ------------------------ */
/** list with filters:
 *  - teacher_id (number)  -> รายการของอาจารย์คนนั้น
 *  - status ("open"|"closed"|"archived")
 *  - q (search by title/teacher/department)
 */
router.get("/", async (req, res) => {
  try {
    const teacherId = normInt(req.query.teacher_id);
    const status = nullableStr(req.query.status);
    const q = nullableStr(req.query.q);

    const where = [];
    const params = [];
    if (teacherId) { where.push("a.teacher_id = ?"); params.push(teacherId); }
    if (status)     { where.push("a.status = ?");     params.push(status); }
    if (q) {
      where.push("(a.title LIKE ? OR a.teacher LIKE ? OR a.department LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const sql =
      `SELECT a.id, a.title, a.description, a.seats,
              a.work_date, a.work_end, a.work_time_start, a.work_time_end,
              a.year, a.department, a.teacher, a.teacher_id, a.status,
              a.location, a.deadline, a.created_at, a.updated_at
       FROM announcements a
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY a.created_at DESC`;
    const [rows] = await pool.query(sql, params);
    res.json({ items: rows });
  } catch (e) {
    console.error("GET /announcements error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------ GET /api/announcements/:id ------------------------ */
router.get("/:id", async (req, res) => {
  try {
    const id = normInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const [[ann]] = await pool.query(
      `SELECT a.*
         FROM announcements a
        WHERE a.id = ?`,
      [id]
    );
    if (!ann) return res.status(404).json({ message: "Not found" });

    const [periods] = await pool.query(
      `SELECT id, start_date, end_date, start_time, end_time
         FROM announcement_periods
        WHERE announcement_id = ?
        ORDER BY id ASC`,
      [id]
    );
    res.json({ ...ann, work_periods: periods });
  } catch (e) {
    console.error("GET /announcements/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------ POST /api/announcements ------------------------ */
/** body:
 *  title, description, seats, work_date, work_end,
 *  work_time_start, work_time_end,
 *  work_periods: [{start_date,end_date,start_time,end_time}] (optional)
 *  year, department, status, location, deadline,
 *  teacher (display), teacher_id (owner)
 */
router.post("/", async (req, res) => {
  try {
    const {
      title, description,
      seats, work_date, work_end,
      work_time_start, work_time_end,
      work_periods,
      year, department, status,
      location, deadline,
      teacher, teacher_id,
    } = req.body || {};

    if (!nullableStr(title) || !nullableStr(description)) {
      return res.status(400).json({ message: "title/description required" });
    }

    const data = {
      title: String(title).trim(),
      description: String(description).trim(),
      seats: normInt(seats, 1),
      work_date: toDateOrNull(work_date),
      work_end: toDateOrNull(work_end),
      work_time_start: toTimeOrNull(work_time_start),
      work_time_end: toTimeOrNull(work_time_end),
      year: normInt(year),
      department: nullableStr(department),
      status: nullableStr(status) || "open",
      location: nullableStr(location),
      deadline: toDateOrNull(deadline),
      teacher: nullableStr(teacher),
      teacher_id: normInt(teacher_id), // อาจเป็น null ได้ (ถ้าสร้างจากระบบเก่า)
    };

    const [ins] = await pool.query(
      `INSERT INTO announcements
       (title, description, seats, work_date, work_end, work_time_start, work_time_end,
        year, department, teacher, teacher_id, status, location, deadline, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())`,
      [
        data.title, data.description, data.seats,
        data.work_date, data.work_end, data.work_time_start, data.work_time_end,
        data.year, data.department, data.teacher, data.teacher_id,
        data.status, data.location, data.deadline
      ]
    );
    const newId = ins.insertId;

    // periods (optional)
    const periods = Array.isArray(work_periods) ? work_periods : [];
    for (const p of periods) {
      await pool.query(
        `INSERT INTO announcement_periods
           (announcement_id, start_date, end_date, start_time, end_time)
         VALUES (?,?,?,?,?)`,
        [
          newId,
          toDateOrNull(p.start_date),
          toDateOrNull(p.end_date || p.start_date),
          toTimeOrNull(p.start_time),
          toTimeOrNull(p.end_time),
        ]
      );
    }

    const [[created]] = await pool.query(`SELECT * FROM announcements WHERE id=?`, [newId]);
    res.status(201).json({ ...created, work_periods: periods });
  } catch (e) {
    console.error("POST /announcements error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------ PUT /api/announcements/:id ------------------------ */
/** ต้องส่ง teacher_id (เจ้าของ) มาด้วยเพื่อเช็คสิทธิ์ */
router.put("/:id", async (req, res) => {
  try {
    const id = normInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    const teacherId = normInt(req.body?.teacher_id);
    if (!teacherId) return res.status(400).json({ message: "Missing teacher_id" });

    const [[ann]] = await pool.query(`SELECT teacher_id FROM announcements WHERE id=?`, [id]);
    if (!ann) return res.status(404).json({ message: "Not found" });
    if (ann.teacher_id && ann.teacher_id !== teacherId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const {
      title, description,
      seats, work_date, work_end,
      work_time_start, work_time_end,
      work_periods,
      year, department, status,
      location, deadline,
      teacher,
    } = req.body || {};

    await pool.query(
      `UPDATE announcements SET
        title=?,
        description=?,
        seats=?,
        work_date=?,
        work_end=?,
        work_time_start=?,
        work_time_end=?,
        year=?,
        department=?,
        teacher=?,
        status=?,
        location=?,
        deadline=?,
        updated_at=NOW()
       WHERE id=?`,
      [
        nullableStr(title),
        nullableStr(description),
        normInt(seats, 1),
        toDateOrNull(work_date),
        toDateOrNull(work_end),
        toTimeOrNull(work_time_start),
        toTimeOrNull(work_time_end),
        normInt(year),
        nullableStr(department),
        nullableStr(teacher),
        nullableStr(status) || "open",
        nullableStr(location),
        toDateOrNull(deadline),
        id,
      ]
    );

    // replace periods if provided
    if (Array.isArray(work_periods)) {
      await pool.query(`DELETE FROM announcement_periods WHERE announcement_id=?`, [id]);
      for (const p of work_periods) {
        await pool.query(
          `INSERT INTO announcement_periods
             (announcement_id, start_date, end_date, start_time, end_time)
           VALUES (?,?,?,?,?)`,
          [
            id,
            toDateOrNull(p.start_date),
            toDateOrNull(p.end_date || p.start_date),
            toTimeOrNull(p.start_time),
            toTimeOrNull(p.end_time),
          ]
        );
      }
    }

    const [[after]] = await pool.query(`SELECT * FROM announcements WHERE id=?`, [id]);
    const [periods] = await pool.query(
      `SELECT id, start_date, end_date, start_time, end_time
         FROM announcement_periods WHERE announcement_id=? ORDER BY id ASC`,
      [id]
    );
    res.json({ ...after, work_periods: periods });
  } catch (e) {
    console.error("PUT /announcements/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ------------------------ DELETE /api/announcements/:id ------------------------ */
/** ต้องแนบ teacher_id ใน body เพื่อตรวจสิทธิ์ */
router.delete("/:id", async (req, res) => {
  try {
    const id = normInt(req.params.id);
    const teacherId = normInt(req.body?.teacher_id);
    if (!id || !teacherId) {
      return res.status(400).json({ message: "Missing teacher_id or id" });
    }

    const [[ann]] = await pool.query(
      `SELECT teacher_id FROM announcements WHERE id = ?`,
      [id]
    );
    if (!ann) return res.status(404).json({ message: "Not found" });

    // หากประกาศมี owner แล้ว ต้องเป็นเจ้าของเท่านั้นที่ลบได้
    if (ann.teacher_id && ann.teacher_id !== teacherId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await pool.query(`DELETE FROM announcement_periods WHERE announcement_id = ?`, [id]);
    await pool.query(`DELETE FROM announcements WHERE id = ?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /announcements/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
