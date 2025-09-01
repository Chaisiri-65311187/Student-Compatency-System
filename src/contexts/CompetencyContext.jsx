import React, { createContext, useContext, useState } from 'react';

const CompetencyContext = createContext();

export const useCompetency = () => useContext(CompetencyContext);

export const CompetencyProvider = ({ children }) => {
  const [competencyData, setCompetencyData] = useState([]);

  // ฟังก์ชันเพิ่มข้อมูลสมรรถนะ
  const addCompetency = (data) => {
    setCompetencyData((prevData) => [...prevData, data]); // เพิ่มข้อมูลใหม่ใน competencyData
  };

  return (
    <CompetencyContext.Provider value={{ competencyData, addCompetency }}>
      {children}
    </CompetencyContext.Provider>
  );
};
