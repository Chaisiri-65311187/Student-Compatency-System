// src/contexts/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from "react";
import { loginUser } from "../services/api"; // เรียก backend

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // ✅ โหลดสถานะผู้ใช้จาก sessionStorage (จะหายเมื่อปิดแท็บ/ปิดเบราว์เซอร์)
  useEffect(() => {
    const savedUser = sessionStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  // ✅ login
  const login = async (username, password) => {
    try {
      const res = await loginUser(username.trim(), password);
      if (res && res.user) {
        setUser(res.user);
        // ใช้ sessionStorage แทน localStorage
        sessionStorage.setItem("user", JSON.stringify(res.user));
        return res.user;
      }
      return null;
    } catch (err) {
      throw err;
    }
  };

  // ✅ logout
  const logout = () => {
    setUser(null);
    sessionStorage.removeItem("user");
    // (ถ้ามี cookie-based session ให้แจ้ง backend logout ด้วย)
    try {
      fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch {}
  };

  // ✅ เมื่อปิดแท็บ / ปิดเบราว์เซอร์ → ล้าง session อัตโนมัติ
  useEffect(() => {
    const handleUnload = () => {
      sessionStorage.removeItem("user");
      try {
        navigator.sendBeacon?.("/api/logout"); // แจ้ง backend แบบเบาๆ
      } catch {}
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
