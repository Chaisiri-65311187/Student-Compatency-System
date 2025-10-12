// src/components/LoginPage.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);      // toggle แบบสลับ
  const [capsOn, setCapsOn] = useState(false);
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
      const u = await login(String(username).trim(), password);
      if (!u) throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      if (u.role === "admin") navigate("/admin");
      else if (u.role === "teacher") navigate("/student-info");
      else navigate("/home");
    } catch (err) {
      setError(err?.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyUp = (e) =>
    setCapsOn(e.getModifierState && e.getModifierState("CapsLock"));

  // กดค้างที่ไอคอนตาเพื่อโชว์ชั่วคราว
  const pressHoldShow = () => setShowPw(true);
  const releaseShow = () => setShowPw(false);

  return (
    <div
      className="min-vh-100"
      style={{ background: "linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%)" }}
    >
      {/* Header */}
      <header
        className="w-100 position-sticky top-0"
        style={{
          height: 72,
          background: "linear-gradient(90deg, #6f42c1, #8e5cff)",
          boxShadow: "0 4px 14px rgba(111,66,193,.22)",
          zIndex: 10,
        }}
      >
        <div className="container-xxl h-100 d-flex align-items-center">
          <img
            src="/src/assets/csit.jpg"
            alt="Logo"
            className="rounded-3 me-3"
            style={{ width: 40, height: 40, objectFit: "cover" }}
          />
          <div className="text-white fw-semibold">CSIT Competency System</div>
        </div>
      </header>

      {/* Content */}
      <div className="container-xxl" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-5">
            <div
              className="card border-0 shadow-sm rounded-4"
              style={{ backdropFilter: "blur(6px)", background: "rgba(255,255,255,.95)" }}
            >
              <div className="card-body p-4 p-lg-5">
                <h1 className="h4 fw-semibold text-center mb-4">เข้าสู่ระบบ</h1>

                {error && (
                  <div className="alert alert-danger rounded-3 py-2">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin} onKeyUp={handleKeyUp}>
                  {/* Username */}
                  <div className="form-floating mb-3">
                    <input
                      type="text"
                      className="form-control rounded-3"
                      id="username"
                      placeholder="รหัสนิสิต / อีเมลอาจารย์"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoFocus
                    />
                    <label htmlFor="username">
                      <i className="bi bi-person me-2"></i>
                      รหัสนิสิต / อีเมลอาจารย์
                    </label>
                  </div>

                  {/* Password + toggle */}
                  <div className="form-floating mb-2 position-relative">
                    <input
                      type={showPw ? "text" : "password"}
                      className="form-control rounded-3 pe-5"
                      id="password"
                      placeholder="รหัสผ่าน"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      aria-label="ช่องกรอกรหัสผ่าน"
                      aria-describedby="showPwHelp"
                    />
                    <label htmlFor="password">
                      <i className="bi bi-shield-lock me-2"></i>
                      รหัสผ่าน
                    </label>

                    {/* ปุ่มตา: คลิกสลับ / กดค้างเพื่อโชว์ชั่วคราว */}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary position-absolute top-50 end-0 translate-middle-y me-2 rounded-pill"
                      onClick={() => setShowPw((s) => !s)}
                      onMouseDown={pressHoldShow}
                      onTouchStart={pressHoldShow}
                      onMouseUp={releaseShow}
                      onMouseLeave={releaseShow}
                      onTouchEnd={releaseShow}
                      tabIndex={-1}
                      aria-pressed={showPw}
                      aria-label={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                      title={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน (กดค้างเพื่อแสดงชั่วคราว)"}
                    >
                      <i className={`bi ${showPw ? "bi-eye-slash" : "bi-eye"}`}></i>
                    </button>
                  </div>

                 
                  {/* CapsLock hint */}
                  {capsOn && (
                    <div className="form-text text-warning mb-3">
                      <i className="bi bi-keyboard me-1"></i>
                      เปิด CapsLock อยู่ อาจทำให้รหัสผ่านไม่ตรง
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary w-100 rounded-3" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        กำลังเข้าสู่ระบบ...
                      </>
                    ) : (
                      "เข้าสู่ระบบ"
                    )}
                  </button>
                </form>

                <div className="d-flex justify-content-between align-items-center mt-3">
                  <Link to="/" className="text-secondary text-decoration-none">
                    ← ย้อนกลับ
                  </Link>
                </div>
              </div>
            </div>

            {/* Foot note */}
            <div className="text-center text-muted small mt-3">
              ใช้ได้ทั้ง <strong>รหัสนิสิต</strong> และ <strong>อีเมลอาจารย์</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Local styles */}
      <style>{`
        .form-floating > label i{ opacity:.7; }
        .form-control:focus{
          box-shadow: 0 0 0 .2rem rgba(111,66,193,.15);
          border-color: #8e5cff;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
