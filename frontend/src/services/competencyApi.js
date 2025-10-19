// frontend/src/services/competencyApi.js

// ถ้าตั้ง VITE_API_BASE ใน .env (ฝั่ง frontend) จะใช้ค่านั้น
// ไม่งั้น fallback ไป http://localhost:3000 (ตาม .env backend)
const API_BASE_RAW = import.meta.env?.VITE_API_BASE || "http://localhost:3000";
const API_BASE = API_BASE_RAW.replace(/\/+$/, ""); // ตัด / ท้ายสุดออก

async function jsonFetch(input, init = {}) {
  const res = await fetch(input, {
    // credentials: "include", // เปิดถ้าต้องการส่งคุกกี้
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  // 404 -> คืน null เงียบ ๆ (หลีกเลี่ยง error noise บนคอนโซล)
  if (res.status === 404) return null;

  if (!res.ok) throw new Error(data?.message || `Request failed: ${res.status}`);
  return data;
}

const url = (p) => `${API_BASE}${p.startsWith("/") ? p : `/${p}`}`;

// ลองเรียง URL หลายแบบและคืนอันแรกที่ได้ผล (ไม่เป็น null)
async function firstOk(urls) {
  for (const u of urls) {
    const data = await jsonFetch(u).catch(() => null);
    if (data !== null && data !== undefined) return data;
  }
  return null;
}

/* ================= Profile ================= */
export const getCompetencyProfile = (accountId) =>
  jsonFetch(url(`/api/competency/profile/${accountId}`));

export const updateCompetencyProfile = (accountId, payload) =>
  jsonFetch(url(`/api/competency/profile/${accountId}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

/* ================= Academic / Courses ================= */

/**
 * รายวิชาบังคับ
 * รองรับ 2 รูปแบบการเรียก:
 *   getRequiredCourses({ major, year, sem })
 *   getRequiredCourses(majorId, year, sem)
 */
export function getRequiredCourses(arg1, year, sem) {
  let major, y, s;
  if (typeof arg1 === "object" && arg1 !== null) {
    major = arg1.major;
    y = arg1.year;
    s = arg1.sem;
  } else {
    major = arg1;
    y = year;
    s = sem;
  }
  const qs = new URLSearchParams();
  if (major != null) qs.set("major", major);
  if (y != null) qs.set("year", y);
  if (s != null) qs.set("sem", s);
  return jsonFetch(url(`/api/competency/courses/required?${qs.toString()}`));
}

/** ดึงเกรดที่บันทึกไว้ (ใช้ prefill ฟอร์ม หรือดูผลลัพธ์) */
export const getSavedGrades = (accountId, { year, sem } = {}) => {
  const q = new URLSearchParams();
  if (year != null) q.set("year", year);
  if (sem != null) q.set("sem", sem);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return jsonFetch(url(`/api/competency/courses/grades/${accountId}${suffix}`));
};

/**
 * alias ให้เรียกแบบที่หน้า StudentInfoPage ใช้
 * listCourseGrades(accountId, { year, sem })
 */
export function listCourseGrades(accountId, opts = {}) {
  return getSavedGrades(accountId, opts);
}

/** บันทึกเกรดหลายวิชา (bulk) */
export const saveCourseGrades = ({ account_id, items }) =>
  jsonFetch(url(`/api/competency/courses/grades/bulk`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account_id, items }),
  });

/** คำนวณคะแนนด้านวิชาการ (GPA+Core) ของปี/เทอมที่เลือก */
export const recalcAcademic = (accountId, { year, sem }) =>
  jsonFetch(
    url(`/api/competency/recalculate/${accountId}?year=${year}&sem=${sem}`),
    { method: "POST" }
  );

/* ================= Language ================= */
export const getLatestLanguage = (accountId) =>
  jsonFetch(url(`/api/competency/language/latest/${accountId}`));

export const getLatestLanguageByFramework = (accountId, framework) =>
  jsonFetch(
    url(
      `/api/competency/language/latest/${accountId}?framework=${encodeURIComponent(
        framework
      )}`
    )
  );

export const getLatestLanguagesAll = (accountId) =>
  jsonFetch(url(`/api/competency/language/latest-all/${accountId}`));

export const saveLanguage = (payload) =>
  jsonFetch(url(`/api/competency/language`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

/* ================= Tech (certs/trainings) ================= */
export const listTechCerts = (accountId) =>
  jsonFetch(url(`/api/competency/tech/certs/${accountId}`));

export const addTechCert = (payload) =>
  jsonFetch(url(`/api/competency/tech/certs`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const listTrainings = (accountId) =>
  jsonFetch(url(`/api/competency/tech/trainings/${accountId}`));

export const addTraining = (payload) =>
  jsonFetch(url(`/api/competency/tech/trainings`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

/* ================= Activities ================= */
export const listActivities = (accountId, cat) =>
  jsonFetch(
    url(
      `/api/competency/activities/${accountId}${
        cat ? `?cat=${encodeURIComponent(cat)}` : ""
      }`
    )
  );

export const addActivity = (payload) =>
  jsonFetch(url(`/api/competency/activities`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const updateActivity = (id, payload) =>
  jsonFetch(url(`/api/competency/activities/${id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const deleteActivity = (id, account_id) =>
  jsonFetch(url(`/api/competency/activities/${id}?account_id=${account_id}`), {
    method: "DELETE",
  });

/* =============== Peer (feature-flippable + normalize shape) ===============
   การตั้งค่า:
   - VITE_FEATURE_PEER=true  -> เปิดใช้งานแน่นอน
   - VITE_FEATURE_PEER=false -> ปิดแน่นอน (ไม่ยิง request)
   - ไม่ตั้ง/auto (ค่าเริ่มต้น) -> probe ครั้งแรก ถ้าไม่พบ endpoint จะปิดถาวร
*/
const FEATURE_PEER = String(import.meta.env?.VITE_FEATURE_PEER ?? "auto");
let PEER_SUPPORT = "unknown"; // "unknown" | "ok" | "none"

async function ensurePeerAvailable() {
  if (FEATURE_PEER === "false") {
    PEER_SUPPORT = "none";
    return false;
  }
  if (PEER_SUPPORT !== "unknown") return PEER_SUPPORT === "ok";
  if (FEATURE_PEER === "true") {
    PEER_SUPPORT = "ok";
    return true;
  }
  // auto: ลอง probe เบา ๆ แค่ครั้งแรก แล้วแคชผล
  const probes = [
    url("/api/peer/health"),
    url("/api/peer/ping"),
    url("/api/peer"),
  ];
  for (const p of probes) {
    try {
      const r = await fetch(p, { method: "GET" });
      if (r && r.ok) {
        PEER_SUPPORT = "ok";
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  PEER_SUPPORT = "none";
  return false;
}

/** ---------- Normalizers: ทำให้โครงตอบเหมือนกันเสมอ ---------- */
function normalizePeerReceived(resp, period_key) {
  // รูปแบบเป้าหมาย:
  // { items:[], avg:number, count:number, summary:{ peer_avg:number, peer_count:number, avg:{...dims}, count:number, period_key } }
  if (!resp || typeof resp !== "object") {
    return {
      items: [],
      avg: 0,
      count: 0,
      summary: {
        peer_avg: 0,
        peer_count: 0,
        avg: { communication: 0, teamwork: 0, responsibility: 0, cooperation: 0, adaptability: 0 },
        count: 0,
        period_key,
      },
    };
  }
  const items = Array.isArray(resp.items) ? resp.items : [];
  // เฉลี่ยรวมอาจอยู่ที่ resp.avg หรือ resp.summary.peer_avg หรือคำนวณเองจาก resp.summary.avg
  const dims = resp.summary?.avg;
  let avgOverall =
    Number(resp.avg ?? resp.summary?.peer_avg) ||
    (dims
      ? Math.round(
          (Number(dims.communication || 0) +
            Number(dims.teamwork || 0) +
            Number(dims.responsibility || 0) +
            Number(dims.cooperation || 0) +
            Number(dims.adaptability || 0)) / 5
        )
      : 0);

  const count =
    Number(resp.count ?? resp.summary?.count ?? items.length) || 0;

  return {
    items,
    avg: avgOverall,
    count,
    summary: {
      peer_avg: avgOverall,
      peer_count: count,
      avg: dims || {
        communication: 0,
        teamwork: 0,
        responsibility: 0,
        cooperation: 0,
        adaptability: 0,
      },
      count,
      period_key: resp.summary?.period_key ?? period_key,
    },
  };
}

function normalizePeerGiven(resp, period_key) {
  // เป้าหมาย: { items:[], count:number, summary:{ count:number, period_key } }
  if (!resp || typeof resp !== "object") {
    return { items: [], count: 0, summary: { count: 0, period_key } };
  }
  const items = Array.isArray(resp.items) ? resp.items : [];
  const count = Number(resp.count ?? resp.summary?.count ?? items.length) || 0;
  return {
    items,
    count,
    summary: { count, period_key: resp.summary?.period_key ?? period_key },
  };
}

function normalizePeerSelf(resp, period_key) {
  // เป้าหมาย: { avg:number, summary:{ self_avg:number, period_key } }
  if (!resp || typeof resp !== "object") {
    return { avg: 0, summary: { self_avg: 0, period_key } };
  }
  const avg = Number(resp.avg ?? resp.summary?.self_avg ?? 0) || 0;
  return { avg, summary: { self_avg: avg, period_key: resp.summary?.period_key ?? period_key } };
}

export const peer = {
  // สำหรับหน้าอื่น ๆ ที่อยากเช็คสถานะ
  isAvailable: async () => ensurePeerAvailable(),

  classmates: async (major_id, year_level, exclude_id) => {
    const ok = await ensurePeerAvailable();
    if (!ok) return null;
    const qs = new URLSearchParams({
      major_id: String(major_id ?? ""),
      year_level: String(year_level ?? ""),
      exclude_id: String(exclude_id ?? ""),
    }).toString();
    return jsonFetch(url(`/api/peer/classmates?${qs}`));
  },

  submit: async (payload) => {
    const ok = await ensurePeerAvailable();
    if (!ok) return null;
    return jsonFetch(url(`/api/peer`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  // จะลองหลายรูปแบบของ endpoint; หากไม่มีเลยจะได้ null (และไม่ error)
  given: async (id, period_key) => {
    const ok = await ensurePeerAvailable();
    if (!ok) return null;
    const raw = await firstOk([
      url(`/api/peer/given?id=${id}&period_key=${period_key}`),
      url(`/api/peer/${id}/given?period_key=${period_key}`),
      url(`/api/peer/summary?type=given&id=${id}&period_key=${period_key}`),
      url(`/api/peer/given?rater_id=${id}&period_key=${period_key}`), // legacy
    ]);
    return normalizePeerGiven(raw, period_key);
  },

  received: async (id, period_key) => {
    const ok = await ensurePeerAvailable();
    if (!ok) return null;
    const raw = await firstOk([
      url(`/api/peer/received?id=${id}&period_key=${period_key}`),
      url(`/api/peer/${id}/received?period_key=${period_key}`),
      url(`/api/peer/summary?type=received&id=${id}&period_key=${period_key}`),
      url(`/api/peer/received?ratee_id=${id}&period_key=${period_key}`), // legacy
    ]);
    return normalizePeerReceived(raw, period_key);
  },

  // เผื่ออนาคตมี /self
  self: async (id, period_key) => {
    const ok = await ensurePeerAvailable();
    if (!ok) return null;
    const raw = await firstOk([
      url(`/api/peer/self?id=${id}&period_key=${period_key}`),
      url(`/api/peer/${id}/self?period_key=${period_key}`),
      url(`/api/peer/summary?type=self&id=${id}&period_key=${period_key}`),
    ]);
    return normalizePeerSelf(raw, period_key);
  },
};
