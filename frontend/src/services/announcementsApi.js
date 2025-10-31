// src/services/announcementsApi.js

/* ====================== Base & helpers ====================== */
const API_BASE = (import.meta.env?.VITE_API_BASE || "http://localhost:3000").replace(/\/+$/, "");

function buildUrl(path, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") qs.append(k, v);
  });
  const q = qs.toString();
  return `${API_BASE}${path}${q ? `?${q}` : ""}`;
}

async function jsonFetch(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
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

export async function listAnnouncements(params = {}) {
  // backend ใช้ owner_id ไม่ใช่ teacher_id
  const fixed = { ...params };
  if (fixed.teacher_id && !fixed.owner_id) {
    fixed.owner_id = fixed.teacher_id;
    delete fixed.teacher_id;
  }
  const data = await jsonFetch(buildUrl("/api/announcements", fixed));
  return Array.isArray(data) ? data : data.items || data.rows || [];
}

export function listMyAnnouncements(ownerId) {
  return listAnnouncements({ owner_id: ownerId });
}

export function getAnnouncement(id) {
  return jsonFetch(buildUrl(`/api/announcements/${id}`));
}
export const getAnnouncementById = getAnnouncement;

export function createAnnouncement(payload) {
  return jsonFetch(buildUrl("/api/announcements"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAnnouncement(id, payload) {
  // backend ใช้ PATCH
  return jsonFetch(buildUrl(`/api/announcements/${id}`), {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/* ====================== Student apply / withdraw ====================== */

export async function listMyApplications(studentId) {
  const id = Number(studentId);
  const url = buildUrl("/api/announcements/my-applications", { student_id: id });
  const data = await jsonFetch(url);
  const items = Array.isArray(data) ? data : data.items || [];
  return items.map((x) => ({
    id: x.application_id ?? x.id,
    announcement_id: x.announcement_id,
    status: x.status,
    note: x.note ?? null,
    updated_at: x.updated_at,
    created_at: x.created_at,
    // บางหน้าต้องการชื่อประกาศ/อาจารย์ด้วย
    title: x.title,
    teacher: x.teacher,
    department: x.department,
    announce_status: x.announce_status,
    work_date: x.work_date,
    work_end: x.work_end,
  }));
}

export function applyAnnouncement(announcementId, studentId, note) {
  return jsonFetch(buildUrl(`/api/announcements/${announcementId}/apply`), {
    method: "POST",
    body: JSON.stringify({ student_id: studentId, note: note || null }),
  });
}

export function withdrawApplication(announcementId, studentId) {
  // backend ใช้ POST /:id/withdraw
  return jsonFetch(buildUrl(`/api/announcements/${announcementId}/withdraw`), {
    method: "POST",
    body: JSON.stringify({ student_id: studentId }),
  });
}

/* ====================== Teacher: applicants & status ====================== */

export async function listApplicants(announcementId) {
  // backend เป็น /:id/applicants
  const data = await jsonFetch(buildUrl(`/api/announcements/${announcementId}/applicants`));
  return Array.isArray(data) ? data : data.items || [];
}

export function changeApplicationStatus(appId, action, note) {
  // backend: POST /api/announcements/applications/:appId/accept|reject|complete
  const act = String(action).toLowerCase();
  if (!["accept", "reject", "complete"].includes(act)) {
    throw new Error("Invalid action");
  }
  return jsonFetch(buildUrl(`/api/announcements/applications/${appId}/${act}`), {
    method: "POST",
    body: JSON.stringify({ note: note || null }),
  });
}

/** ลบ/เก็บถาวรประกาศ (soft delete) */
export function deleteAnnouncement(id) {
  // ใช้ PATCH เปลี่ยนสถานะเป็น archived
  return jsonFetch(buildUrl(`/api/announcements/${id}`), {
    method: "PATCH",
    body: JSON.stringify({ status: "archived" }),
  });
}