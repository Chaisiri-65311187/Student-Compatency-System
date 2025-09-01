import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import { AuthProvider } from './contexts/AuthContext';
import HomePage from './components/HomePage';
import LoginPage from './components/LoginPage';
import AddDataPage from './components/AddDataPage';
import StudentInfoPage from './components/StudentInfoPage'; // นำเข้า StudentInfoPage
import WelcomePage from './components/WelcomePage'; // นำเข้า WelcomePage

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<WelcomePage />} /> {/* เพิ่มเส้นทางสำหรับ WelcomePage */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/add-data" element={<AddDataPage />} /> {/* เส้นทางสำหรับหน้าเพิ่มข้อมูล */}
          <Route path="/student-info" element={<StudentInfoPage />} /> {/* เส้นทางสำหรับหน้าแสดงข้อมูลนิสิต */}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
