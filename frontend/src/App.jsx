// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import WelcomePage from './components/WelcomePage';
import LoginPage from './components/LoginPage';
import AdminDashboard from "./components/admin/AdminDashboard";


function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={ <PrivateAdmin> <AdminDashboard /> </PrivateAdmin>}/> </Routes>
  );
}

export default App;