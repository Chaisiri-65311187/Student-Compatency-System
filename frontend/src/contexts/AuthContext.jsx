// src/contexts/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from "react";
import { loginUser } from "../services/api"; // ฟังก์ชันเรียก backend (เราจะทำต่อให้ข้างล่าง)

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // ✅ โหลดสถานะผู้ใช้จาก localStorage (กันหลุดหลังรีเฟรช)
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  // ✅ ฟังก์ชัน login (เชื่อม backend)
  const login = async (username, password) => {
    try {
      const res = await loginUser(username.trim(), password);
      if (res && res.user) {
        setUser(res.user);
        localStorage.setItem("user", JSON.stringify(res.user));
        return res.user; // ✅ ส่ง user กลับ ไม่ใช่ boolean
      }
      return null;
    } catch (err) {
      throw err; // ให้โยน error ออกไป เพื่อให้หน้า Login จับข้อความได้
    }
  };

  // ✅ logout
  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
