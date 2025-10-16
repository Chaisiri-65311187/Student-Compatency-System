// src/services/api.js

// ✅ ใช้ .env ถ้ามี และตัดเครื่องหมาย / ท้ายออกให้เรียบ
const API_BASE_RAW = import.meta.env?.VITE_API_BASE || "";
const API_BASE = API_BASE_RAW.replace(/\/+$/, "");

// ----- helper -----
function url(path) {
  // รวม API_BASE + path โดยกัน // ซ้อน
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

async function jsonFetch(input, init = {}) {
  const res = await fetch(input, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || `Request failed: ${res.status}`);
  return data;
}

// ----- auth -----
export async function loginUser(username, password) {
  return jsonFetch(url("/api/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

// ----- users CRUD -----
export async function getUsers({ search = "", role = "", page = 1, limit = 10 } = {}) {
  const q = new URLSearchParams({ search, role, page, limit });
  return jsonFetch(url(`/api/users?${q.toString()}`));
}

export async function createUser(payload) {
  return jsonFetch(url("/api/users"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateUser(id, payload) {
  return jsonFetch(url(`/api/users/${id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(id) {
  return jsonFetch(url(`/api/users/${id}`), { method: "DELETE" });
}

export async function listMajors() {
  try {
    return await jsonFetch(url("/api/majors/list"));return await jsonFetch(url("/api/majors/list"));
  } catch {
    return [];
  }
}

// ----- announcements -----
// ✅ เหลือฟังก์ชันเดียวเท่านั้น (แก้ duplicate)
export async function listAnnouncements(q = {}) {
  const params = new URLSearchParams();
  if (q.status) params.set("status", q.status);
  if (q.year) params.set("year", q.year);
  if (q.department) params.set("department", q.department);
  if (q.search) params.set("search", q.search);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return jsonFetch(url(`/api/announcements${qs}`));
}

export async function createAnnouncement(payload) {
  return jsonFetch(url("/api/announcements"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
