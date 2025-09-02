import React, { createContext, useContext, useState } from 'react';

const AnnouncementsContext = createContext();

export const useAnnouncements = () => useContext(AnnouncementsContext);

export const AnnouncementsProvider = ({ children }) => {
  const [announcements, setAnnouncements] = useState([]);

  const addAnnouncement = (announcement) => {
    setAnnouncements((prev) => [...prev, announcement]);
  };

  return (
    <AnnouncementsContext.Provider value={{ announcements, addAnnouncement }}>
      {children}
    </AnnouncementsContext.Provider>
  );
};
