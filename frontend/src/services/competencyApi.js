// frontend/src/services/competencyApi.js

// ถ้าตั้ง VITE_API_BASE ใน .env (ฝั่ง frontend) จะใช้ค่านั้น
// ไม่งั้น fallback ไป http://localhost:3000 (ตาม .env backend)
const API_BASE_RAW = import.meta.env?.VITE_API_BASE || "http://localhost:3000";
const API_BASE = API_BASE_RAW.replace(/\/+$/, ""); // ตัด / ท้ายสุดออก

function withJson(init = {}) {
  // เติม JSON header เมื่อมี body
  const hasBody = init && "body" in init;
  return {
    ...init,
    headers: {
      Accept: "application/json",
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  };
}

async function jsonFetch(input, init = {}) {
  const res = await fetch(input, withJson(init));
  const status = res.status;

  // 204 No Content → คืน null ทันที
  if (status === 204) return null;

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // กรณี backend ส่งไม่ใช่ JSON (กัน UI แตก)
      data = { raw: text };
    }
  }

  // อย่ากลบ 404 เป็น null — โยน error ออกไปให้รู้ว่า route ไม่มี
  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) ||
      `Request failed: ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const url = (p) => `${API_BASE}${p.startsWith("/") ? p : `/${p}`}`;

/* ================= Profile ================= */
export const getCompetencyProfile = (accountId) =>
  jsonFetch(url(`/api/competency/profile/${accountId}`));

export const updateCompetencyProfile = (accountId, payload) =>
  jsonFetch(url(`/api/competency/profile/${accountId}`), {
    method: "PUT",
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
  if (major != null && major !== "") qs.set("major", major);
  if (y != null && y !== "") qs.set("year", y);
  if (s != null && s !== "") qs.set("sem", s);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return jsonFetch(url(`/api/competency/courses/required${suffix}`));
}

/** ดึงเกรดที่บันทึกไว้ (ใช้ prefill ฟอร์ม หรือดูผลลัพธ์) */
export const getSavedGrades = (accountId, { year, sem } = {}) => {
  const q = new URLSearchParams();
  if (year != null && year !== "") q.set("year", year);
  if (sem != null && sem !== "") q.set("sem", sem);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return jsonFetch(url(`/api/competency/courses/grades/${accountId}${suffix}`));
};

/** alias ให้เรียกแบบเดิม */
export function listCourseGrades(accountId, opts = {}) {
  return getSavedGrades(accountId, opts);
}

/** บันทึกเกรดหลายวิชา (bulk) */
export const saveCourseGrades = ({ account_id, items }) =>
  jsonFetch(url(`/api/competency/courses/grades/bulk`), {
    method: "POST",
    body: JSON.stringify({ account_id, items }),
  });

/** คำนวณคะแนนด้านวิชาการ (GPA+Core) */
export const recalcAcademic = (accountId, { year, sem } = {}) => {
  const qs = new URLSearchParams();
  if (year != null && year !== "") qs.set("year", year);
  if (sem != null && sem !== "") qs.set("sem", sem);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return jsonFetch(url(`/api/competency/recalculate/${accountId}${suffix}`), {
    method: "POST",
  });
};

/* ================= Language ================= */

/** ล่าสุด (ทั้งหมดหรือระบุตัว framework: CEPT/ICT/ITPE) */
export const getLatestLanguage = (accountId, framework) => {
  const qs = framework ? `?framework=${encodeURIComponent(framework)}` : "";
  return jsonFetch(url(`/api/competency/language/latest/${accountId}${qs}`));
};

export const getLatestLanguageByFramework = (accountId, framework) =>
  getLatestLanguage(accountId, framework);

export const getLatestLanguagesAll = (accountId) =>
  jsonFetch(url(`/api/competency/language/latest-all/${accountId}`));

/** บันทึกภาษา — backend ใช้ POST /api/competency/language (UPSERT) */
export async function saveLanguage(payload) {
  return jsonFetch(url(`/api/competency/language`), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ================= Tech (certs/trainings) ================= */
export const listTechCerts = (accountId) =>
  jsonFetch(url(`/api/competency/tech/certs/${accountId}`));

export const addTechCert = (payload) =>
  jsonFetch(url(`/api/competency/tech/certs`), {
    method: "POST",
    body: JSON.stringify(payload),
  });

/**
 * ดึง trainings ที่บันทึกไว้
 * - ถ้า backend ไม่มี route จริง ๆ (404) เราคืนรูปแบบ {items: []} ให้ UI ไม่พัง
 */
export const listTrainings = async (accountId) => {
  try {
    return await jsonFetch(url(`/api/competency/tech/trainings/${accountId}`));
  } catch (e) {
    if (e?.status === 404) return { items: [] }; // กัน null
    throw e;
  }
};

export const addTraining = (payload) =>
  jsonFetch(url(`/api/competency/tech/trainings`), {
    method: "POST",
    body: JSON.stringify(payload),
  });

/* ================= Activities ================= */
export const listActivities = (accountId, cat) => {
  const qs = new URLSearchParams();
  if (cat != null && String(cat) !== "") qs.set("cat", cat);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return jsonFetch(url(`/api/competency/activities/${accountId}${suffix}`));
};

export const addActivity = (payload) =>
  jsonFetch(url(`/api/competency/activities`), {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateActivity = (id, payload) =>
  jsonFetch(url(`/api/competency/activities/${id}`), {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteActivity = (id, account_id) =>
  jsonFetch(url(`/api/competency/activities/${id}?account_id=${account_id}`), {
    method: "DELETE",
  });

/* ================= Peer Evaluation (fixed endpoints) ================= */
const FEATURE_PEER = String(import.meta.env?.VITE_FEATURE_PEER ?? "auto");
let PEER_SUPPORT = "unknown";

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

  // ✅ probe ถูกต้องตาม backend จริง
  const probes = [url("/api/competency/peer/health"), url("/api/competency/ping")];
  for (const p of probes) {
    try {
      const r = await fetch(p);
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

export const peer = {
  isAvailable: async () => ensurePeerAvailable(),

  // ✅ classmates
  classmates: async (major_id, year_level, exclude_id) => {
    const ok = await ensurePeerAvailable();
    if (!ok) return null;
    const qs = new URLSearchParams({
      major_id: String(major_id ?? ""),
      year_level: String(year_level ?? ""),
      exclude_id: String(exclude_id ?? ""),
    }).toString();
    const data = await jsonFetch(url(`/api/competency/peer/classmates?${qs}`));
    return Array.isArray(data?.users) ? data.users : [];
  },

  // ✅ submit evaluations
  submit: async (payload) => {
    const ok = await ensurePeerAvailable();
    if (!ok) return null;
    return jsonFetch(url(`/api/competency/peer/evaluations`), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ✅ average scores
  received: async (accountId, periodKey) => {
    const ok = await ensurePeerAvailable();
    if (!ok) return { avg: 0, count: 0 };
    const qs = periodKey ? `?period=${encodeURIComponent(periodKey)}` : "";
    return jsonFetch(url(`/api/competency/peer/received/${accountId}${qs}`));
  },

  self: async (accountId, periodKey) => {
    const ok = await ensurePeerAvailable();
    if (!ok) return { avg: 0 };
    const qs = periodKey ? `?period=${encodeURIComponent(periodKey)}` : "";
    return jsonFetch(url(`/api/competency/peer/self/${accountId}${qs}`));
  },

  // ✅ alias สำหรับโค้ดเดิม (เพิ่ม ensure ให้ด้วย)
  listClassmates: async ({ major_id, year_level, exclude_id = "" }) => {
    const ok = await ensurePeerAvailable();
    if (!ok) return [];
    const qs = new URLSearchParams({
      major_id,
      year_level,
      exclude_id,
    }).toString();
    const data = await jsonFetch(url(`/api/competency/peer/classmates?${qs}`));
    return Array.isArray(data?.users) ? data.users : [];
  },

  submitEvaluation: async (payload) => {
    const ok = await ensurePeerAvailable();
    if (!ok) return null;
    return jsonFetch(url(`/api/competency/peer/evaluations`), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  mySubmissions: async (evaluator_id, period) => {
    const ok = await ensurePeerAvailable();
    if (!ok) return { ratee_ids: [] };
    const qs = new URLSearchParams();
    if (evaluator_id != null && evaluator_id !== "") qs.set("evaluator_id", evaluator_id);
    if (period != null && period !== "") qs.set("period", period);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return jsonFetch(url(`/api/competency/peer/my-submissions${suffix}`));
  },
};
