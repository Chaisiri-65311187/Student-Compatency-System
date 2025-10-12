// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import WelcomePage from './components/WelcomePage';
import LoginPage from './components/LoginPage';


function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}

export default App;