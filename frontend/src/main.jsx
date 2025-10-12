import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CompetencyProvider } from './contexts/CompetencyContext';
import { AnnouncementsProvider } from './contexts/AnnouncementsContext';

import WelcomePage from './components/WelcomePage';
import LoginPage from './components/LoginPage';
import HomePage from './components/HomePage';
import AddDataPage from './components/AddDataPage';
import StudentInfoPage from './components/StudentInfoPage';
import AddAnnouncementPage from './components/AddAnnouncementPage';
import EditDataPage from './components/EditDataPage';

// PrivateRoute ตรวจสอบผู้ใช้
const PrivateRoute = ({ element }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" />;
  }
  return element;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <CompetencyProvider>
        <AnnouncementsProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<WelcomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/home" element={<PrivateRoute element={<HomePage />} />} />
              <Route path="/add-data" element={<PrivateRoute element={<AddDataPage />} />} />
              <Route path="/student-info" element={<PrivateRoute element={<StudentInfoPage />} />} />
              <Route path="/create-announcement" element={<PrivateRoute element={<AddAnnouncementPage />} />} />
              <Route path='/edit' element={<PrivateRoute element={<EditDataPage />} />} />
              </Routes>
          </BrowserRouter>
        </AnnouncementsProvider>
      </CompetencyProvider>
    </AuthProvider>
  </React.StrictMode>
);
