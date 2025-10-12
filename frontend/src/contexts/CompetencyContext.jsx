
import React, { createContext, useContext, useState } from "react";

// สร้าง context สำหรับ Competency
const CompetencyContext = createContext();

// Hook สำหรับใช้ context
export const useCompetency = () => useContext(CompetencyContext);

// สร้าง Provider สำหรับ Competency
export const CompetencyProvider = ({ children }) => {
  // ใช้ useState เพื่อเก็บข้อมูลสมรรถนะ
  const [competencyData, setCompetencyData] = useState([]);

  // ฟังก์ชันสำหรับเพิ่มข้อมูลสมรรถนะ
  const addCompetency = (data) => {
    setCompetencyData((prevData) => [...prevData, data]); // เพิ่มข้อมูลใน array
  };

  return (
    <CompetencyContext.Provider value={{ competencyData, addCompetency }}>
      {children}
    </CompetencyContext.Provider>
  );
};
