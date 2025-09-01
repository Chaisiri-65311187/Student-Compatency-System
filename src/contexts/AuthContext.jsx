import React, { createContext, useState, useContext } from 'react';

// สร้าง Context
const AuthContext = createContext();

// ใช้ hook เพื่อให้คอมโพเนนต์อื่น ๆ สามารถเข้าถึงข้อมูลจาก Context
export const useAuth = () => useContext(AuthContext);

// ข้อมูลผู้ใช้ (Mock data)
const getUserDetails = (username) => {
  const userDetails = {
    '65311187': { name: 'ชัยศิริ ไกยสิทธิ์', role: 'student', department: 'เทคโนโลยีสารสนเทศ' },
    '65313655': { name: 'ภราดร วรรณทิพย์', role: 'student', department: 'เทคโนโลยีสารสนเทศ' },
    'teacher1': { name: 'อาจารย์ตัวอย่าง', role: 'teacher' },
    'admin1': { name: 'ผู้ดูแลระบบ', role: 'admin' },
  };
  return userDetails[username] || { name: username, role: 'guest' };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // เก็บข้อมูลผู้ใช้หลังล็อกอิน

  // ฟังก์ชัน login
  const login = (userData) => {
    const userDetails = getUserDetails(userData.username); // ดึงข้อมูลผู้ใช้จาก mock data
    setUser({ ...userData, ...userDetails }); // เก็บข้อมูลผู้ใช้ที่ล็อกอิน
  };

  // ฟังก์ชัน logout
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
