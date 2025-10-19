// routes/peer.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

/* ----------------- helpers ----------------- */
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const pick = (req, keys) => {
  for (const k of keys) {
    if (req.params?.[k] != null && String(req.params[k]).trim() !== "") return req.params[k];
    if (req.query?.[k]  != null && String(req.query[k]).trim()  !== "") return req.query[k];
    if (req.body?.[k]   != null && String(req.body[k]).trim()   !== "") return req.body[k];
  }
  return null;
};
const emptyReceived = (period_key = null) => ({
  items: [],
  summary: {
    count: 0,
    avg: { communication: 0, teamwork: 0, responsibility: 0, cooperation: 0, adaptability: 0 },
    period_key
  }
});
const emptyGiven = (period_key = null) => ({ items: [], summary: { count: 0, period_key } });
const emptySelf  = (period_key = null) => ({ avg: 0, summary: { self_avg: 0, period_key } });

const avgFive = (obj) => {
  const v = [
    Number(obj.communication || 0),
    Number(obj.teamwork || 0),
    Number(obj.responsibility || 0),
    Number(obj.cooperation || 0),
    Number(obj.adaptability || 0),
  ];
  const s = v.reduce((a,b)=>a+b,0);
  return Math.round((s / 5) * 100) / 100;
};

/* ----------------- health ----------------- */
router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "peer", ts: new Date().toISOString() });
});
router.get("/ping", (_req, res) => res.json({ ok: true, ts: Date.now() }));
router.get("/", (_req, res) => {
  res.json({
    ok: true,
    endpoints: [
      "GET /health", "GET /ping",
      "POST /",
      "POST /self",
      "GET /received  | /:id/received  | /received/:id",
      "GET /given     | /:id/given     | /given/:id",
      "GET /self      | /:id/self      | /self/:id",
      "GET /summary?type=received|given|self&id=&period_key="
    ]
  });
});

/* ----------------- create / upsert ----------------- */
/**
 * ใช้ตารางเดียว peer_evaluations สำหรับทั้ง peer และ self
 * - peer: rater_id != ratee_id, is_self=0
 * - self: rater_id == ratee_id, is_self=1
 */
router.post("/", async (req, res) => {
  try {
    const period_key = pick(req, ["period_key","period"]);
    const rater_id   = toNum(pick(req, ["rater_id","rater","from_id","from"]));
    const ratee_id   = toNum(pick(req, ["ratee_id","ratee","to_id","to"]));
    const major_id   = toNum(pick(req, ["major_id","major"]));
    const year_level = toNum(pick(req, ["year_level","year"]));
    const {
      communication = 0, teamwork = 0, responsibility = 0, cooperation = 0, adaptability = 0, comment = null
    } = req.body || {};

    if (!period_key || !rater_id || !ratee_id) {
      return res.json({ ok: false, reason: "invalid-payload" });
    }

    const is_self = rater_id === ratee_id ? 1 : 0;

    await pool.query(
      `INSERT INTO peer_evaluations
       (period_key, rater_id, ratee_id, major_id, year_level,
        communication, teamwork, responsibility, cooperation, adaptability, is_self, comment)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
        major_id=VALUES(major_id),
        year_level=VALUES(year_level),
        communication=VALUES(communication),
        teamwork=VALUES(teamwork),
        responsibility=VALUES(responsibility),
        cooperation=VALUES(cooperation),
        adaptability=VALUES(adaptability),
        is_self=VALUES(is_self),
        comment=VALUES(comment)`,
      [period_key, rater_id, ratee_id, major_id, year_level,
       communication, teamwork, responsibility, cooperation, adaptability, is_self, comment]
    );
    res.json({ ok: true, is_self });
  } catch (e) {
    console.error("POST /peer error", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------- self-only endpoint (upsert แยกก็ได้) ---------- */
router.post("/self", async (req, res) => {
  try {
    const period_key = pick(req, ["period_key","period"]);
    const user_id    = toNum(pick(req, ["user_id","id","ratee_id","rater_id"]));
    const major_id   = toNum(pick(req, ["major_id","major"]));
    const year_level = toNum(pick(req, ["year_level","year"]));
    const {
      communication = 0, teamwork = 0, responsibility = 0, cooperation = 0, adaptability = 0, comment = null
    } = req.body || {};

    if (!period_key || !user_id) {
      return res.json({ ok: false, reason: "invalid-payload" });
    }

    await pool.query(
      `INSERT INTO peer_evaluations
       (period_key, rater_id, ratee_id, major_id, year_level,
        communication, teamwork, responsibility, cooperation, adaptability, is_self, comment)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
        major_id=VALUES(major_id),
        year_level=VALUES(year_level),
        communication=VALUES(communication),
        teamwork=VALUES(teamwork),
        responsibility=VALUES(responsibility),
        cooperation=VALUES(cooperation),
        adaptability=VALUES(adaptability),
        is_self=VALUES(is_self),
        comment=VALUES(comment)`,
      [period_key, user_id, user_id, major_id, year_level,
       communication, teamwork, responsibility, cooperation, adaptability, 1, comment]
    );
    res.json({ ok: true, is_self: 1 });
  } catch (e) {
    console.error("POST /peer/self error", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ----------------- received (aliases) ----------------- */
/**
 * /received: เฉลี่ยคะแนน “ที่เพื่อนให้เรา” (ไม่นับ self)
 * query: ratee_id|id|user_id, period_key, (optional) include_self=0/1
 */
router.get(["/received", "/:id/received", "/received/:id"], async (req, res) => {
  try {
    const ratee_id    = toNum(pick(req, ["ratee_id","id","user_id"]));
    const period_key  = pick(req, ["period_key","period"]);
    const includeSelf = String(pick(req, ["include_self"]) ?? "0") === "1";
    if (!ratee_id || !period_key) return res.json(emptyReceived(period_key));

    const sql = `
      SELECT communication, teamwork, responsibility, cooperation, adaptability, comment, is_self
      FROM peer_evaluations
      WHERE ratee_id=? AND period_key=? ${includeSelf ? "" : "AND is_self=0"}
    `;
    const [rows] = await pool.query(sql, [ratee_id, period_key]);

    const n = rows.length;
    const avg = (k) => n ? Math.round((rows.reduce((s, r) => s + (Number(r[k]) || 0), 0) / n) * 100) / 100 : 0;

    res.json({
      items: rows,
      summary: {
        count: n,
        avg: {
          communication:  avg("communication"),
          teamwork:       avg("teamwork"),
          responsibility: avg("responsibility"),
          cooperation:    avg("cooperation"),
          adaptability:   avg("adaptability"),
        },
        period_key
      }
    });
  } catch (e) {
    console.error("GET /peer/received error", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ----------------- given (aliases) ----------------- */
/**
 * /given: รายการ “ที่เราให้คนอื่น” (ดีฟอลต์ไม่นับ self)
 * query: rater_id|id|user_id, period_key, (optional) include_self=0/1
 */
router.get(["/given", "/:id/given", "/given/:id"], async (req, res) => {
  try {
    const rater_id    = toNum(pick(req, ["rater_id","id","user_id"]));
    const period_key  = pick(req, ["period_key","period"]);
    const includeSelf = String(pick(req, ["include_self"]) ?? "0") === "1";
    if (!rater_id || !period_key) return res.json(emptyGiven(period_key));

    const sql = `
      SELECT pe.*, a.full_name AS ratee_name, a.username AS ratee_username
      FROM peer_evaluations pe
      JOIN accounts a ON a.id=pe.ratee_id
      WHERE pe.rater_id=? AND pe.period_key=? ${includeSelf ? "" : "AND pe.is_self=0"}
      ORDER BY a.full_name
    `;
    const [rows] = await pool.query(sql, [rater_id, period_key]);
    res.json({ items: rows, summary: { count: rows.length, period_key } });
  } catch (e) {
    console.error("GET /peer/given error", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ----------------- self (aliases) ----------------- */
/**
 * /self: ค่าเฉลี่ย self-evaluation จากแถวที่ rater_id=ratee_id และ is_self=1
 */
router.get(["/self", "/:id/self", "/self/:id"], async (req, res) => {
  try {
    const user_id    = toNum(pick(req, ["user_id","id","ratee_id","rater_id"]));
    const period_key = pick(req, ["period_key","period"]);
    if (!user_id || !period_key) return res.json(emptySelf(period_key));

    const [rows] = await pool.query(
      `SELECT communication, teamwork, responsibility, cooperation, adaptability
       FROM peer_evaluations
       WHERE rater_id=? AND ratee_id=? AND period_key=? AND is_self=1`,
      [user_id, user_id, period_key]
    );

    let avg = 0;
    if (rows.length) {
      const sum = rows.reduce((acc, r) => acc + avgFive(r), 0);
      avg = Math.round((sum / rows.length) * 100) / 100;
    }
    res.json({ avg, summary: { self_avg: avg, period_key } });
  } catch (e) {
    console.error("GET /peer/self error", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ----------------- classmates (คงเดิม) ----------------- */
router.get("/classmates", async (req, res) => {
  try {
    const major_id   = toNum(pick(req, ["major_id","major"]));
    const year_level = toNum(pick(req, ["year_level","year"]));
    const exclude_id = toNum(pick(req, ["exclude_id","exclude","id_exclude"])) || 0;
    if (!major_id || !year_level) return res.json({ items: [] });

    const [rows] = await pool.query(
      `SELECT id, username, full_name, avatar_url
       FROM accounts
       WHERE role='student' AND major_id=? AND year_level=? AND id<>?
       ORDER BY full_name`,
      [major_id, year_level, exclude_id]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error("GET /peer/classmates error", e);
    res.status(500).json({ message: "Server error" });
  }
});

/* ----------------- summary (รวม endpoint ที่ front เรียก) ----------------- */
// /summary?type=received|given|self&id=&period_key=&include_self=0|1
router.get("/summary", async (req, res) => {
  try {
    const type       = String(pick(req, ["type","kind"]) || "").toLowerCase();
    const id         = toNum(pick(req, ["id","user_id","ratee_id","rater_id"]));
    const period_key = pick(req, ["period_key","period"]);
    const includeSelf = String(pick(req, ["include_self"]) ?? "0"); // ส่งต่อไปยัง received/given
    if (!type || !id || !period_key) {
      return res.json({ type, ok: true, empty: true, period_key, items: [] });
    }

    if (type === "received") {
      req.query.ratee_id = id;
      req.query.period_key = period_key;
      req.query.include_self = includeSelf;
      // delegate
      return router.handle({ ...req, url: "/received" }, res, () => {});
    }
    if (type === "given") {
      req.query.rater_id = id;
      req.query.period_key = period_key;
      req.query.include_self = includeSelf;
      return router.handle({ ...req, url: "/given" }, res, () => {});
    }
    if (type === "self") {
      req.query.user_id = id;
      req.query.period_key = period_key;
      return router.handle({ ...req, url: "/self" }, res, () => {});
    }
    return res.json({ ok: true, empty: true, reason: "unknown-type", period_key });
  } catch (e) {
    console.error("GET /peer/summary error", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
