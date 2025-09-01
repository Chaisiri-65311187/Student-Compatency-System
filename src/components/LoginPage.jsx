
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = (e) => {
    e.preventDefault();

    // ✅ mockUsers มี id + fullName ครบ
    const mockUsers = [
      {
        id: "65311187",
        fullName: "ชัยศิริ ไกยสิทธิ์",
        username: "65311187",
        password: "nu833398",
        role: "student"
      },
      {
        id: "t001",
        fullName: "Teacher One",
        username: "teacher1",
        password: "teacher123",
        role: "teacher"
      },
      {
        id: "a001",
        fullName: "Admin One",
        username: "admin1",
        password: "admin123",
        role: "admin"
      }
    ];

    const user = mockUsers.find(
      (u) => u.username === username && u.password === password
    );

    if (user) {
      login(user); // บันทึก user เข้า Context
      navigate('/home'); // ไปหน้า Home
    } else {
      console.log('Login failed! Check username or password.');
    }
  };

  return (
    <div style={{ backgroundColor: '#FFF8F0', minHeight: '100vh' }}>
      {/* Header */}
      <div
        className="d-flex align-items-center p-2"
        style={{ height: '60px', backgroundColor: '#6f42c1' }}
      >
        <img
          src="/src/assets/csit.jpg"
          alt="Logo"
          style={{ height: '50px', marginLeft: '10px', marginRight: '10px' }}
        />
        <h5 className="text-white fw-bold m-0">CSIT Competency System</h5>
      </div>

      {/* Card login */}
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="card shadow p-4" style={{ minWidth: '400px' }}>
          <div className="card-body text-center">
            <h1 className="display-6 mb-4">เข้าสู่ระบบ</h1>

            <form
              onSubmit={handleLogin}
              className="d-flex flex-column align-items-center gap-3"
            >
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ชื่อผู้ใช้ (รหัสนิสิต/อาจารย์/ผู้ดูแล)"
                className="form-control w-100"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                className="form-control w-100"
                required
              />
              <button type="submit" className="btn btn-dark w-100">
                Login
              </button>
            </form>

            {/* Back button */}
            <div className="mt-3">
              <Link
                to="/"
                className="btn"
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#6c757d',
                }}
              >
                ย้อนกลับ
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
    
  );
};

export default LoginPage;
