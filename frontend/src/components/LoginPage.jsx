// src/components/LoginPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);

  const navigate = useNavigate();
  const { login, user } = useAuth();
  const pwRef = useRef(null);

  // ถ้าเคยล็อกอินไว้แล้ว ให้นำทางตาม role
  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") navigate("/admin");
    else if (user.role === "teacher") navigate("/student-info");
    else navigate("/home");
  }, [user, navigate]);

  // Hotkey: Enter เพื่อส่ง, Ctrl/Cmd+Backspace เคลียร์ฟิลด์
  const canSubmit = useMemo(() => username.trim() && password.trim() && !loading, [username, password, loading]);
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Enter" && canSubmit) {
        e.preventDefault();
        document.getElementById("loginSubmitBtn")?.click();
      }
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const hotkey = (isMac && e.metaKey) || (!isMac && e.ctrlKey);
      if (hotkey && e.key === "Backspace") {
        setUsername("");
        setPassword("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canSubmit]);

  // CapsLock hint
  const handleKeyUp = (e) => setCapsOn(e.getModifierState && e.getModifierState("CapsLock"));

  // กดค้างที่ไอคอนตาเพื่อโชว์ชั่วคราว
  const pressHoldShow = () => setShowPw(true);
  const releaseShow = () => setShowPw(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(String(username).trim(), password);
      if (!u) throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      if (remember) {
        // เก็บ last-username ไว้ช่วย autofill ครั้งหน้า (non-sensitive)
        localStorage.setItem("last_username", String(username).trim());
      } else {
        localStorage.removeItem("last_username");
      }
      if (u.role === "admin") navigate("/admin");
      else if (u.role === "teacher") navigate("/student-info");
      else navigate("/home");
    } catch (err) {
      setError(err?.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      pwRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Prefill last username หากเคยติ๊กจำชื่อผู้ใช้
  useEffect(() => {
    const last = localStorage.getItem("last_username");
    if (last) setUsername(last);
  }, []);

  return (
    <div className="min-vh-100 position-relative overflow-hidden bg-animated">
      {/* Decorative background blobs */}
      <div className="bg-blob bg-blob-1" aria-hidden="true" />
      <div className="bg-blob bg-blob-2" aria-hidden="true" />
      <div className="bg-blob bg-blob-3" aria-hidden="true" />

      {/* Header */}
      <header className="topbar glassy">
        <div className="container-xxl h-100 d-flex align-items-center">
          <img src="/src/assets/csit.jpg" alt="Logo" className="rounded-3 me-3 shadow-sm" style={{ width: 40, height: 40, objectFit: "cover" }} />
          <div className="text-white fw-semibold">CSIT Competency System</div>
          <div className="ms-auto d-none d-md-block small text-white-50">กด <kbd>Enter</kbd> เพื่อเข้าสู่ระบบ</div>
        </div>
      </header>

      {/* Content */}
      <div className="container-xxl" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-5">
            <div className="card border-0 shadow-lg rounded-4 glassy">
              <div className="card-body p-4 p-lg-5">
                <div className="mx-auto mb-3 soft-badge">🔐 Login</div>
                <h1 className="h4 fw-bold text-center mb-4">เข้าสู่ระบบ</h1>

                {error && (
                  <div className="alert alert-danger rounded-3 py-2" role="alert">
                    <i className="bi bi-exclamation-triangle me-2" aria-hidden="true"></i>
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} onKeyUp={handleKeyUp} noValidate>
                  {/* Username */}
                  <div className="form-floating mb-3">
                    <input
                      type="text"
                      className={`form-control rounded-3 ${username ? 'is-valid' : ''}`}
                      id="username"
                      placeholder="รหัสนิสิต / อีเมลอาจารย์"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoFocus
                      autoComplete="username"
                      aria-label="รหัสนิสิต หรือ อีเมลอาจารย์"
                    />
                    <label htmlFor="username"><i className="bi bi-person me-2" aria-hidden="true"></i>รหัสนิสิต / อีเมลอาจารย์</label>
                  </div>

                  {/* Password + toggle */}
                  <div className="form-floating mb-2 position-relative">
                    <input
                      ref={pwRef}
                      type={showPw ? "text" : "password"}
                      className="form-control rounded-3 pe-5"
                      id="password"
                      placeholder="รหัสผ่าน"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      aria-label="ช่องกรอกรหัสผ่าน"
                      aria-describedby="showPwHelp"
                    />
                    <label htmlFor="password"><i className="bi bi-shield-lock me-2" aria-hidden="true"></i>รหัสผ่าน</label>

                    {/* ปุ่มตา: คลิกสลับ / กดค้างเพื่อโชว์ชั่วคราว */}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary position-absolute top-50 end-0 translate-middle-y me-2 rounded-pill ripple"
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
                      <i className={`bi ${showPw ? "bi-eye-slash" : "bi-eye"}`} aria-hidden="true"></i>
                    </button>
                  </div>

                  {/* CapsLock hint */}
                  {capsOn && (
                    <div className="form-text text-warning mb-3">
                      <i className="bi bi-keyboard me-1" aria-hidden="true"></i>
                      เปิด CapsLock อยู่ อาจทำให้รหัสผ่านไม่ตรง
                    </div>
                  )}

                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="form-check">
                      <input className="form-check-input" type="checkbox" id="rememberMe" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                      <label className="form-check-label" htmlFor="rememberMe">จำชื่อผู้ใช้</label>
                    </div>
                    <Link to="/" className="text-secondary text-decoration-none small">← ย้อนกลับ</Link>
                  </div>

                  <button id="loginSubmitBtn" type="submit" className="btn btn-primary w-100 rounded-3 ripple" disabled={!canSubmit}>
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

                <div className="text-center text-muted small mt-3">
                  ใช้ได้ทั้ง <strong>รหัสนิสิต</strong> และ <strong>อีเมลอาจารย์</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative wave bottom */}
      <svg className="wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,64L80,90.7C160,117,320,171,480,176C640,181,800,139,960,128C1120,117,1280,139,1360,149.3L1440,160L1440,0L1360,0C1280,0,1120,0,960,0C800,0,640,0,480,0C320,0,160,0,80,0L0,0Z" fill="#ffffff" fillOpacity="0.85"></path>
      </svg>

      {/* Local styles */}
      <style>{`
        /* ===== Animated gradient background (match WelcomePage) ===== */
        .bg-animated {
          background: radial-gradient(1200px 600px at 10% -10%, #efe7ff 15%, transparent 60%),
                      radial-gradient(1000px 500px at 110% 10%, #e6f0ff 10%, transparent 55%),
                      linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%);
        }
        .glassy { backdrop-filter: blur(8px); }

        .topbar { height: 72px; position: sticky; top: 0; left: 0; width: 100%;
          background: linear-gradient(90deg, rgba(111,66,193,.9), rgba(142,92,255,.9));
          box-shadow: 0 4px 14px rgba(111,66,193,.22); z-index: 10;
          border-bottom: 1px solid rgba(255,255,255,.12);
        }

        /* Floating card subtle motion */
        .card-float { animation: floatY 6s ease-in-out infinite; }
        @keyframes floatY { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-6px) } }

        .soft-badge { display: inline-block; padding: .35rem .75rem; border-radius: 999px;
          background: rgba(111,66,193,.1); color: #6f42c1; font-weight: 600; font-size: .9rem;
          box-shadow: inset 0 0 0 1px rgba(111,66,193,.15); }

        .form-floating > label i{ opacity:.7; }
        .form-control:focus{ box-shadow: 0 0 0 .2rem rgba(111,66,193,.15); border-color: #8e5cff; }

        /* Ripple */
        .ripple { position: relative; overflow: hidden; }
        .ripple:after { content: ""; position: absolute; inset: 0; border-radius: inherit; opacity: 0;
          background: radial-gradient(circle at var(--x,50%) var(--y,50%), rgba(255,255,255,.45), transparent 40%);
          transform: scale(0.2); transition: transform .3s, opacity .45s; pointer-events: none; }
        .ripple:active:after { opacity: 1; transform: scale(1); transition: 0s; }
        .ripple { --x: 50%; --y: 50%; }
        .ripple:focus-visible { outline: 3px solid rgba(142,92,255,.45); outline-offset: 2px; }

        /* Background blobs */
        .bg-blob { position: absolute; filter: blur(60px); opacity: .55; z-index: 0; }
        .bg-blob-1 { width: 420px; height: 420px; left: -120px; top: -80px; background: #d7c6ff; animation: drift1 18s ease-in-out infinite; }
        .bg-blob-2 { width: 360px; height: 360px; right: -120px; top: 120px; background: #c6ddff; animation: drift2 22s ease-in-out infinite; }
        .bg-blob-3 { width: 300px; height: 300px; left: 15%; bottom: -120px; background: #ffd9ec; animation: drift3 20s ease-in-out infinite; }
        @keyframes drift1 { 0%,100%{ transform: translate(0,0) } 50%{ transform: translate(20px,10px) } }
        @keyframes drift2 { 0%,100%{ transform: translate(0,0) } 50%{ transform: translate(-16px,8px) } }
        @keyframes drift3 { 0%,100%{ transform: translate(0,0) } 50%{ transform: translate(12px,-12px) } }

        /* Bottom wave */
        .wave { position: fixed; left: 0; right: 0; bottom: -1px; width: 100%; height: 120px; }
      `}</style>

      {/* Script สำหรับคำนวณตำแหน่ง ripple ตามตำแหน่งคลิก */}
      <script dangerouslySetInnerHTML={{ __html: `
        document.addEventListener('pointerdown', (e) => {
          const el = e.target.closest('.ripple');
          if (!el) return;
          const rect = el.getBoundingClientRect();
          el.style.setProperty('--x', ((e.clientX - rect.left) / rect.width * 100).toFixed(2) + '%');
          el.style.setProperty('--y', ((e.clientY - rect.top) / rect.height * 100).toFixed(2) + '%');
        }, { passive: true });
      `}} />
    </div>
  );
}
