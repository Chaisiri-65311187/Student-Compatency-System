// backend/routes/announcements.js
// -------------------------------------------------------------
// Announcements & Applications routes (MySQL + Express Router)
// -------------------------------------------------------------

const express = require("express");
const router = express.Router();
const pool = require("../db"); // mysql2/promise pool

// ---------- Helpers ----------
const normInt = (v) => {
  if (v === null || v === undefined) return 0;
  const m = String(v).match(/\d+/); // ดึงชุดตัวเลขแรก เช่น "3:1" -> 3
  const n = m ? Number(m[0]) : NaN;
  return Number.isFinite(n) ? n : 0;
};
const toNullIfEmpty = (s) => {
  if (s === undefined || s === null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
};

const VALID_ANNOUNCE_STATUS = new Set(["open", "closed", "archived"]);
const VALID_APP_STATUS = new Set([
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
  "completed",
]);

// --- schema cache: เช็คว่าตารางมีคอลัมน์นี้ไหม เพื่อลด 500 เวลา schema ต่างกัน ---
const schemaCache = new Map(); // table -> Set(columns)
async function hasColumn(table, column) {
  const key = table.toLowerCase();
  if (!schemaCache.has(key)) {
    const [cols] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
    schemaCache.set(key, new Set(cols.map((c) => String(c.Field).toLowerCase())));
  }
  return schemaCache.get(key).has(String(column).toLowerCase());
}

function mapAnnouncementRow(r) {
  const capacity =
    r.capacity == null || String(r.capacity).trim() === ""
      ? null
      : Number(r.capacity);

  const acceptedLike = Number(r.accepted_count || 0);
  const completed = Number(r.completed_count || 0);
  const applicants = Number(r.applicants_count || 0);

  // occupied: ใช้ max(acceptedLike, applicants) + completed เพื่อกันตัวเลขเพี้ยน
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
    capacity,
    deadline: r.deadline || null,
    work_date: r.work_date || null,
    work_end: r.work_end || null,
    status: r.status || "open",
    created_at: r.created_at,
    updated_at: r.updated_at,
    accepted_count: acceptedLike,
    completed_count: completed,
    applicants_count: applicants,
    remaining,
  };
}

// รวมการคิวรีประกาศ + นับสถานะใบสมัครไว้ที่เดียว
async function getAnnouncementWithCounts(id) {
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
  return rows[0] || null;
}

function isPast(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getTime() < now.getTime();
}

// =============================================================
// 0) MY APPLICATIONS  (ต้องอยู่ก่อน /:id เพื่อไม่โดนจับเป็น id)
//    GET /api/announcements/my-applications?student_id=...
// =============================================================
router.get("/my-applications", async (req, res) => {
  const sid = normInt(req.query.student_id);
  if (!sid) {
    return res.status(400).json({ message: "Missing or invalid student_id" });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        aa.id AS application_id,
        aa.announcement_id,
        aa.status,
        aa.note,
        aa.created_at,
        aa.updated_at,
        a.title,
        a.teacher,
        a.department,
        a.work_date,
        a.work_end,
        a.status AS announce_status
      FROM announcement_applications aa
      JOIN announcements a ON a.id = aa.announcement_id
      WHERE aa.student_id = ?
      ORDER BY aa.updated_at DESC
      `,
      [sid]
    );
    res.json({ items: rows });
  } catch (err) {
    console.error("GET /my-applications error:", err);
    res.status(500).json({ message: "Failed to list my applications" });
  }
});

// =============================================================
// 1) LIST announcements  (GET /api/announcements)
//    รองรับ owner_id เมื่อมีคอลัมน์นี้ในตารางเท่านั้น
//    และกันเคส owner_id=3:1 (จะตีเป็น 3)
//    เพิ่ม pagination: ?limit=20&offset=0
//    เพิ่ม sort: ?orderBy=created_at&order=desc
//    เพิ่ม q: ค้น title/description/teacher
// =============================================================
router.get("/", async (req, res) => {
  const { status, q } = req.query || {};
  const ownerIdRaw = req.query?.owner_id;

  const limit = Math.min(Math.max(normInt(req.query?.limit) || 20, 1), 100);
  const offset = Math.max(normInt(req.query?.offset) || 0, 0);
  const orderByAllow = new Set(["created_at", "updated_at", "deadline", "work_date", "title"]);
  const orderBy = orderByAllow.has(String(req.query?.orderBy)) ? String(req.query.orderBy) : "created_at";
  const order = String(req.query?.order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  async function buildWhere(useOwner) {
    const where = [];
    const params = [];

    if (status && VALID_ANNOUNCE_STATUS.has(String(status))) {
      where.push("a.status = ?");
      params.push(String(status));
    }

    if (useOwner) {
      const hasOwner = await hasColumn("announcements", "owner_id");
      const oid = normInt(ownerIdRaw);
      if (hasOwner && oid) {
        where.push("a.owner_id = ?");
        params.push(oid);
      }
    }

    if (q && String(q).trim() !== "") {
      where.push("(a.title LIKE ? OR a.description LIKE ? OR COALESCE(a.teacher,'') LIKE ?)");
      const kw = `%${String(q).trim()}%`;
      params.push(kw, kw, kw);
    }

    return {
      sqlWhere: where.length ? `WHERE ${where.join(" AND ")}` : "",
      params,
    };
  }

  async function queryList(includeOwner) {
    const { sqlWhere, params } = await buildWhere(includeOwner);
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
      ${sqlWhere}
      ORDER BY a.${orderBy} ${order}
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );
    return rows.map(mapAnnouncementRow);
  }

  try {
    try {
      const items = await queryList(true);
      return res.json({ items, limit, offset, orderBy, order });
    } catch (err) {
      const msg = String(err?.message || "");
      const isOwnerColIssue =
        msg.includes("Unknown column 'owner_id'") || msg.includes("in 'where clause'");
      if (!isOwnerColIssue) throw err;
      const items = await queryList(false);
      return res.json({ items, _fallback: "owner_id_removed", limit, offset, orderBy, order });
    }
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
    const r = await getAnnouncementWithCounts(id);
    if (!r) return res.status(404).json({ message: "Not found" });
    res.json(mapAnnouncementRow(r));
  } catch (e) {
    console.error("GET /announcements/:id error:", e);
    res.status(500).json({ message: "Failed to get announcement" });
  }
});

// =============================================================
// 3) CREATE (POST /api/announcements)
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
// =============================================================
// =============================================================
// 5) Applicants list (GET /api/announcements/:id/applicants)
// =============================================================
router.get("/:id/applicants", async (req, res) => {
  const id = normInt(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  // พยายาม join กับตารางผู้ใช้ (account หรือ accounts) เพื่อนำชื่อมาแสดง
  // ถ้า schema ไม่ตรง ให้ fallback เป็น select เดิม
  try {
    try {
      // กรณีมีตาราง 'account'
      await pool.query(`SELECT 1 FROM account LIMIT 1`);
      const [rows] = await pool.query(
        `
        SELECT 
          aa.id, aa.announcement_id, aa.student_id, aa.status, aa.note,
          aa.created_at, aa.updated_at,
          u.username,
          COALESCE(u.full_name, TRIM(CONCAT(COALESCE(u.first_name,''),' ',COALESCE(u.last_name,'')))) AS full_name
        FROM announcement_applications aa
        JOIN account u ON u.id = aa.student_id
        WHERE aa.announcement_id = ?
        ORDER BY aa.created_at DESC
        `,
        [id]
      );
      return res.json({ items: rows });
    } catch {
      // กรณีไม่มี 'account' ให้ลอง 'accounts'
      try {
        await pool.query(`SELECT 1 FROM accounts LIMIT 1`);
        const [rows] = await pool.query(
          `
          SELECT 
            aa.id, aa.announcement_id, aa.student_id, aa.status, aa.note,
            aa.created_at, aa.updated_at,
            u.username,
            COALESCE(u.full_name, TRIM(CONCAT(COALESCE(u.first_name,''),' ',COALESCE(u.last_name,'')))) AS full_name
          FROM announcement_applications aa
          JOIN accounts u ON u.id = aa.student_id
          WHERE aa.announcement_id = ?
          ORDER BY aa.created_at DESC
          `,
          [id]
        );
        return res.json({ items: rows });
      } catch {
        // ไม่พบทั้งสองตาราง -> ส่งแบบเดิม (ไม่มีชื่อ)
        const [rows] = await pool.query(
          `
          SELECT aa.*
          FROM announcement_applications aa
          WHERE aa.announcement_id = ?
          ORDER BY aa.created_at DESC
          `,
          [id]
        );
        return res.json({ items: rows });
      }
    }
  } catch (e) {
    console.error("GET /announcements/:id/applicants error:", e);
    res.status(500).json({ message: "Failed to list applicants" });
  }
});

// =============================================================
// 6) APPLY (POST /api/announcements/:id/apply)   body: { student_id, note? }
//     - เช็คสถานะประกาศ = open
//     - เช็ค deadline ไม่เลยกำหนด
//     - เช็ค capacity (ด้วยทรานแซกชัน)
// =============================================================
router.post("/:id/apply", async (req, res) => {
  const annId = normInt(req.params.id);
  const { student_id, note } = req.body || {};
  const sid = normInt(student_id);

  if (!annId) return res.status(400).json({ message: "Invalid announcement id" });
  if (!sid) return res.status(400).json({ message: "Missing student_id" });

  try {
    const a = await getAnnouncementWithCounts(annId);
    if (!a) return res.status(404).json({ message: "Announcement not found" });
    if (a.status !== "open") {
      return res.status(400).json({ message: "ประกาศนี้ปิดรับสมัครแล้ว" });
    }
    if (a.deadline && isPast(a.deadline)) {
      return res.status(400).json({ message: "เลยกำหนดรับสมัครแล้ว" });
    }

    // เคสสมัครซ้ำ/ย้อนสถานะ
    const [rows] = await pool.query(
      `SELECT id, status 
         FROM announcement_applications 
        WHERE announcement_id=? AND student_id=?
        ORDER BY id DESC LIMIT 1`,
      [annId, sid]
    );

    if (rows.length > 0) {
      const current = String(rows[0].status || "");
      if (["pending", "accepted", "completed"].includes(current)) {
        return res.status(409).json({ message: "คุณได้สมัครประกาศนี้ไว้แล้ว หรือเสร็จสิ้นงานแล้ว" });
      }
      if (["rejected", "withdrawn"].includes(current)) {
        // เปิดทรานแซกชันเพื่อเช็ค capacity ก่อนเปลี่ยนกลับเป็น pending
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();

          const [rc] = await conn.query(
            `
            SELECT 
              capacity,
              (
                SELECT COUNT(*) FROM announcement_applications x
                WHERE x.announcement_id = a.id
                  AND x.status IN ('pending','accepted')
              ) AS busy,
              (
                SELECT COUNT(*) FROM announcement_applications x
                WHERE x.announcement_id = a.id
                  AND x.status = 'completed'
              ) AS done
            FROM announcements a
            WHERE a.id = ?
            FOR UPDATE
            `,
            [annId]
          );
          const row = rc[0];
          const capacity = row?.capacity == null ? null : Number(row.capacity);
          const busy = Number(row?.busy || 0);
          const done = Number(row?.done || 0);

          if (capacity != null && busy + done >= capacity) {
            await conn.rollback();
            conn.release();
            return res.status(409).json({ message: "จำนวนที่รับเต็มแล้ว" });
          }

          await conn.query(
            `UPDATE announcement_applications 
               SET status='pending', note=?, updated_at=NOW()
             WHERE id=?`,
            [toNullIfEmpty(note), rows[0].id]
          );

          await conn.commit();
          conn.release();
          return res.json({ ok: true, reapply: true, status: "pending" });
        } catch (txErr) {
          try { await conn.rollback(); } catch {}
          conn.release();
          throw txErr;
        }
      }
    }

    // สมัครใหม่ ด้วยทรานแซกชันเช็ค capacity
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rc] = await conn.query(
        `
        SELECT 
          capacity,
          (
            SELECT COUNT(*) FROM announcement_applications x
            WHERE x.announcement_id = a.id
              AND x.status IN ('pending','accepted')
          ) AS busy,
          (
            SELECT COUNT(*) FROM announcement_applications x
            WHERE x.announcement_id = a.id
              AND x.status = 'completed'
          ) AS done
        FROM announcements a
        WHERE a.id = ?
        FOR UPDATE
        `,
        [annId]
      );
      const row = rc[0];
      const capacity = row?.capacity == null ? null : Number(row.capacity);
      const busy = Number(row?.busy || 0);
      const done = Number(row?.done || 0);

      if (capacity != null && busy + done >= capacity) {
        await conn.rollback();
        conn.release();
        return res.status(409).json({ message: "จำนวนที่รับเต็มแล้ว" });
      }

      await conn.query(
        `INSERT INTO announcement_applications 
           (announcement_id, student_id, note, status, created_at, updated_at)
         VALUES (?,?,?, 'pending', NOW(), NOW())`,
        [annId, sid, toNullIfEmpty(note)]
      );

      await conn.commit();
      conn.release();
      return res.json({ ok: true, status: "pending" });
    } catch (txErr) {
      try { await conn.rollback(); } catch {}
      conn.release();
      if (txErr && txErr.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "คุณได้สมัครประกาศนี้ไว้แล้ว" });
      }
      throw txErr;
    }
  } catch (e) {
    console.error("POST apply error:", e);
    res.status(500).json({ message: "Apply failed" });
  }
});

// =============================================================
// 7) WITHDRAW (POST /api/announcements/:id/withdraw)  body: { student_id }
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
      return res.status(400).json({ message: "ถอนสมัครได้เฉพาะใบสมัครที่รอตรวจ" });
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
// 8) เปลี่ยนสถานะใบสมัคร (อาจารย์ใช้งาน) + เช็ค capacity ตอน accept
// =============================================================
router.post("/applications/:appId/accept", async (req, res) => {
  const id = normInt(req.params.appId);
  if (!id) return res.status(400).json({ message: "Invalid id" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // อ่านใบสมัคร + ล็อกประกาศ
    const [apps] = await conn.query(
      `SELECT announcement_id FROM announcement_applications WHERE id=? FOR UPDATE`,
      [id]
    );
    const app = apps[0];
    if (!app) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ message: "ไม่พบใบสมัคร" });
    }

    const annId = Number(app.announcement_id);

    const [rc] = await conn.query(
      `
      SELECT 
        status,
        capacity,
        (
          SELECT COUNT(*) FROM announcement_applications x
          WHERE x.announcement_id = a.id
            AND x.status IN ('pending','accepted')
        ) AS busy,
        (
          SELECT COUNT(*) FROM announcement_applications x
          WHERE x.announcement_id = a.id
            AND x.status = 'completed'
        ) AS done
      FROM announcements a
      WHERE a.id = ?
      FOR UPDATE
      `,
      [annId]
    );
    const row = rc[0];
    if (!row) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ message: "ไม่พบประกาศ" });
    }
    if (row.status !== "open") {
      await conn.rollback(); conn.release();
      return res.status(400).json({ message: "ประกาศนี้ปิดรับแล้ว" });
    }

    const capacity = row?.capacity == null ? null : Number(row.capacity);
    const busy = Number(row?.busy || 0);
    const done = Number(row?.done || 0);

    if (capacity != null && busy + done >= capacity) {
      await conn.rollback(); conn.release();
      return res.status(409).json({ message: "จำนวนที่รับเต็มแล้ว" });
    }

    await conn.query(
      `UPDATE announcement_applications
         SET status='accepted', updated_at=NOW()
       WHERE id=?`,
      [id]
    );

    await conn.commit();
    conn.release();
    res.json({ ok: true, status: "accepted" });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    conn.release();
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
// 9) เปลี่ยนสถานะประกาศ (open/closed/archived)
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

// delete
router.delete("/:id", async (req, res) => {
  const id = normInt(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid id" });
  try {
    await pool.query(`DELETE FROM announcements WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /announcements/:id error:", e);
    res.status(500).json({ message: "Failed to delete" });
  }
});

module.exports = router;
