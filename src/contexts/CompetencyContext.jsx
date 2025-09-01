import React, { createContext, useContext, useState } from 'react';

const CompetencyContext = createContext();

export const useCompetency = () => {
  return useContext(CompetencyContext);
};

export const CompetencyProvider = ({ children }) => {
  const [competencyData, setCompetencyData] = useState([]);

  const addCompetency = (data) => {
    setCompetencyData((prevData) => [...prevData, data]);
  };

  return (
    <CompetencyContext.Provider value={{ competencyData, addCompetency }}>
      {children}
    </CompetencyContext.Provider>
  );
};
