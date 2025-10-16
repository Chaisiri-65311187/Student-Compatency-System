// src/components/WelcomePage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";

const API_BASE = (import.meta.env?.VITE_API_BASE || "http://localhost:3000").replace(/\/+$/, "");

const TEMPLATE = `
รหัสนิสิต: 
รหัสผ่านชั่วคราวที่ต้องการ: 
ชื่อจริง: 
นามสกุล: 
ชั้นปี: 
สาขา: 
`;

export default function WelcomePage() {
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [chars, setChars] = useState(0);
  const maxChars = 800; // กำหนดความยาวข้อความโดยประมาณ
  const textRef = useRef(null);

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email), [form.email]);
  const canSubmit = useMemo(() => form.name.trim() && emailValid && form.message.trim() && chars <= maxChars, [form, emailValid, chars]);

  useEffect(() => {
    setChars(form.message.length);
  }, [form.message]);

  useEffect(() => {
    // กด Ctrl/Cmd+Enter เพื่อส่ง
    const handler = (e) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const hotkey = (isMac && e.metaKey) || (!isMac && e.ctrlKey);
      if (hotkey && e.key === "Enter" && canSubmit && !sending) {
        e.preventDefault();
        document.getElementById("contactSubmitBtn")?.click();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canSubmit, sending]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const fillTemplate = () => setForm((p) => ({ ...p, message: TEMPLATE }));

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(TEMPLATE);
      Swal.fire({ icon: "success", title: "คัดลอกเทมเพลตแล้ว", timer: 1400, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: "warning", title: "คัดลอกไม่สำเร็จ", text: "กรุณากดปุ่มเติมเทมเพลตแทน", timer: 1600, showConfirmButton: false });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) {
      Swal.fire("กรอกข้อมูลไม่ครบ", "กรุณากรอก ชื่อ, อีเมล (รูปแบบถูกต้อง) และข้อความ", "warning");
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          message: form.message.trim(),
        }),
      });
      if (!res.ok) throw new Error("ส่งไม่สำเร็จ");
      Swal.fire({
        icon: "success",
        title: "ส่งข้อความสำเร็จ",
        text: "ระบบได้รับข้อความแล้ว แอดมินจะติดต่อกลับทางอีเมล",
        timer: 2200,
        showConfirmButton: false,
      });
      setForm({ name: "", email: "", message: "" });
      textRef.current?.focus();
    } catch (err) {
      Swal.fire("เกิดข้อผิดพลาด", err.message || "ไม่สามารถส่งข้อความได้", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-vh-100 position-relative overflow-hidden bg-animated">
      {/* Decorative background blobs */}
      <div className="bg-blob bg-blob-1" aria-hidden="true" />
      <div className="bg-blob bg-blob-2" aria-hidden="true" />
      <div className="bg-blob bg-blob-3" aria-hidden="true" />

      {/* Top Bar */}
      <div className="topbar glassy d-flex align-items-center px-3">
        <img
          src="/src/assets/csit.jpg"
          alt="CSIT Logo"
          className="rounded-3 shadow-sm"
          style={{ height: 40, width: 40, objectFit: "cover" }}
        />
        <h5 className="text-white fw-semibold m-0 ms-3">
          CSIT Competency System
        </h5>
        <div className="ms-auto d-none d-md-flex align-items-center gap-2">
          <span className="badge bg-light text-dark shadow-sm">รุ่นทดสอบ</span>
          <a href="#contact" className="link-light small text-decoration-none" data-bs-toggle="modal" data-bs-target="#contactModal">ติดต่อแอดมิน</a>
        </div>
      </div>

      {/* Hero */}
      <div className="container-xxl position-relative" style={{ zIndex: 1 }}>
        <div className="row justify-content-center">
          <div className="col-12 col-lg-8 col-xl-6">
            <div className="card border-0 shadow-lg rounded-4 mx-auto my-5 card-float glassy">
              <div className="card-body text-center p-4 p-lg-5">
                <div className="mx-auto mb-3 soft-badge">🎓 CSIT</div>
                <h1 className="fw-bold mb-3 lh-base display-title">ยินดีต้อนรับ</h1>
                <p className="text-secondary mb-4">
                  ระบบสมรรถนะของนิสิตสาขา <strong>วิทยาการคอมพิวเตอร์</strong> และ <strong>เทคโนโลยีสารสนเทศ</strong>
                </p>

                <div className="d-grid gap-3 mt-2">
                  <Link to="/login" className="text-decoration-none">
                    <button className="btn btn-lg welcome-cta w-100 rounded-3 ripple">
                      เข้าสู่ระบบ
                    </button>
                  </Link>

                  <button
                    id="contactBtn"
                    className="btn btn-outline-primary btn-lg w-100 rounded-3 ripple"
                    data-bs-toggle="modal"
                    data-bs-target="#contactModal"
                  >
                    ✉️ ส่งข้อความถึงผู้ดูแลระบบ
                  </button>
                </div>

                <div className="mt-4 small text-muted">
                  หากต้องการใช้ระบบ กรุณาติดต่อแอดมิน โดยแนบรหัสนิสิต, รหัสผ่านที่ต้องการ, ชื่อ–นามสกุล, ชั้นปี, และสาขา
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal ส่งข้อความ */}
      <div className="modal fade" id="contactModal" tabIndex="-1" aria-labelledby="contactModalLabel" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content rounded-4 border-0 shadow">
            <div className="modal-header border-0">
              <h5 className="modal-title" id="contactModalLabel">✉️ ส่งข้อความถึงผู้ดูแลระบบ</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-floating mb-3">
                  <input
                    type="text"
                    className="form-control rounded-3"
                    id="name"
                    name="name"
                    placeholder="ชื่อผู้ส่ง"
                    value={form.name}
                    onChange={handleChange}
                    required
                  />
                  <label htmlFor="name">ชื่อผู้ส่ง</label>
                </div>
                <div className="form-floating mb-3">
                  <input
                    type="email"
                    className={`form-control rounded-3 ${form.email ? (emailValid ? 'is-valid' : 'is-invalid') : ''}`}
                    id="email"
                    name="email"
                    placeholder="อีเมลสำหรับติดต่อกลับ"
                    value={form.email}
                    onChange={handleChange}
                    required
                  />
                  <label htmlFor="email">อีเมลสำหรับติดต่อกลับ</label>
                  <div className="invalid-feedback">รูปแบบอีเมลไม่ถูกต้อง</div>
                </div>
                <div className="form-floating mb-2">
                  <textarea
                    ref={textRef}
                    className="form-control rounded-3"
                    id="message"
                    name="message"
                    placeholder="ข้อความ"
                    style={{ height: 200 }}
                    value={form.message}
                    onChange={handleChange}
                    maxLength={maxChars}
                    required
                  />
                  <label htmlFor="message">ข้อความ</label>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div className="small text-muted">กด <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> เพื่อส่ง</div>
                  <div className={`small ${chars > maxChars - 50 ? 'text-danger' : 'text-muted'}`}>
                    {chars}/{maxChars}
                  </div>
                </div>

                <div className="d-flex gap-2 flex-wrap">
                  <button type="button" className="btn btn-outline-secondary rounded-pill ripple" onClick={fillTemplate}>
                    เติมเทมเพลตอัตโนมัติ
                  </button>
                  <button type="button" className="btn btn-outline-dark rounded-pill ripple" onClick={copyTemplate}>
                    คัดลอกเทมเพลต
                  </button>
                </div>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-outline-secondary rounded-pill ripple" data-bs-dismiss="modal">ยกเลิก</button>
                <button id="contactSubmitBtn" type="submit" className="btn btn-primary rounded-pill ripple d-inline-flex align-items-center gap-2" disabled={sending || !canSubmit}>
                  {sending && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>}
                  {sending ? " กำลังส่ง..." : "ส่งข้อความ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Decorative wave bottom */}
      <svg className="wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,64L80,90.7C160,117,320,171,480,176C640,181,800,139,960,128C1120,117,1280,139,1360,149.3L1440,160L1440,0L1360,0C1280,0,1120,0,960,0C800,0,640,0,480,0C320,0,160,0,80,0L0,0Z" fill="#ffffff" fillOpacity="0.85"></path>
      </svg>

      {/* Local styles */}
      <style>{`
        /* ===== Animated gradient background ===== */
        .bg-animated {
          background: radial-gradient(1200px 600px at 10% -10%, #efe7ff 15%, transparent 60%),
                      radial-gradient(1000px 500px at 110% 10%, #e6f0ff 10%, transparent 55%),
                      linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%);
        }
        .glassy { backdrop-filter: blur(8px); }

        .topbar {
          position: sticky; top: 0; left: 0; width: 100%; height: 72px;
          background: linear-gradient(90deg, rgba(111,66,193,.9), rgba(142,92,255,.9));
          box-shadow: 0 4px 14px rgba(111,66,193,.22); z-index: 10;
          border-bottom: 1px solid rgba(255,255,255,.12);
        }

        /* Floating card subtle motion */
        .card-float { animation: floatY 6s ease-in-out infinite; }
        @keyframes floatY { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-6px) } }

        .soft-badge {
          display: inline-block; padding: .35rem .75rem; border-radius: 999px;
          background: rgba(111,66,193,.1); color: #6f42c1; font-weight: 600; font-size: .9rem;
          box-shadow: inset 0 0 0 1px rgba(111,66,193,.15);
        }
        .display-title { font-size: clamp(1.85rem, 4vw, 2.5rem); }

        /* CTA */
        .welcome-cta {
          background: linear-gradient(135deg,#6f42c1,#8e5cff);
          border: none; color: #fff;
          box-shadow: 0 10px 24px rgba(111,66,193,.25);
          transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease;
        }
        .welcome-cta:hover { transform: translateY(-1px); box-shadow: 0 14px 30px rgba(111,66,193,.28); opacity: .98; }
        .welcome-cta:active { transform: translateY(0); box-shadow: 0 8px 18px rgba(111,66,193,.22); }

        /* Ripple (pure CSS approximation) */
        .ripple { position: relative; overflow: hidden; }
        .ripple:after {
          content: ""; position: absolute; inset: 0; border-radius: inherit; opacity: 0;
          background: radial-gradient(circle at var(--x,50%) var(--y,50%), rgba(255,255,255,.45), transparent 40%);
          transform: scale(0.2); transition: transform .3s, opacity .45s; pointer-events: none;
        }
        .ripple:active:after { opacity: 1; transform: scale(1); transition: 0s; }
        .ripple { --x: 50%; --y: 50%; }
        .ripple:focus-visible { outline: 3px solid rgba(142,92,255,.45); outline-offset: 2px; }

        /* Form focus */
        .form-control:focus { box-shadow: 0 0 0 .2rem rgba(111,66,193,.12); border-color: #8e5cff; }

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

      {/* tiny script to position ripple center under cursor (no external lib) */}
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