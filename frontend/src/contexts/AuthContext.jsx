// src/contexts/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from "react";
import { loginUser } from "../services/api";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // ✅ โหลดสถานะผู้ใช้จาก sessionStorage (ยังอยู่หลัง F5, หายเมื่อปิดแท็บโดยอัตโนมัติ)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("user");
      if (saved) setUser(JSON.parse(saved));
    } catch {
      sessionStorage.removeItem("user");
    }
  }, []);

  // ✅ login → เก็บใน sessionStorage
  const login = async (username, password) => {
    const res = await loginUser(username.trim(), password);
    if (res?.user) {
      setUser(res.user);
      sessionStorage.setItem("user", JSON.stringify(res.user));
      return res.user;
    }
    return null;
  };

  // ✅ logout → ล้าง sessionStorage + แจ้ง backend ตามปกติ
  const logout = () => {
    setUser(null);
    sessionStorage.removeItem("user");
    try {
      fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch {}
  };

  // ❌ อย่าใช้ beforeunload/pagehide เคลียร์ user
  //    เพราะมันจะทำงานตอนรีเฟรชด้วย ทำให้เด้งออก
  //    sessionStorage จะหายเองเมื่อปิดแท็บ/ปิดเบราว์เซอร์ ไม่ต้องจัดการเพิ่ม

  // 🧩 (ออปชัน) ซิงก์การล็อกเอาท์ข้ามแท็บ:
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "logout_all_tabs" && e.newValue) {
        setUser(null);
        sessionStorage.removeItem("user");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // เวลา logout ให้ปล่อยสัญญาณไปยังแท็บอื่น (ถ้าเปิดหลายแท็บ)
  const logoutAllTabs = () => {
    logout();
    try {
      localStorage.setItem("logout_all_tabs", Date.now().toString());
      // เคลียร์คีย์เพื่อไม่ทิ้งขยะ
      setTimeout(() => localStorage.removeItem("logout_all_tabs"), 0);
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, logoutAllTabs }}>
      {children}
    </AuthContext.Provider>
  );
};
