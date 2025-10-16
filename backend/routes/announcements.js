// backend/routes/announcements.js
const express = require("express");
const router = express.Router();

// NOTE: ปรับตามการ export ของโปรเจกต์คุณ
// ถ้า db.js export เป็น { pool } ให้ใช้: const { pool } = require("../db");
const pool = require("../db");

/* ----------------------- helpers ----------------------- */
const normInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const pick = (obj, keys = []) =>
  keys.reduce((o, k) => {
    if (obj && obj[k] !== undefined) o[k] = obj[k];
    return o;
  }, {});

/** map periods[] <-> legacy columns in DB */
function periodsToLegacy(cols = {}) {
  const p =
    Array.isArray(cols.work_periods) && cols.work_periods.length
      ? cols.work_periods[0]
      : {};
  return {
    work_date: p.start_date || cols.work_date || null,
    work_end: p.end_date || cols.work_end || null,
    work_time_start: p.start_time || cols.work_time_start || null,
    work_time_end: p.end_time || cols.work_time_end || null,
  };
}
function legacyToPeriods(row = {}) {
  const { work_date, work_end, work_time_start, work_time_end } = row;
  return [
    {
      start_date: work_date || null,
      end_date: work_end || null,
      start_time: work_time_start || null,
      end_time: work_time_end || null,
    },
  ];
}

const addCapacityInfo = (row) => {
  const accepted = Number(row.accepted_count || 0);
  const cap =
    row.capacity === undefined || row.capacity === null
      ? null
      : Number(row.capacity);
  return {
    ...row,
    accepted_count: accepted,
    capacity: cap,
    remaining: cap == null ? null : Math.max(0, cap - accepted),
  };
};

/* =========================================================
 *  รายการ / สร้าง ประกาศ
 * =======================================================*/

// GET /api/announcements?teacher_id=&status=&q=
router.get("/", async (req, res) => {
  try {
    const { teacher_id, status, q } = req.query;
    const where = [];
    const args = [];

    if (teacher_id) {
      where.push("a.teacher_id = ?");
      args.push(normInt(teacher_id));
    }
    if (status) {
      where.push("a.status = ?");
      args.push(status);
    }
    if (q) {
      where.push("(a.title LIKE ? OR a.description LIKE ?)");
      args.push(`%${q}%`, `%${q}%`);
    }

    const sql = `
      SELECT a.*,
             t.full_name AS teacher_name,
             (SELECT COUNT(*) FROM announcement_applications x
               WHERE x.announcement_id = a.id AND x.status = 'accepted') AS accepted_count
      FROM announcements a
      LEFT JOIN accounts t ON t.id = a.teacher_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY a.created_at DESC
    `;
    const [rows] = await pool.query(sql, args);

    const items = rows.map((r) => ({
      ...r,
      work_periods: legacyToPeriods(r), // ให้ FE ใช้รูปแบบเดียวกัน
    }));

    res.json({ items: items.map(addCapacityInfo) });
  } catch (e) {
    console.error("GET /announcements error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/announcements  (ต้องมี teacher_id)
router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const teacher_id = normInt(body.teacher_id);
    if (!teacher_id) return res.status(400).json({ message: "Missing teacher_id" });

    const data = pick(body, [
      "title",
      "description",
      "department",
      "year",
      "status",
      "deadline",
      "location",
      "capacity",
      "seats", // เผื่อฝั่ง FE ส่งชื่อเก่า
    ]);
    data.year = normInt(data.year);
    data.status = data.status || "open";
    // รองรับทั้ง capacity และ seats
    const capacity =
      data.capacity != null ? normInt(data.capacity) : normInt(data.seats);

    // แปลง work_periods -> legacy columns
    const legacy = periodsToLegacy(body);

    await pool.query(
      `INSERT INTO announcements
         (teacher_id, title, description, department, year, status, deadline, location,
          capacity, work_date, work_end, work_time_start, work_time_end)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        teacher_id,
        data.title || "",
        data.description || "",
        data.department || "ไม่จำกัด",
        data.year,
        data.status,
        data.deadline || null,
        data.location || "",
        capacity,
        legacy.work_date,
        legacy.work_end,
        legacy.work_time_start,
        legacy.work_time_end,
      ]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("POST /announcements error:", e);
    res.status(500).json({ message: "Create failed" });
  }
});

/* =========================================================
 *  เส้นทางเฉพาะ (ต้องมาก่อน :id) — นักศึกษาดู “ของฉัน”
 * =======================================================*/

// GET /api/announcements/my-applications?student_id=xx
router.get("/my-applications", async (req, res) => {
  const studentId = normInt(req.query.student_id);
  if (!studentId) return res.status(400).json({ message: "Missing student_id" });

  try {
    const [rows] = await pool.query(
      `SELECT a.id AS application_id, a.status, a.created_at,
              an.id AS announcement_id, an.title, an.deadline, an.status AS announce_status
       FROM announcement_applications a
       JOIN announcements an ON an.id = a.announcement_id
       WHERE a.student_id = ?
       ORDER BY a.created_at DESC`,
      [studentId]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error("GET /my-applications error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
 *  Routes ที่มี :id (ไม่ใช้ regex — ตรวจเลขในโค้ด)
 * =======================================================*/

// GET /api/announcements/:id
router.get("/:id", async (req, res) => {
  const id = normInt(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  try {
    const [rows] = await pool.query(
      `SELECT a.*,
              t.full_name AS teacher_name,
              (SELECT COUNT(*) FROM announcement_applications x
                WHERE x.announcement_id = a.id AND x.status='accepted') AS accepted_count
       FROM announcements a
       LEFT JOIN accounts t ON t.id = a.teacher_id
       WHERE a.id = ?`,
      [id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Not found" });

    const withPeriods = { ...row, work_periods: legacyToPeriods(row) };
    res.json(addCapacityInfo(withPeriods));
  } catch (e) {
    console.error("GET /:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/announcements/:id  (ต้องมี teacher_id)
router.put("/:id", async (req, res) => {
  const id = normInt(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const body = req.body || {};
  const teacher_id = normInt(body.teacher_id);
  if (!teacher_id) return res.status(400).json({ message: "Missing teacher_id" });

  try {
    const data = pick(body, [
      "title",
      "description",
      "department",
      "year",
      "status",
      "deadline",
      "location",
      "capacity",
      "seats",
    ]);
    data.year = normInt(data.year);
    const capacity =
      data.capacity != null ? normInt(data.capacity) : normInt(data.seats);

    const legacy = periodsToLegacy(body);

    await pool.query(
      `UPDATE announcements
         SET title=?, description=?, department=?, year=?, status=?, deadline=?, location=?,
             capacity=?, work_date=?, work_end=?, work_time_start=?, work_time_end=?
       WHERE id=? AND teacher_id=?`,
      [
        data.title || "",
        data.description || "",
        data.department || "ไม่จำกัด",
        data.year,
        data.status || "open",
        data.deadline || null,
        data.location || "",
        capacity,
        legacy.work_date,
        legacy.work_end,
        legacy.work_time_start,
        legacy.work_time_end,
        id,
        teacher_id,
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /:id error:", e);
    res.status(500).json({ message: "Update failed" });
  }
});

// DELETE /api/announcements/:id  (ต้องมี teacher_id - รับได้ทั้ง query/body)
router.delete("/:id", async (req, res) => {
  const id = normInt(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const teacher_id =
    normInt(req.query.teacher_id) ?? normInt((req.body || {}).teacher_id);
  if (!teacher_id) return res.status(400).json({ message: "Missing teacher_id" });

  try {
    await pool.query("DELETE FROM announcements WHERE id=? AND teacher_id=?", [
      id,
      teacher_id,
    ]);
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /:id error:", e);
    res.status(500).json({ message: "Delete failed" });
  }
});

/* =========================================================
 *  สมัคร / ถอนสมัคร / รายชื่อผู้สมัคร / เปลี่ยนสถานะสมัคร
 * =======================================================*/

// POST /api/announcements/:id/apply   body: { student_id, note? }
router.post("/:id/apply", async (req, res) => {
  const annId = normInt(req.params.id);
  const { student_id, note } = req.body || {};
  const sid = normInt(student_id);

  if (!annId) return res.status(400).json({ message: "Invalid announcement id" });
  if (!sid) return res.status(400).json({ message: "Missing student_id" });

  try {
    await pool.query(
      "INSERT INTO announcement_applications (announcement_id, student_id, note) VALUES (?,?,?)",
      [annId, sid, note || null]
    );
    res.json({ ok: true, status: "pending" });
  } catch (e) {
    if (e && e.code === "ER_DUP_ENTRY") {
      return res.json({ ok: true, status: "pending", duplicate: true });
    }
    console.error("POST apply error:", e);
    res.status(500).json({ message: "Apply failed" });
  }
});

// DELETE /api/announcements/:id/apply   body: { student_id }
router.delete("/:id/apply", async (req, res) => {
  const annId = normInt(req.params.id);
  const sid = normInt((req.body || {}).student_id);

  if (!annId) return res.status(400).json({ message: "Invalid announcement id" });
  if (!sid) return res.status(400).json({ message: "Missing student_id" });

  try {
    await pool.query(
      "UPDATE announcement_applications SET status='withdrawn' WHERE announcement_id=? AND student_id=?",
      [annId, sid]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE apply error:", e);
    res.status(500).json({ message: "Withdraw failed" });
  }
});

// GET /api/announcements/:id/applications  (อาจารย์ดูรายชื่อผู้สมัคร)
router.get("/:id/applications", async (req, res) => {
  const annId = normInt(req.params.id);
  if (!annId) return res.status(400).json({ message: "Invalid id" });

  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.student_id, a.status, a.created_at,
              acc.username, acc.full_name
       FROM announcement_applications a
       JOIN accounts acc ON acc.id = a.student_id
       WHERE a.announcement_id=?
       ORDER BY a.created_at DESC`,
      [annId]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error("GET /:id/applications error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/announcements/:id/applications/:appId   body: { action: 'accept'|'reject' }
router.patch("/:id/applications/:appId", async (req, res) => {
  const annId = normInt(req.params.id);
  const appId = normInt(req.params.appId);
  const { action } = req.body || {};
  if (!annId || !appId) return res.status(400).json({ message: "Invalid id" });
  if (!["accept", "reject"].includes(action))
    return res.status(400).json({ message: "Invalid action" });

  // จำกัดตาม capacity ตอน "accept"
  if (action === "accept") {
    const [[row]] = await pool.query(
      `SELECT capacity,
              (SELECT COUNT(*) FROM announcement_applications WHERE announcement_id=? AND status='accepted') AS acc
       FROM announcements WHERE id=?`,
      [annId, annId]
    );
    const cap = row?.capacity == null ? null : Number(row.capacity);
    const acc = Number(row?.acc || 0);
    if (cap != null && acc >= cap) {
      return res.status(409).json({ message: "เต็มตามจำนวนรับแล้ว" });
    }
  }

  const newStatus = action === "accept" ? "accepted" : "rejected";
  await pool.query(
    `UPDATE announcement_applications SET status=? WHERE id=? AND announcement_id=?`,
    [newStatus, appId, annId]
  );
  res.json({ ok: true, status: newStatus });
});

module.exports = router;
