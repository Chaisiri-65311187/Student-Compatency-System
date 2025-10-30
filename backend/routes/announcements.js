// backend/routes/announcements.js
// -------------------------------------------------------------
// Announcements & Applications routes (MySQL + Express Router)
// - ป้องกัน "สมัครซ้ำ" เมื่อมีสถานะ existing = pending/accepted/completed
// - รองรับ re-apply เฉพาะเมื่อ rejected/withdrawn เท่านั้น
// - มี endpoints สำหรับ list/create/update/get, applicants list,
//   apply/withdraw, accept/reject/complete, และนับสรุป accepted/completed/remaining
// -------------------------------------------------------------

const express = require("express");
const router = express.Router();

// ปรับ path ตรงนี้ให้ตรงกับโค้ดคุณ
// สมมติคุณมีไฟล์ db.js ที่ export mysql2/promise pool
const pool = require("../db"); // => module.exports = pool

// ---------- Helpers ----------
const normInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const toNullIfEmpty = (s) => {
  if (s === undefined || s === null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
};
const now = () => new Date();

// ป้องกันอินพุต status ไม่ให้หลุดนอกชุด
const VALID_ANNOUNCE_STATUS = new Set(["open", "closed", "archived"]);
const VALID_APP_STATUS = new Set([
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
  "completed",
]);

// ---------- Normalizers ----------
function mapAnnouncementRow(r) {
  // นับจำนวนที่โควตาถูกใช้ไป (occupied) = max(acceptedLike, applicants_count) + completed
  const capacity =
    r.capacity == null || String(r.capacity).trim() === ""
      ? null
      : Number(r.capacity);

  const acceptedLike = Number(r.accepted_count || 0);
  const completed = Number(r.completed_count || 0);
  const applicants = Number(r.applicants_count || 0);
  const occupiedBase = Math.max(acceptedLike, applicants);
  const occupied = occupiedBase + completed;
  const remaining = capacity == null ? null : Math.max(0, capacity - occupied);

  return {
    id: r.id,
    title: r.title,
    description: r.description || "",
    teacher: r.teacher || r.teacher_name || r.owner_name || "",
    owner_id: r.owner_id || null,
    department: r.department || "ไม่จำกัด",
    year: r.year ? Number(r.year) : null,
    location: r.location || "",
    capacity: capacity,
    deadline: r.deadline || null,
    work_date: r.work_date || null,
    work_end: r.work_end || null,
    status: r.status || "open",
    created_at: r.created_at,
    updated_at: r.updated_at,

    // summary
    accepted_count: acceptedLike,
    completed_count: completed,
    applicants_count: applicants,
    remaining,
  };
}

// =============================================================
// 1) LIST announcements  (GET /api/announcements)
//    query: status=open|closed|archived, owner_id, q (keyword)
// =============================================================
router.get("/", async (req, res) => {
  const { status, owner_id, q } = req.query || {};

  const where = [];
  const params = [];

  if (status && VALID_ANNOUNCE_STATUS.has(String(status))) {
    where.push("a.status = ?");
    params.push(String(status));
  }
  if (owner_id) {
    where.push("a.owner_id = ?");
    params.push(normInt(owner_id));
  }
  if (q && String(q).trim() !== "") {
    where.push("(a.title LIKE ? OR a.description LIKE ? OR a.teacher LIKE ?)");
    const kw = `%${String(q).trim()}%`;
    params.push(kw, kw, kw);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    // นับค่า summary ด้วย subqueries
    const [rows] = await pool.query(
      `
      SELECT 
        a.*,
        -- คนที่ถูกอนุมัติ/รอตรวจ (ถือว่ากินโควตา)
        (
          SELECT COUNT(*) FROM announcement_applications x
          WHERE x.announcement_id = a.id
            AND x.status IN ('pending','accepted')
        ) AS accepted_count,
        -- คนที่เสร็จสิ้นงานแล้ว
        (
          SELECT COUNT(*) FROM announcement_applications x
          WHERE x.announcement_id = a.id
            AND x.status = 'completed'
        ) AS completed_count,
        -- ผู้สมัครทั้งหมดทุกสถานะ (ใช้เป็นตัวเทียบ)
        (
          SELECT COUNT(*) FROM announcement_applications x
          WHERE x.announcement_id = a.id
        ) AS applicants_count
      FROM announcements a
      ${whereSql}
      ORDER BY a.created_at DESC
      `,
      params
    );

    const items = rows.map(mapAnnouncementRow);
    res.json({ items });
  } catch (e) {
    console.error("GET /announcements error:", e);
    res.status(500).json({ message: "Failed to list announcements" });
  }
});

// =============================================================
// 2) GET one (GET /api/announcements/:id)
// =============================================================
router.get("/:id", async (req, res) => {
  const id = normInt(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        a.*,
        (
          SELECT COUNT(*) FROM announcement_applications x
          WHERE x.announcement_id = a.id
            AND x.status IN ('pending','accepted')
        ) AS accepted_count,
        (
          SELECT COUNT(*) FROM announcement_applications x
          WHERE x.announcement_id = a.id
            AND x.status = 'completed'
        ) AS completed_count,
        (
          SELECT COUNT(*) FROM announcement_applications x
          WHERE x.announcement_id = a.id
        ) AS applicants_count
      FROM announcements a
      WHERE a.id = ?
      `,
      [id]
    );
    const r = rows[0];
    if (!r) return res.status(404).json({ message: "Not found" });
    res.json(mapAnnouncementRow(r));
  } catch (e) {
    console.error("GET /announcements/:id error:", e);
    res.status(500).json({ message: "Failed to get announcement" });
  }
});

// =============================================================
// 3) CREATE (POST /api/announcements)
//    body: { title, description?, teacher?, owner_id?, department?, year?,
//            location?, capacity?, deadline?, work_date?, work_end?, status? }
// =============================================================
router.post("/", async (req, res) => {
  const {
    title,
    description,
    teacher,
    owner_id,
    department,
    year,
    location,
    capacity,
    deadline,
    work_date,
    work_end,
    status,
  } = req.body || {};

  if (!title || String(title).trim() === "") {
    return res.status(400).json({ message: "title is required" });
  }

  const stat = VALID_ANNOUNCE_STATUS.has(String(status)) ? String(status) : "open";

  try {
    const [ins] = await pool.query(
      `
      INSERT INTO announcements
        (title, description, teacher, owner_id, department, year, location, capacity,
         deadline, work_date, work_end, status, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())
      `,
      [
        String(title).trim(),
        toNullIfEmpty(description),
        toNullIfEmpty(teacher),
        owner_id ? normInt(owner_id) : null,
        toNullIfEmpty(department),
        year ? normInt(year) : null,
        toNullIfEmpty(location),
        capacity != null && String(capacity).trim() !== "" ? normInt(capacity) : null,
        toNullIfEmpty(deadline),
        toNullIfEmpty(work_date),
        toNullIfEmpty(work_end),
        stat,
      ]
    );

    const newId = ins.insertId;
    const [rows] = await pool.query(`SELECT * FROM announcements WHERE id=?`, [newId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("POST /announcements error:", e);
    res.status(500).json({ message: "Failed to create announcement" });
  }
});

// =============================================================
// 4) UPDATE (PATCH /api/announcements/:id)
// =============================================================
router.patch("/:id", async (req, res) => {
  const id = normInt(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const fields = [];
  const params = [];

  const allow = [
    "title",
    "description",
    "teacher",
    "owner_id",
    "department",
    "year",
    "location",
    "capacity",
    "deadline",
    "work_date",
    "work_end",
    "status",
  ];

  for (const k of allow) {
    if (req.body[k] !== undefined) {
      if (k === "status") {
        const v = String(req.body[k]);
        if (!VALID_ANNOUNCE_STATUS.has(v)) continue;
        fields.push(`status=?`);
        params.push(v);
      } else if (k === "owner_id" || k === "year" || k === "capacity") {
        const val =
          req.body[k] == null || String(req.body[k]).trim() === ""
            ? null
            : normInt(req.body[k]);
        fields.push(`${k}=?`);
        params.push(val);
      } else {
        fields.push(`${k}=?`);
        params.push(toNullIfEmpty(req.body[k]));
      }
    }
  }

  if (!fields.length) return res.json({ ok: true, message: "No changes" });

  try {
    await pool.query(
      `UPDATE announcements SET ${fields.join(", ")}, updated_at=NOW() WHERE id=?`,
      [...params, id]
    );
    const [rows] = await pool.query(`SELECT * FROM announcements WHERE id=?`, [id]);
    res.json(rows[0] || { ok: true });
  } catch (e) {
    console.error("PATCH /announcements/:id error:", e);
    res.status(500).json({ message: "Failed to update" });
  }
});

// =============================================================
// 5) Applicants list (GET /api/announcements/:id/applicants)
//    (ถ้าคุณมีตาราง users/students ให้ JOIN เพิ่มเองภายหลังได้)
// =============================================================
router.get("/:id/applicants", async (req, res) => {
  const id = normInt(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  try {
    const [rows] = await pool.query(
      `
      SELECT aa.*
      FROM announcement_applications aa
      WHERE aa.announcement_id = ?
      ORDER BY aa.created_at DESC
      `,
      [id]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error("GET /announcements/:id/applicants error:", e);
    res.status(500).json({ message: "Failed to list applicants" });
  }
});

// =============================================================
// 6) APPLY (POST /api/announcements/:id/apply)   body: { student_id, note? }
//    กันสมัครซ้ำเมื่อมี record เดิมสถานะ pending/accepted/completed
//    ถ้า rejected/withdrawn -> อนุญาต re-apply (update แถวเดิมเป็น pending)
// =============================================================
router.post("/:id/apply", async (req, res) => {
  const annId = normInt(req.params.id);
  const { student_id, note } = req.body || {};
  const sid = normInt(student_id);

  if (!annId) return res.status(400).json({ message: "Invalid announcement id" });
  if (!sid) return res.status(400).json({ message: "Missing student_id" });

  try {
    // ใบสมัครล่าสุดของคู่นี้
    const [rows] = await pool.query(
      `SELECT id, status 
         FROM announcement_applications 
        WHERE announcement_id=? AND student_id=?
        ORDER BY id DESC LIMIT 1`,
      [annId, sid]
    );

    if (rows.length > 0) {
      const current = String(rows[0].status || "");

      // ❌ Block สมัครซ้ำ
      if (["pending", "accepted", "completed"].includes(current)) {
        return res
          .status(409)
          .json({ message: "คุณได้สมัครประกาศนี้ไว้แล้ว หรือเสร็จสิ้นงานแล้ว" });
      }

      // ✅ Re-apply เมื่อ rejected/withdrawn
      if (["rejected", "withdrawn"].includes(current)) {
        await pool.query(
          `UPDATE announcement_applications 
              SET status='pending', note=?, updated_at=NOW()
            WHERE id=?`,
          [toNullIfEmpty(note), rows[0].id]
        );
        return res.json({ ok: true, reapply: true, status: "pending" });
      }
    }

    // ✅ สมัครใหม่
    await pool.query(
      `INSERT INTO announcement_applications 
         (announcement_id, student_id, note, status, created_at, updated_at)
       VALUES (?,?,?, 'pending', NOW(), NOW())`,
      [annId, sid, toNullIfEmpty(note)]
    );
    res.json({ ok: true, status: "pending" });
  } catch (e) {
    if (e && e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "คุณได้สมัครประกาศนี้ไว้แล้ว" });
    }
    console.error("POST apply error:", e);
    res.status(500).json({ message: "Apply failed" });
  }
});

// =============================================================
// 7) WITHDRAW (POST /api/announcements/:id/withdraw)
//    body: { student_id }
//    อนุญาตถอนเฉพาะสถานะ pending
// =============================================================
router.post("/:id/withdraw", async (req, res) => {
  const annId = normInt(req.params.id);
  const sid = normInt(req.body?.student_id);

  if (!annId || !sid) return res.status(400).json({ message: "Invalid params" });

  try {
    const [rows] = await pool.query(
      `SELECT id, status FROM announcement_applications
        WHERE announcement_id=? AND student_id=?
        ORDER BY id DESC LIMIT 1`,
      [annId, sid]
    );
    const cur = rows[0];
    if (!cur) return res.status(404).json({ message: "ไม่พบใบสมัคร" });
    if (cur.status !== "pending") {
      return res
        .status(400)
        .json({ message: "ถอนสมัครได้เฉพาะใบสมัครที่รอตรวจ" });
    }
    await pool.query(
      `UPDATE announcement_applications 
          SET status='withdrawn', updated_at=NOW()
        WHERE id=?`,
      [cur.id]
    );
    res.json({ ok: true, status: "withdrawn" });
  } catch (e) {
    console.error("POST withdraw error:", e);
    res.status(500).json({ message: "Withdraw failed" });
  }
});

// =============================================================
// 8) เปลี่ยนสถานะใบสมัคร (อาจารย์ใช้งาน)
//    - ACCEPT   : POST /api/announcements/applications/:appId/accept
//    - REJECT   : POST /api/announcements/applications/:appId/reject
//    - COMPLETE : POST /api/announcements/applications/:appId/complete
// =============================================================
router.post("/applications/:appId/accept", async (req, res) => {
  const id = normInt(req.params.appId);
  if (!id) return res.status(400).json({ message: "Invalid id" });
  try {
    await pool.query(
      `UPDATE announcement_applications
          SET status='accepted', updated_at=NOW()
        WHERE id=?`,
      [id]
    );
    res.json({ ok: true, status: "accepted" });
  } catch (e) {
    console.error("accept error:", e);
    res.status(500).json({ message: "Failed to accept" });
  }
});

router.post("/applications/:appId/reject", async (req, res) => {
  const id = normInt(req.params.appId);
  if (!id) return res.status(400).json({ message: "Invalid id" });
  try {
    await pool.query(
      `UPDATE announcement_applications
          SET status='rejected', updated_at=NOW()
        WHERE id=?`,
      [id]
    );
    res.json({ ok: true, status: "rejected" });
  } catch (e) {
    console.error("reject error:", e);
    res.status(500).json({ message: "Failed to reject" });
  }
});

router.post("/applications/:appId/complete", async (req, res) => {
  const id = normInt(req.params.appId);
  if (!id) return res.status(400).json({ message: "Invalid id" });
  try {
    await pool.query(
      `UPDATE announcement_applications
          SET status='completed', updated_at=NOW()
        WHERE id=?`,
      [id]
    );
    res.json({ ok: true, status: "completed" });
  } catch (e) {
    console.error("complete error:", e);
    res.status(500).json({ message: "Failed to complete" });
  }
});

// =============================================================
// 9) (ออปชัน) เปลี่ยนสถานะประกาศ (เปิด/ปิด/เก็บถาวร)
//    POST /api/announcements/:id/status  body: { status }
// =============================================================
router.post("/:id/status", async (req, res) => {
  const id = normInt(req.params.id);
  const { status } = req.body || {};
  const st = String(status || "");
  if (!id || !VALID_ANNOUNCE_STATUS.has(st)) {
    return res.status(400).json({ message: "Invalid params" });
  }
  try {
    await pool.query(
      `UPDATE announcements SET status=?, updated_at=NOW() WHERE id=?`,
      [st, id]
    );
    res.json({ ok: true, status: st });
  } catch (e) {
    console.error("change announcement status error:", e);
    res.status(500).json({ message: "Failed to change status" });
  }
});

module.exports = router;
