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
  if (!res.ok) throw new Error(data?.message || `Request failed: ${res.status}`);
  return data;
}
const url = (p) => `${API_BASE}${p.startsWith("/") ? p : `/${p}`}`;

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
