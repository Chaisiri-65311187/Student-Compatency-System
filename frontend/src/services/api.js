// src/services/api.js

// ✅ Base URL
const API_BASE = (import.meta.env?.VITE_API_BASE || "http://localhost:3000").replace(/\/+$/, "");

// ----- helper -----
function url(path) {
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
    return await jsonFetch(url("/api/majors/list"));
  } catch {
    return [];
  }
}

// ----- announcements -----
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

// ===== Profile/Account APIs =====
export async function getAccountById(id) {
  return jsonFetch(url(`/api/accounts/${id}`));
}

export async function updateAccount(id, payload) {
  return jsonFetch(url(`/api/accounts/${id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function uploadAvatar(accountId, file) {
  const fd = new FormData();
  fd.append("avatar", file); // ✅ ฟิลด์ต้องชื่อ 'avatar'

  const res = await fetch(`${API_BASE}/api/accounts/${accountId}/avatar`, {
    method: "POST",
    body: fd,
    credentials: "include",
  });

  if (!res.ok) throw new Error(await res.text().catch(() => "Upload failed"));
  return res.json();
}
