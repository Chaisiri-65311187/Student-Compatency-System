// src/services/api.js

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:5000").replace(/\/+$/, "");

// ฟังก์ชัน fetch แบบรวม พร้อม log error
async function jsonFetch(url, init = {}) {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok) {
      // ⭐ แสดงข้อความจาก backend ชัดๆ
      const msg = data?.message || `Request failed: ${res.status}`;
      console.error("[API ERROR]", msg, "at", url);
      throw new Error(msg);
    }
    return data;
  } catch (err) {
    console.error("[FETCH FAILED]", err);
    throw err;
  }
}

// ฟังก์ชัน login (เรียก backend)
export async function loginUser(username, password) {
  // ⭐ trim กันพิมพ์ช่องว่างโดยไม่ได้ตั้งใจ
  username = String(username || "").trim();
  password = String(password || "").trim();

  return jsonFetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

// --- USERS CRUD ---
export async function getUsers({ search = "", role = "", page = 1, limit = 10 } = {}) {
  const q = new URLSearchParams({ search, role, page, limit });
  const res = await fetch(`${API_BASE}/api/users?` + q.toString());
  if (!res.ok) throw new Error("load users failed");
  return res.json(); // { total, rows }
}

export async function createUser(payload) {
  const res = await fetch(`${API_BASE}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { id }
}

export async function updateUser(id, payload) {
  const res = await fetch(`${API_BASE}/api/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteUser(id) {
  const res = await fetch(`${API_BASE}/api/users/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listMajors() {
  const res = await fetch(`${API_BASE}/api/users/majors/list`);
  if (!res.ok) return [];
  return res.json();
}

export async function listAnnouncements() {
  return jsonFetch(`${API_BASE}/api/announcements`);
}