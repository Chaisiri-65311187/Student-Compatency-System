// src/services/announcementsApi.js
const API = (import.meta.env.VITE_API_BASE || "http://localhost:3000").replace(
  /\/+$/,
  ""
);

async function jfetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(opts.headers || {}),
    },
    credentials: "include",
    ...opts,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.message || res.statusText || "Request failed");
  }
  return data;
}

/* ---------- Listing / CRUD ---------- */
export const listAnnouncements = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") qs.append(k, v);
  });
  const q = qs.toString();
  return jfetch(`/api/announcements${q ? `?${q}` : ""}`);
};

// ของอาจารย์ (กรองด้วย teacher_id)
export const listMyAnnouncements = (teacherId) =>
  listAnnouncements({ teacher_id: teacherId });

export const getAnnouncement = (id) => jfetch(`/api/announcements/${id}`);
// alias เผื่อหน้าอื่นเรียกชื่อเก่า
export const getAnnouncementById = (id) => getAnnouncement(id);

export const createAnnouncement = (payload) =>
  jfetch(`/api/announcements`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateAnnouncement = (id, payload) =>
  jfetch(`/api/announcements/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

// ✅ ลบผ่าน query แทน body (บาง proxy จะบล็อก DELETE body)
export const deleteAnnouncement = (id, teacherId) =>
  jfetch(`/api/announcements/${id}?teacher_id=${teacherId}`, {
    method: "DELETE",
  });

/* ---------- Student apply / withdraw ---------- */
export const listMyApplications = (studentId) =>
  jfetch(`/api/announcements/my-applications?student_id=${studentId}`);

export const applyAnnouncement = (announcementId, studentId, note) =>
  jfetch(`/api/announcements/${announcementId}/apply`, {
    method: "POST",
    body: JSON.stringify({ student_id: studentId, note }),
  });

export const withdrawApplication = (announcementId, studentId) =>
  jfetch(`/api/announcements/${announcementId}/apply`, {
    method: "DELETE",
    body: JSON.stringify({ student_id: studentId }),
  });

/* ---------- Teacher view/approve applicants ---------- */
export const listApplicants = (announcementId) =>
  jfetch(`/api/announcements/${announcementId}/applications`);

export const changeApplicationStatus = (announcementId, appId, action) =>
  jfetch(`/api/announcements/${announcementId}/applications/${appId}`, {
    method: "PATCH",
    body: JSON.stringify({ action }), // 'accept' | 'reject'
  });
