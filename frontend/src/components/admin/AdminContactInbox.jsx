// src/components/admin/AdminContactInbox.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
// 👇 เปลี่ยน path ให้ถูกต้อง (จาก ../contexts/... เป็น ../../contexts/...)
import { useAuth } from "../../contexts/AuthContext";

const API_BASE = (import.meta.env?.VITE_API_BASE || "http://localhost:3000")
  .replace(/\/+$/, "");

export default function AdminContactInbox() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [active, setActive] = useState(null);

  useEffect(() => {
    // guard: ต้องเป็น admin
    if (!user) return;
    if (user.role !== "admin") {
      navigate("/login");
      return;
    }
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await fetch(`${API_BASE}/api/contact`, {
          credentials: "include",
        });
        const data = await res.json();
        setRows(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        setErr(e?.message || "โหลดข้อความไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, [user, navigate]);

  const setStatus = async (id, status) => {
    try {
      await fetch(`${API_BASE}/api/contact/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    } catch (e) {
      alert(e?.message || "อัปเดตสถานะไม่สำเร็จ");
    }
  };

  if (!user || user.role !== "admin") return null;

  return (
    <div
      className="min-vh-100"
      style={{ background: "linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%)" }}
    >
      {/* Top bar */}
      <div
        className="d-flex align-items-center px-3"
        style={{
          height: 72,
          background: "linear-gradient(90deg,#6f42c1,#8e5cff)",
          boxShadow: "0 4px 14px rgba(111,66,193,.22)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <img
          src="/src/assets/csit.jpg"
          alt="logo"
          className="rounded-3 me-3"
          style={{ width: 40, height: 40, objectFit: "cover" }}
        />
        <h5 className="text-white fw-semibold m-0">Admin · กล่องข้อความ</h5>
        <div className="ms-auto text-white-50">{user.full_name || user.username}</div>
      </div>

      <div className="container-xxl py-4">
        <div className="d-flex align-items-center mb-3">
          <button
            className="btn btn-outline-secondary rounded-pill me-2"
            onClick={() => navigate(-1)}
          >
            ← ย้อนกลับ
          </button>
          <h4 className="m-0">ข้อความติดต่อจากหน้า Welcome</h4>
        </div>

        {loading ? (
          <div className="text-muted">
            <span className="spinner-border spinner-border-sm me-2" />
            กำลังโหลด…
          </div>
        ) : err ? (
          <div className="alert alert-danger">{err}</div>
        ) : rows.length === 0 ? (
          <div className="alert alert-secondary">ยังไม่มีข้อความ</div>
        ) : (
          <div className="row g-3">
            {rows.map((m) => (
              <div className="col-12 col-lg-6" key={m.id}>
                <div className="card border-0 shadow-sm rounded-4 h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="fw-semibold">{m.name}</div>
                        <div className="text-muted small">{m.email}</div>
                      </div>
                      <span
                        className={`badge ${
                          m.status === "done"
                            ? "text-bg-success"
                            : m.status === "read"
                            ? "text-bg-secondary"
                            : "text-bg-warning"
                        }`}
                      >
                        {m.status || "new"}
                      </span>
                    </div>

                    <hr />
                    <div
                      className="small"
                      style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                    >
                      {m.message}
                    </div>

                    <div className="mt-3 d-flex gap-2">
                      <button
                        className="btn btn-sm btn-outline-secondary rounded-pill"
                        onClick={() => setActive(active === m.id ? null : m.id)}
                      >
                        รายละเอียดเทคนิค
                      </button>
                      <div className="ms-auto btn-group">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => setStatus(m.id, "read")}
                        >
                          ทำเครื่องหมายอ่านแล้ว
                        </button>
                        <button
                          className="btn btn-sm btn-outline-success"
                          onClick={() => setStatus(m.id, "done")}
                        >
                          จัดการเสร็จสิ้น
                        </button>
                      </div>
                    </div>

                    {active === m.id && (
                      <div className="mt-3 small text-muted">
                        IP: {m.ip_address || "-"} · UA: {m.user_agent || "-"} · เวลา:{" "}
                        {new Date(m.created_at).toLocaleString("th-TH")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
