// src/services/announcementsApi.js
const API = (import.meta.env.VITE_API_BASE || "http://localhost:3000").replace(/\/+$/, "");

async function jfetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...opts,
  });
  if (!res.ok) {
    let msg = "";
    try { msg = await res.text(); } catch {}
    throw new Error(msg || res.statusText);
  }
  try { return await res.json(); } catch { return {}; }
}

export const listAnnouncements = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== "") qs.append(k, v);
  });
  const q = qs.toString();
  return jfetch(`/api/announcements${q ? `?${q}` : ""}`);
};

export const listMyAnnouncements = (teacherId) =>
  listAnnouncements({ teacher_id: teacherId });

export const getAnnouncement = (id) =>
  jfetch(`/api/announcements/${id}`);

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

/** ✅ ลบประกาศ (แนบ teacher_id ใน body) */
export async function deleteAnnouncement(id, teacherId) {
  if (!teacherId) throw new Error("Missing teacher_id");
  return jfetch(`/api/announcements/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ teacher_id: teacherId }),
  });
}
