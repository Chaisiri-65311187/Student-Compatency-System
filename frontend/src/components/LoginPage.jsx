// src/components/LoginPage.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, user } = useAuth();

  // ถ้าเคยล็อกอินไว้แล้ว ให้นำทางตาม role
  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") navigate("/admin");
    else if (user.role === "teacher") navigate("/student-info");
    else navigate("/home");
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(username.trim(), password); // login() ควร return user object
      if (!u) throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");

      // ✅ ใช้ u.role แทน user.role
      if (u.role === "admin") navigate("/admin");
      else if (u.role === "teacher") navigate("/student-info");
      else navigate("/home");
    } catch (err) {
      setError(err?.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#f4f7fa", minHeight: "100vh" }}>
      {/* Header */}
      <div
        className="d-flex align-items-center p-3"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "80px",
          backgroundColor: "#6f42c1",
          boxShadow: "0 4px 10px rgba(0,0,0,.1)",
          zIndex: 999,
        }}
      >
        <img
          src="/src/assets/csit.jpg"
          alt="Logo"
          style={{ height: '50px', marginLeft: '10px', marginRight: '10px' }}
        />
        <h5 className="text-white fw-bold m-0" style={{ marginLeft: 10 }}>
          CSIT Competency System
        </h5>
      </div>

      {/* Card login */}
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="card shadow p-4" style={{ minWidth: 400 }}>
          <div className="card-body text-center">
            <h1 className="display-6 mb-4">เข้าสู่ระบบ</h1>

            {error && <div className="alert alert-danger mb-4">{error}</div>}

            <form onSubmit={handleLogin} className="d-flex flex-column align-items-center gap-3">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="รหัสนิสิต / อีเมลอาจารย์"
                className="form-control w-100"
                required
                autoFocus
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                className="form-control w-100"
                required
              />
              <button type="submit" className="btn btn-dark w-100" disabled={loading}>
                {loading ? "กำลังเข้าสู่ระบบ..." : "Login"}
              </button>
            </form>

            <div className="mt-3">
              <Link
                to="/"
                className="btn"
                style={{ border: "none", backgroundColor: "transparent", color: "#6c757d" }}
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
