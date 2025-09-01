import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // เก็บข้อมูลผู้ใช้หลังล็อกอิน

  const login = (userData) => {
    // Mock data ชื่อเต็มตามรหัส
    const userDetails = {
      '65311187': { name: 'ชัยศิริ ไกยสิทธิ์' },
      '65313655': { name: 'ภราดร วรรณทิพย์' },
      'teacher1': { name: 'อาจารย์ตัวอย่าง' },
      'admin1': { name: 'ผู้ดูแลระบบ' },
    };
    setUser({ ...userData, fullName: userDetails[userData.username]?.name || userData.username });
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};