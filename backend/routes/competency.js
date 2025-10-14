// backend/routes/competency.js
// ------------------------------------------------------------------
// Competency API (โปรไฟล์, วิชาบังคับ, เกรดรายวิชา, ภาษา, เทคฯ,
// กิจกรรม, และสรุปคะแนนด้านวิชาการ) — ใช้ร่วมกับ backend/db.js
// ------------------------------------------------------------------

const express = require("express");
const router = express.Router();
const pool = require("../db");

/* -------------------------------------------
 * Utilities / Helpers
 * -----------------------------------------*/

// เกรด → คะแนน fallback
const FALLBACK_POINTS = {
  A: 4.0, "B+": 3.3, B: 3.0, "C+": 2.3, C: 2.0, "D+": 1.3, D: 1.0, F: 0.0,
};

// โหลดเกรดจาก DB ถ้ามีตาราง grade_scale
async function loadGradeScaleMap() {
  try {
    const [rows] = await pool.query("SELECT letter, point FROM grade_scale");
    if (!rows?.length) return FALLBACK_POINTS;
    const map = {};
    for (const r of rows) map[r.letter] = Number(r.point);
    return { ...FALLBACK_POINTS, ...map };
  } catch {
    return FALLBACK_POINTS;
  }
}

// คำนวณ GPA จาก student_course_grades
async function computeGPA(accountId) {
  const gradeMap = await loadGradeScaleMap();
  const [rows] = await pool.query(
    `SELECT scg.letter, c.credit
     FROM student_course_grades scg
     JOIN course_catalog c ON c.id = scg.course_id
     WHERE scg.account_id = ?`,
    [accountId]
  );
  let sumPoints = 0, sumCredits = 0;
  for (const r of rows) {
    const gp = gradeMap[r.letter] ?? 0;
    const cr = Number(r.credit || 0);
    sumPoints += gp * cr;
    sumCredits += cr;
  }
  if (!sumCredits) return null;
  return Math.round((sumPoints / sumCredits) * 100) / 100;
}

// คำนวณ % ผ่านวิชาบังคับของสาขา/ปี/เทอม
async function computeCoreCompletionPct(accountId, majorId, yearLevel, semester) {
  const gradeMap = await loadGradeScaleMap();
  const [reqRows] = await pool.query(
    `SELECT mrc.course_id
     FROM major_required_courses mrc
     WHERE mrc.major_id = ? AND mrc.year_level = ? AND mrc.semester = ?`,
    [majorId, yearLevel, semester]
  );
  if (!reqRows.length) return 0;

  const courseIds = reqRows.map((r) => r.course_id);
  const [got] = await pool.query(
    `SELECT scg.course_id, scg.letter
     FROM student_course_grades scg
     WHERE scg.account_id = ?
       AND scg.course_id IN (${courseIds.map(() => "?").join(",")})`,
    [accountId, ...courseIds]
  );

  const passedSet = new Set(
    got.filter((g) => (gradeMap[g.letter] ?? 0) >= 1.0).map((g) => g.course_id)
  );
  const passed = reqRows.filter((r) => passedSet.has(r.course_id)).length;
  const pct = (passed / reqRows.length) * 100;
  return Math.round(pct * 100) / 100;
}

// GPA → คะแนน (0..25)
function scoreFromGPA(gpa) {
  if (gpa == null) return 0;
  const x = Number(gpa);
  if (x >= 3.75) return 25;
  if (x >= 3.50) return 22;
  if (x >= 3.25) return 19;
  if (x >= 3.00) return 16;
  if (x >= 2.75) return 12;
  if (x >= 2.50) return 8;
  if (x >= 2.00) return 4;
  return 0;
}

/* -------------------------------------------
 * Health Check
 * -----------------------------------------*/
router.get("/ping", (req, res) => res.json({ ok: true, scope: "competency" }));

/* -------------------------------------------
 * 1) Profile summary
 * -----------------------------------------*/
router.get("/profile/:accountId", async (req, res) => {
  const accountId = Number(req.params.accountId || 0);
  if (!accountId) return res.status(400).json({ message: "invalid accountId" });
  try {
    const [[acct]] = await pool.query(
      `SELECT id, username, full_name, major_id, year_level, manual_gpa
       FROM accounts WHERE id=?`,
      [accountId]
    );
    if (!acct) return res.status(404).json({ message: "account not found" });
    const computed_gpa = await computeGPA(accountId);
    res.json({ account: acct, computed_gpa });
  } catch (e) {
    console.error("GET /profile error", e);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/profile/:accountId", async (req, res) => {
  const accountId = Number(req.params.accountId || 0);
  const { manual_gpa, year_level, note } = req.body || {};
  if (!accountId) return res.status(400).json({ message: "invalid accountId" });
  try {
    await pool.query(
      `UPDATE accounts SET manual_gpa=?, year_level=? WHERE id=?`,
      [manual_gpa ?? null, year_level ?? null, accountId]
    );
    if (typeof note === "string") {
      await pool.query(
        `INSERT INTO competency_profiles (account_id, note)
         VALUES (?, ?) ON DUPLICATE KEY UPDATE note=VALUES(note)`,
        [accountId, note]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /profile error", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* -------------------------------------------
 * 2) วิชาบังคับตามสาขา/ชั้นปี/เทอม
 * -----------------------------------------*/
router.get("/courses/required", async (req, res) => {
  const majorId = Number(req.query.major || 0);
  const year = Number(req.query.year || 0);
  const sem = Number(req.query.sem || 0);
  if (!majorId || !year || !sem)
    return res.status(400).json({ message: "major, year, sem required" });
  try {
    const [rows] = await pool.query(
      `SELECT c.code, c.name_th, c.name_en, c.credit
       FROM major_required_courses mrc
       JOIN course_catalog c ON c.id = mrc.course_id
       WHERE mrc.major_id=? AND mrc.year_level=? AND mrc.semester=?
       ORDER BY c.code`,
      [majorId, year, sem]
    );
    res.json({ major_id: majorId, year_level: year, semester: sem, required: rows });
  } catch (e) {
    console.error("GET /courses/required error", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* -------------------------------------------
 * 3) เกรดรายวิชา (GET / POST bulk)
 * -----------------------------------------*/
router.get("/courses/grades/:accountId", async (req, res) => {
  const accountId = Number(req.params.accountId);
  const { year, sem } = req.query;
  if (!accountId) return res.status(400).json({ message: "accountId required" });
  try {
    const params = [accountId];
    let filter = "scg.account_id = ?";
    if (year) { filter += " AND scg.taken_year = ?";     params.push(Number(year)); }
    if (sem)  { filter += " AND scg.taken_semester = ?"; params.push(Number(sem)); }

    const sql = `
      SELECT scg.id, scg.course_id, scg.letter, scg.taken_year, scg.taken_semester,
             cc.code AS course_code, cc.name_th, cc.credit
      FROM student_course_grades scg
      JOIN course_catalog cc ON cc.id = scg.course_id
      WHERE ${filter}
        AND NOT EXISTS (
          SELECT 1
          FROM student_course_grades scg2
          WHERE scg2.account_id = scg.account_id
            AND scg2.course_id  = scg.course_id
            AND scg2.id         > scg.id
            ${year ? " AND scg2.taken_year = scg.taken_year" : ""}
            ${sem  ? " AND scg2.taken_semester = scg.taken_semester" : ""}
        )
      ORDER BY cc.code ASC
    `;
    const [rows] = await pool.query(sql, params);
    const map = {};
    rows.forEach((r) => { map[r.course_code] = r.letter; });
    res.json({ items: rows, map });
  } catch (e) {
    console.error("GET /courses/grades error", e);
    res.status(500).json({ message: "fetch grades failed" });
  }
});

router.post("/courses/grades/bulk", async (req, res) => {
  const { account_id, items } = req.body || {};
  if (!account_id || !Array.isArray(items))
    return res.status(400).json({ message: "account_id and items[] required" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const it of items) {
      const [crs] = await conn.query("SELECT id FROM course_catalog WHERE code=?", [String(it.course_code)]);
      if (!crs.length) continue;
      const course_id = crs[0].id;
      await conn.query("DELETE FROM student_course_grades WHERE account_id=? AND course_id=?", [account_id, course_id]);
      await conn.query(
        "INSERT INTO student_course_grades (account_id, course_id, letter, taken_year, taken_semester) VALUES (?,?,?,?,?)",
        [account_id, course_id, it.letter, it.year ?? null, it.semester ?? null]
      );
    }
    await conn.commit();
    res.json({ ok: true, count: items.length });
  } catch (e) {
    await conn.rollback();
    console.error("POST /courses/grades/bulk error", e);
    res.status(500).json({ message: "save grades failed" });
  } finally {
    conn.release();
  }
});

/* -------------------------------------------
 * 4) ภาษา (CEPT)
 * -----------------------------------------*/
router.get("/language/latest/:accountId", async (req, res) => {
  const accountId = Number(req.params.accountId || 0);
  const framework = (req.query.framework || "CEPT").toUpperCase();
  if (!accountId) return res.status(400).json({ message: "invalid accountId" });

  try {
    const [rows] = await pool.query(
      `SELECT framework, level, taken_at, score_raw
       FROM student_language_results
       WHERE account_id=? AND framework=?
       ORDER BY taken_at DESC, id DESC
       LIMIT 1`,
      [accountId, framework]
    );
    res.json({ latest: rows[0] || null });
  } catch (e) {
    console.error("GET /language/latest error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ ใหม่: ดึง "ล่าสุดต่อ framework" ทั้ง 3 อย่างในคำขอเดียว
// GET /api/competency/language/latest-all/:accountId
// ✅ เพิ่ม endpoint ดึงผลสอบภาษา "ล่าสุดต่อ framework" (CEPT, ICT, ITPE)
router.get("/language/latest-all/:accountId", async (req, res) => {
  const accountId = Number(req.params.accountId || 0);
  if (!accountId) return res.status(400).json({ message: "invalid accountId" });
  try {
    const [rows] = await pool.query(
      `SELECT s1.framework, s1.level, s1.taken_at, s1.score_raw
       FROM student_language_results s1
       JOIN (
         SELECT framework, MAX(CONCAT(IFNULL(DATE_FORMAT(taken_at,'%Y%m%d'), '00000000'), LPAD(id,10,'0'))) AS max_key
         FROM student_language_results
         WHERE account_id=?
         GROUP BY framework
       ) x
       ON s1.framework=x.framework
       AND CONCAT(IFNULL(DATE_FORMAT(s1.taken_at,'%Y%m%d'), '00000000'), LPAD(s1.id,10,'0'))=x.max_key
       WHERE s1.account_id=?`,
      [accountId, accountId]
    );
    const map = {};
    rows.forEach(r => { map[r.framework] = r; });
    res.json({ CEPT: map.CEPT || null, ICT: map.ICT || null, ITPE: map.ITPE || null });
  } catch (e) {
    console.error("GET /language/latest-all error", e);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/language", async (req, res) => {
  const { account_id, framework, level, taken_at, score_raw } = req.body || {};
  // ✅ ไม่บังคับ level แล้ว
  if (!account_id || !framework) {
    return res.status(400).json({ message: "account_id และ framework จำเป็น" });
  }

  try {
    await pool.query(
      `INSERT INTO student_language_results
       (account_id, framework, level, taken_at, score_raw)
       VALUES (?,?,?,?,?)`,
      [account_id, framework, level ?? null, taken_at ?? null, score_raw ?? null]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /language error", e);
    // กันเคสตารางยังไม่พร้อม
    if (e?.code === "ER_NO_SUCH_TABLE" || e?.sqlState === "42S02") {
      return res.status(400).json({ message: "table student_language_results not found" });
    }
    res.status(500).json({ message: "Server error" });
  }
});
/* -------------------------------------------
 * 5) ใบรับรอง/อบรม (Tech)
 * -----------------------------------------*/
router.get("/tech/certs/:accountId", async (req, res) => {
  const accountId = Number(req.params.accountId || 0);
  if (!accountId) return res.status(400).json({ message: "invalid accountId" });
  try {
    const [rows] = await pool.query(
      `SELECT stc.id, tc.vendor, tc.name, stc.passed_at, stc.doc_url
       FROM student_tech_certs stc
       JOIN tech_certifications tc ON tc.id = stc.cert_id
       WHERE stc.account_id=? ORDER BY tc.vendor, tc.name`,
      [accountId]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error("GET /tech/certs error", e);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/tech/certs", async (req, res) => {
  const { account_id, cert_id, passed_at, doc_url } = req.body || {};
  if (!account_id || !cert_id)
    return res.status(400).json({ message: "account_id, cert_id required" });
  try {
    await pool.query(
      `INSERT INTO student_tech_certs (account_id, cert_id, passed_at, doc_url)
       VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE passed_at=VALUES(passed_at), doc_url=VALUES(doc_url)`,
      [account_id, cert_id, passed_at ?? null, doc_url ?? null]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /tech/certs error", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* -------------------------------------------
 * 6) กิจกรรมสังคม/สื่อสาร
 * -----------------------------------------*/
router.get("/activities/:accountId", async (req, res) => {
  const accountId = Number(req.params.accountId || 0);
  const cat = req.query.cat || null;
  if (!accountId) return res.status(400).json({ message: "invalid accountId" });
  try {
    const params = [accountId];
    let sql = `SELECT id, category, subtype, title, role, hours, date_from, date_to, proof_url
               FROM student_activities WHERE account_id = ?`;
    if (cat) { sql += " AND category = ?"; params.push(cat); }
    sql += " ORDER BY date_from DESC, id DESC";
    const [rows] = await pool.query(sql, params);
    res.json({ items: rows });
  } catch (e) {
    console.error("GET /activities error", e);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/activities", async (req, res) => {
  const { account_id, category, subtype, title, role, hours, date_from, date_to, proof_url } = req.body || {};
  if (!account_id || !category || !title)
    return res.status(400).json({ message: "account_id, category, title required" });
  try {
    await pool.query(
      `INSERT INTO student_activities
       (account_id, category, subtype, title, role, hours, date_from, date_to, proof_url)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [account_id, category, subtype ?? null, title, role ?? null, hours ?? null,
       date_from ?? null, date_to ?? null, proof_url ?? null]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /activities error", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* -------------------------------------------
 * 7) สรุปคะแนนด้านวิชาการ (GPA + Core)
 * -----------------------------------------*/
router.post("/recalculate/:accountId", async (req, res) => {
  const accountId = Number(req.params.accountId || 0);
  const yearLevel = Number(req.query.year || 0);
  const semester = Number(req.query.sem || 0);
  if (!accountId || !yearLevel || !semester)
    return res.status(400).json({ message: "accountId, year, sem required" });
  try {
    const [[acct]] = await pool.query(
      `SELECT id, major_id, manual_gpa FROM accounts WHERE id=?`,
      [accountId]
    );
    if (!acct) return res.status(404).json({ message: "account not found" });

    const computed_gpa = await computeGPA(accountId);
    const gpaUsed = (acct.manual_gpa != null)
      ? Math.max(Number(acct.manual_gpa), computed_gpa ?? 0)
      : (computed_gpa ?? null);
    const score_gpa = scoreFromGPA(gpaUsed);

    const pct = await computeCoreCompletionPct(accountId, acct.major_id, yearLevel, semester);
    const score_core = Math.round(Math.min(1, pct / 100) * 15 * 100) / 100;
    const score_academic = Math.round((score_gpa + score_core) * 100) / 100;

    res.json({
      account_id: accountId,
      year_level: yearLevel,
      semester,
      manual_gpa: acct.manual_gpa ?? null,
      computed_gpa,
      gpa_used: gpaUsed,
      score_gpa,
      core_completion_pct: pct,
      score_core,
      score_academic,
    });
  } catch (e) {
    console.error("POST /recalculate error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Training list
router.get("/tech/trainings/:accountId", async (req, res) => {
  const accountId = Number(req.params.accountId || 0);
  if (!accountId) return res.status(400).json({ message: "invalid accountId" });
  try {
    const [rows] = await pool.query(
      `SELECT st.id, t.title, t.provider, t.hours, st.taken_at, st.proof_url
       FROM student_trainings st
       JOIN trainings t ON t.id = st.training_id
       WHERE st.account_id=? 
       ORDER BY st.taken_at DESC, t.title`,
      [accountId]
    );
    res.json({ items: rows });
  } catch (e) {
    // ถ้า table ยังไม่มี ให้ตอบลิสต์ว่างแทน (กันพังช่วง dev)
    if (e?.code === "ER_NO_SUCH_TABLE" || e?.sqlState === "42S02") {
      return res.json({ items: [] });
    }
    console.error("GET /tech/trainings error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ เพิ่ม training
router.post("/tech/trainings", async (req, res) => {
  const { account_id, training_id, taken_at, proof_url } = req.body || {};
  if (!account_id || !training_id) {
    return res.status(400).json({ message: "account_id, training_id required" });
  }
  try {
    await pool.query(
      `INSERT INTO student_trainings (account_id, training_id, taken_at, proof_url)
       VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE taken_at=VALUES(taken_at), proof_url=VALUES(proof_url)`,
      [account_id, training_id, taken_at ?? null, proof_url ?? null]
    );
    res.json({ ok: true });
  } catch (e) {
    if (e?.code === "ER_NO_SUCH_TABLE" || e?.sqlState === "42S02") {
      return res.status(400).json({ message: "table trainings/student_trainings not found" });
    }
    console.error("POST /tech/trainings error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/competency/activities/:id   (แก้ไขกิจกรรม)
router.put("/activities/:id", async (req, res) => {
  const id = Number(req.params.id || 0);
  const {
    account_id, // ป้องกันแก้ของคนอื่น — ต้องส่งมาด้วย
    category, subtype, title, role, hours, date_from, date_to, proof_url,
  } = req.body || {};
  if (!id || !account_id || !title) {
    return res.status(400).json({ message: "id, account_id, title required" });
  }
  try {
    const [r] = await pool.query(
      `UPDATE student_activities
         SET category=?, subtype=?, title=?, role=?, hours=?, date_from=?, date_to=?, proof_url=?
       WHERE id=? AND account_id=?`,
      [
        category ?? null, subtype ?? null, title, role ?? null,
        hours ?? null, date_from ?? null, date_to ?? null, proof_url ?? null,
        id, account_id
      ]
    );
    if (r.affectedRows === 0) return res.status(404).json({ message: "activity not found" });
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /activities/:id error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/competency/activities/:id   (ลบกิจกรรม)
router.delete("/activities/:id", async (req, res) => {
  const id = Number(req.params.id || 0);
  const account_id = Number(req.query.account_id || 0); // กันลบข้ามบัญชี
  if (!id || !account_id) {
    return res.status(400).json({ message: "id and account_id required" });
  }
  try {
    const [r] = await pool.query(
      `DELETE FROM student_activities WHERE id=? AND account_id=?`,
      [id, account_id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ message: "activity not found" });
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /activities/:id error", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
