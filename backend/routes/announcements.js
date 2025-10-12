// backend/routes/announcements.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

/* --------------------------- helpers --------------------------- */
function isFilled(v) {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

async function attachPeriods(rows = []) {
  const ids = rows.map(r => r.id).filter(Boolean);
  if (!ids.length) return rows;

  const placeholders = ids.map(() => '?').join(',');
  const [periods] = await pool.query(
    `SELECT announcement_id, start_date, end_date, start_time, end_time
       FROM announcement_periods
      WHERE announcement_id IN (${placeholders})
      ORDER BY start_date ASC, start_time ASC`,
    ids
  );

  const byId = Object.fromEntries(rows.map(r => [r.id, { ...r, work_periods: [] }]));
  for (const p of periods) {
    const t = byId[p.announcement_id];
    if (!t) continue;
    t.work_periods.push({
      start_date: p.start_date,
      end_date: p.end_date,
      start_time: p.start_time,
      end_time: p.end_time,
    });
  }
  return Object.values(byId);
}

/* ---------------------------- GET / ---------------------------- */
/** รองรับ filter: ?status=&year=&department=&search= */
router.get('/', async (req, res) => {
  try {
    const { status, year, department, search } = req.query;
    const where = [];
    const params = [];

    if (isFilled(status))     { where.push('a.status = ?');              params.push(status); }
    if (isFilled(year))       { where.push('a.year = ?');                params.push(Number(year)); }
    if (isFilled(department)) { where.push('a.department = ?');          params.push(department); }
    if (isFilled(search))     { where.push('(a.title LIKE ? OR a.description LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

    const sql = `
      SELECT a.id, a.title, a.description, a.seats,
             a.work_date, a.work_end, a.work_time_start, a.work_time_end,
             a.year, a.department, a.status, a.location, a.deadline,
             a.teacher, a.created_at, a.updated_at
        FROM announcements a
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY a.created_at DESC
    `;
    const [rows] = await pool.query(sql, params);
    const data = await attachPeriods(rows);
    return res.json({ rows: data, total: data.length });
  } catch (e) {
    console.error('GET /announcements error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ---------------------------- POST / --------------------------- */
/**
 * payload ตัวอย่าง:
 * {
 *   title, description, seats, year, department,
 *   status, location, deadline, teacher,
 *   work_periods: [{ start_date, end_date?, start_time?, end_time? }, ...]  // >= 1 ช่วง
 * }
 */
router.post('/', async (req, res) => {
  const {
    title, description, seats = 1,
    year, department, status = 'open',
    location = null, deadline = null, teacher = null,
    work_periods = []
  } = req.body || {};

  // required
  if (!isFilled(title) || !isFilled(description) || !isFilled(year) || !isFilled(department)) {
    return res.status(400).json({ message: 'missing required fields' });
  }
  if (!Array.isArray(work_periods) || work_periods.length === 0 || !isFilled(work_periods[0]?.start_date)) {
    return res.status(400).json({ message: 'work_periods invalid (ต้องมีอย่างน้อย 1 ช่วงและมี start_date)' });
  }

  // ใช้ช่วงแรกเก็บสรุปไว้ในตารางหลัก (แสดงแบบ legacy/สั้น)
  const first = work_periods[0];
  const firstStartDate = first.start_date;
  const firstEndDate   = isFilled(first.end_date)   ? first.end_date   : firstStartDate; // fallback = วันเริ่ม
  const firstStartTime = isFilled(first.start_time) ? first.start_time : null;
  const firstEndTime   = isFilled(first.end_time)   ? first.end_time   : null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) insert announcements (มี work_end ตามสคีมาใหม่)
    const [ins] = await conn.query(
      `INSERT INTO announcements
         (title, description, seats, work_date, work_end, work_time_start, work_time_end,
          year, department, status, location, deadline, teacher)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        title, description, Number(seats) || 1,
        firstStartDate, firstEndDate, firstStartTime, firstEndTime,
        Number(year), department, status, location || null, deadline || null, teacher || null
      ]
    );
    const annId = ins.insertId;

    // 2) insert periods ทั้งหมด (sanitize ค่าว่างให้เป็น null/แทน end_date)
    for (const p of work_periods) {
      if (!isFilled(p?.start_date)) continue;
      const sd = p.start_date;
      const ed = isFilled(p.end_date)   ? p.end_date   : sd;
      const st = isFilled(p.start_time) ? p.start_time : null;
      const et = isFilled(p.end_time)   ? p.end_time   : null;

      try {
        await conn.query(
          `INSERT INTO announcement_periods
             (announcement_id, start_date, end_date, start_time, end_time)
           VALUES (?,?,?,?,?)`,
          [annId, sd, ed, st, et]
        );
      } catch (err) {
        console.error('insert period failed:', { annId, sd, ed, st, et });
        console.error('mysql error:', { code: err.code, errno: err.errno, sqlState: err.sqlState, sqlMessage: err.sqlMessage });
        throw err;
      }
    }

    await conn.commit();
    return res.status(201).json({ id: annId });
  } catch (e) {
    await conn.rollback();
    console.error('POST /announcements error:', { code: e.code, errno: e.errno, sqlState: e.sqlState, sqlMessage: e.sqlMessage });
    return res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});

module.exports = router; // ✅ สำคัญมาก
