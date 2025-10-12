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
