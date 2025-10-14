// src/main.jsx (หรือไฟล์ที่คุณเรนเดอร์ <Routes> อยู่ตอนนี้)
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CompetencyProvider } from "./contexts/CompetencyContext";
import { AnnouncementsProvider } from "./contexts/AnnouncementsContext";

import WelcomePage from "./components/WelcomePage";
import LoginPage from "./components/LoginPage";
import HomePage from "./components/HomePage";
import AddDataPage from "./components/AddDataPage";
import StudentInfoPage from "./components/StudentInfoPage";
import AddAnnouncementPage from "./components/AddAnnouncementPage";
import AdminDashboard from "./components/admin/AdminDashboard";
import ManageUsersPage from "./components/admin/ManageUsersPage";
import CompetencyFormPage from "./components/CompetencyFormPage";
import StudentProfilePage from "./components/StudentProfilePage";
import TeacherAnnouncementsPage from "./components/TeacherAnnouncementsPage";



/** PrivateRoute: บังคับล็อกอิน + (ถ้ามี) ตรวจ role */
const PrivateRoute = ({ element, roles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  // ถ้ากำหนด roles เข้ามา ให้ตรวจสิทธิ์
  if (roles && !roles.includes(user.role)) {
    // ถ้าไม่ใช่สิทธิ์ที่กำหนด ให้เด้งไปหน้าที่เหมาะสม
    return <Navigate to="/home" replace />;
  }
  return element;
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CompetencyProvider>
          <AnnouncementsProvider>
            <Routes>
              <Route path="/" element={<WelcomePage />} />
              <Route path="/login" element={<LoginPage />} />

              {/* student/teacher ที่ล็อกอินแล้วเข้าได้ */}
              <Route path="/home" element={<PrivateRoute element={<HomePage />} />} />
              <Route path="/add-data" element={<PrivateRoute element={<AddDataPage />} />} />
              <Route path="/student-info" element={<PrivateRoute element={<StudentInfoPage />} />} />
              <Route path="/create-announcement" element={<PrivateRoute element={<AddAnnouncementPage />} />} />
              <Route path="/competency/form" element={<CompetencyFormPage />} />
              <Route path="/profile" element={<PrivateRoute element={<StudentProfilePage />} />} />
              <Route path="/teacher-announcements" element={<TeacherAnnouncementsPage />} />

              {/* ✅ admin-only */}
              <Route
                path="/admin"
                element={<PrivateRoute roles={["admin"]} element={<AdminDashboard />} />}
              />
              <Route
                path="/admin/users"
                element={<PrivateRoute roles={["admin"]} element={<ManageUsersPage />} />}
              />

              {/* route อื่น ๆ ที่ไม่ตรง ให้ย้อนหน้าแรก */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnnouncementsProvider>
        </CompetencyProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
