import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CompetencyProvider } from './contexts/CompetencyContext'; // นำเข้า CompetencyProvider
import AddDataPage from './components/AddDataPage';
import StudentInfoPage from './components/StudentInfoPage';
import HomePage from './components/HomePage';
import LoginPage from './components/LoginPage';
import WelcomePage from './components/WelcomePage'; // เพิ่มการนำเข้า WelcomePage

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <CompetencyProvider> {/* ใช้ CompetencyProvider ครอบ App */}
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<WelcomePage />} /> {/* แสดงหน้า WelcomePage ที่ path "/" */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/add-data" element={<AddDataPage />} />
            <Route path="/student-info" element={<StudentInfoPage />} />
          </Routes>
        </BrowserRouter>
      </CompetencyProvider>
    </AuthProvider>
  </React.StrictMode>
);
