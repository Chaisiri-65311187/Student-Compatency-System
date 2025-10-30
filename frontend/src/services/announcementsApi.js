// src/services/announcementsApi.js

/* ====================== Base & helpers ====================== */
const API_BASE = (import.meta.env?.VITE_API_BASE || "http://localhost:3000").replace(/\/+$/, "");

/** Build URL with query params safely */
function buildUrl(path, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") qs.append(k, v);
  });
  const q = qs.toString();
  return `${API_BASE}${path}${q ? `?${q}` : ""}`;
}

/** JSON fetch with consistent error handling */
async function jsonFetch(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    // ถ้า backend ใช้ cookie session ให้ปลดคอมเมนต์ได้
    // credentials: "include",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.message || res.statusText || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/* ====================== Announcements (Public/Teacher) ====================== */

/** รายการประกาศ (รองรับ params เช่น status, teacher_id, q, page, limit ฯลฯ) */
export async function listAnnouncements(params = {}) {
  const data = await jsonFetch(buildUrl("/api/announcements", params));
  // normalize ให้เป็น array เสมอ
  return Array.isArray(data) ? data : data.items || data.rows || [];
}

/** รายการประกาศของอาจารย์ (กรองด้วย teacher_id) */
export function listMyAnnouncements(teacherId) {
  return listAnnouncements({ teacher_id: teacherId });
}

/** อ่านประกาศเดียว */
export function getAnnouncement(id) {
  return jsonFetch(buildUrl(`/api/announcements/${id}`));
}
// alias เผื่อบางหน้ามีชื่อนี้อยู่แล้ว
export const getAnnouncementById = getAnnouncement;

/** สร้างประกาศ */
export function createAnnouncement(payload) {
  return jsonFetch(buildUrl("/api/announcements"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** แก้ไขประกาศ */
export function updateAnnouncement(id, payload) {
  return jsonFetch(buildUrl(`/api/announcements/${id}`), {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** ลบประกาศ
 * หมายเหตุ: ใช้ teacher_id ผ่าน query (เลี่ยง DELETE body ที่บาง proxy บล็อก)
 */
export function deleteAnnouncement(id, teacherId) {
  return jsonFetch(buildUrl(`/api/announcements/${id}`, { teacher_id: teacherId }), {
    method: "DELETE",
  });
}

/* ====================== Student apply / withdraw ====================== */

/** รายการประกาศที่นิสิตสมัครไว้ */
export async function listMyApplications(studentId) {
  const url = `${API_BASE}/api/announcements/my-applications?student_id=${encodeURIComponent(studentId)}`;
  const data = await jsonFetch(url);
  const items = Array.isArray(data) ? data : data.items || [];
  return items.map(x => ({
    id: x.application_id ?? x.id,
    announcement_id: x.announcement_id,
    status: x.status, // <-- ต้องมี completed เมื่ออาจารย์กดเสร็จสิ้น
    updated_at: x.updated_at,
    approved_at: x.approved_at,
    created_at: x.created_at,
  }));
}

/** นิสิตกดสมัครประกาศ */
export function applyAnnouncement(announcementId, studentId, note) {
  return jsonFetch(buildUrl(`/api/announcements/${announcementId}/apply`), {
    method: "POST",
    body: JSON.stringify({ student_id: studentId, note: note || null }),
  });
}

/** นิสิตถอนการสมัคร
 * หมายเหตุ: backend เดิมรองรับ DELETE พร้อม body → คงพฤติกรรมเดิมไว้
 */
export function withdrawApplication(announcementId, studentId) {
  return jsonFetch(buildUrl(`/api/announcements/${announcementId}/apply`), {
    method: "DELETE",
    body: JSON.stringify({ student_id: studentId }),
  });
}

/* ====================== Teacher: applicants & status ====================== */

/** ดึงรายชื่อผู้สมัครของประกาศ */
export async function listApplicants(announcementId) {
  const data = await jsonFetch(buildUrl(`/api/announcements/${announcementId}/applications`));
  return Array.isArray(data) ? data : data.items || [];
}

/** เปลี่ยนสถานะใบสมัคร (pending → accepted/rejected/completed) */
export function changeApplicationStatus(announcementId, appId, action, note) {
  return jsonFetch(buildUrl(`/api/announcements/${announcementId}/applications/${appId}`), {
    method: "PATCH",
    body: JSON.stringify({ action, note: note || null }),
  });
}
