// src/components/teacher/TeacherAnnouncementsPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  listMyAnnouncements,
  deleteAnnouncement,
} from "../../services/announcementsApi";
import Swal from "sweetalert2";

/* ===== helpers ===== */
const tz = "Asia/Bangkok";
const parseSafeDate = (s) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
const formatDateTH = (s) => {
  const d = s instanceof Date ? s : parseSafeDate(s);
  if (!d) return "–";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: tz,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
};

function normalizeItem(x) {
  const cap = x.capacity == null ? null : Number(x.capacity);
  const acc = Number(x.accepted_count || 0);
  const remaining = cap == null ? null : Math.max(0, cap - acc);
  return { ...x, capacity: cap, accepted_count: acc, remaining };
}

function statusPill(r) {
  const full = r.capacity != null && (r.remaining ?? 0) <= 0;
  if (r.status === "closed") return { text: "ปิดรับ", cls: "bg-secondary", icon: "🔒" };
  if (r.status !== "open") return { text: "เก็บถาวร", cls: "bg-dark", icon: "📦" };
  if (full) return { text: "เต็มแล้ว", cls: "bg-warning text-dark", icon: "🔴" };
  return { text: "เปิดรับ", cls: "bg-success", icon: "🟢" };
}

export default function TeacherAnnouncementsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all"); // all, open, closed, full
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (user && user.role !== "teacher") navigate("/home", { replace: true });
  }, [user, navigate]);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setErr("");
    try {
      const r = await listMyAnnouncements(user.id);
      const items = (r?.items || r || []).map(normalizeItem);
      setRows(items);
    } catch (e) {
      setErr(e?.message || "โหลดรายการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Stats
  const stats = useMemo(() => {
    const open = rows.filter(r => r.status === "open" && (r.remaining ?? 1) > 0).length;
    const full = rows.filter(r => r.status === "open" && r.capacity != null && (r.remaining ?? 0) <= 0).length;
    const closed = rows.filter(r => r.status === "closed" || r.status !== "open").length;
    const totalApplicants = rows.reduce((sum, r) => sum + (r.accepted_count || 0), 0);
    return { total: rows.length, open, full, closed, totalApplicants };
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    let result = rows;
    if (filter === "open") result = rows.filter(r => r.status === "open" && (r.remaining ?? 1) > 0);
    else if (filter === "full") result = rows.filter(r => r.status === "open" && r.capacity != null && (r.remaining ?? 0) <= 0);
    else if (filter === "closed") result = rows.filter(r => r.status === "closed" || r.status !== "open");

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r =>
        r.title?.toLowerCase().includes(term) ||
        r.department?.toLowerCase().includes(term)
      );
    }
    return result;
  }, [rows, filter, searchTerm]);

  const handleDelete = useCallback(
    async (id) => {
      const c = await Swal.fire({
        title: "ยืนยันการลบ?",
        text: "ประกาศนี้จะถูกลบถาวร",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "ลบ",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#dc3545",
      });
      if (!c.isConfirmed) return;
      try {
        await deleteAnnouncement(id, user.id);
        setRows((prev) => prev.filter((x) => x.id !== id));
        Swal.fire({ title: "ลบสำเร็จ!", icon: "success", timer: 1500, showConfirmButton: false });
      } catch (e) {
        Swal.fire("ลบไม่สำเร็จ", e?.message || "เกิดข้อผิดพลาด", "error");
      }
    },
    [user?.id]
  );

  if (!user) return null;

  return (
    <div className="min-vh-100 position-relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* Decorative Elements */}
      <div className="position-absolute" style={{ top: -100, right: -100, width: 400, height: 400, background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }} />
      <div className="position-absolute" style={{ bottom: -150, left: -100, width: 500, height: 500, background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />

      {/* Top bar */}
      <div className="py-3 px-4" style={{ background: 'rgba(0,0,0,0.1)' }}>
        <div className="container-xxl d-flex align-items-center">
          <div className="d-flex align-items-center">
            <img
              src="/csit.jpg"
              alt="Logo"
              className="rounded-3 shadow"
              style={{ height: 45, width: 45, objectFit: "cover" }}
              onError={(e) => (e.currentTarget.src = "/src/assets/csit.jpg")}
            />
            <div className="ms-3">
              <div className="text-white fw-bold">CSIT Competency System</div>
              <small className="text-white-50">ระบบจัดการประกาศรับสมัคร</small>
            </div>
          </div>
          <div className="ms-auto d-flex gap-2">
            <button className="btn btn-outline-light btn-sm rounded-pill" onClick={() => navigate('/student-info')}>
              🏠 หน้าหลัก
            </button>
            <button className="btn btn-light btn-sm rounded-pill" onClick={() => navigate(-1)}>
              ← ย้อนกลับ
            </button>
          </div>
        </div>
      </div>

      <div className="container-xxl py-4 position-relative" style={{ zIndex: 1 }}>
        {/* Header */}
        <div className="text-center text-white mb-4">
          <h2 className="fw-bold mb-2">📢 ประกาศของฉัน</h2>
          <p className="opacity-75">จัดการประกาศรับสมัครงานและกิจกรรม</p>
        </div>

        {/* Stats Cards */}
        <div className="row g-3 mb-4">
          <div className="col-6 col-md-3">
            <div className="card border-0 rounded-4 h-100 shadow" style={{ background: 'rgba(255,255,255,0.95)' }}>
              <div className="card-body text-center py-3">
                <div style={{ fontSize: '2rem' }}>📋</div>
                <div className="fs-2 fw-bold text-primary">{stats.total}</div>
                <div className="small text-muted">ประกาศทั้งหมด</div>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-0 rounded-4 h-100 shadow" style={{ background: 'rgba(255,255,255,0.95)' }}>
              <div className="card-body text-center py-3">
                <div style={{ fontSize: '2rem' }}>🟢</div>
                <div className="fs-2 fw-bold text-success">{stats.open}</div>
                <div className="small text-muted">กำลังเปิดรับ</div>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-0 rounded-4 h-100 shadow" style={{ background: 'rgba(255,255,255,0.95)' }}>
              <div className="card-body text-center py-3">
                <div style={{ fontSize: '2rem' }}>👥</div>
                <div className="fs-2 fw-bold text-info">{stats.totalApplicants}</div>
                <div className="small text-muted">ผู้สมัครทั้งหมด</div>
              </div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-0 rounded-4 h-100 shadow" style={{ background: 'rgba(255,255,255,0.95)' }}>
              <div className="card-body text-center py-3">
                <div style={{ fontSize: '2rem' }}>🔴</div>
                <div className="fs-2 fw-bold text-warning">{stats.full}</div>
                <div className="small text-muted">เต็มแล้ว</div>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="card border-0 rounded-4 shadow mb-4" style={{ background: 'rgba(255,255,255,0.95)' }}>
          <div className="card-body py-3">
            <div className="row g-3 align-items-center">
              <div className="col-md-4">
                <div className="input-group">
                  <span className="input-group-text bg-transparent border-end-0">🔍</span>
                  <input
                    type="text"
                    className="form-control border-start-0"
                    placeholder="ค้นหาประกาศ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-md-5">
                <div className="btn-group w-100" role="group">
                  {[
                    { key: 'all', label: 'ทั้งหมด', icon: '📋' },
                    { key: 'open', label: 'เปิดรับ', icon: '🟢' },
                    { key: 'full', label: 'เต็ม', icon: '🔴' },
                    { key: 'closed', label: 'ปิด', icon: '🔒' },
                  ].map(f => (
                    <button
                      key={f.key}
                      className={`btn ${filter === f.key ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setFilter(f.key)}
                    >
                      {f.icon} {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-md-3 text-end">
                <button
                  className="btn btn-success rounded-pill shadow-sm w-100"
                  onClick={() => navigate("/create-announcement")}
                >
                  ➕ สร้างประกาศใหม่
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center text-white py-5">
            <div className="spinner-border mb-3" style={{ width: '3rem', height: '3rem' }} />
            <div className="fs-5">กำลังโหลดข้อมูล...</div>
          </div>
        ) : err ? (
          <div className="alert alert-danger text-center rounded-4">{err}</div>
        ) : filteredRows.length === 0 ? (
          <div className="card border-0 rounded-4 shadow text-center py-5" style={{ background: 'rgba(255,255,255,0.95)' }}>
            <div style={{ fontSize: '4rem' }}>📭</div>
            <h5 className="text-muted mt-3">ไม่พบประกาศ</h5>
            <p className="text-muted">
              {rows.length === 0 ? 'ยังไม่มีประกาศ คลิก "สร้างประกาศใหม่" เพื่อเริ่มต้น' : 'ลองเปลี่ยนตัวกรองหรือคำค้นหา'}
            </p>
          </div>
        ) : (
          <div className="row g-4">
            {filteredRows.map((r) => {
              const pill = statusPill(r);
              const pct = r.capacity == null ? null : Math.min(100, Math.round((r.accepted_count / r.capacity) * 100));

              return (
                <div key={r.id} className="col-md-6 col-lg-4">
                  <div className="card border-0 shadow rounded-4 h-100 overflow-hidden" style={{ background: '#fff', transition: 'transform 0.2s, box-shadow 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.15)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}>

                    {/* Header */}
                    <div className="p-3 text-white" style={{ background: 'linear-gradient(135deg, #6f42c1 0%, #b388ff 100%)' }}>
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <span className="badge bg-white text-dark rounded-pill mb-2">ชั้นปี {r.year ?? "–"}</span>
                          <h6 className="fw-bold mb-0 text-truncate" title={r.title} style={{ maxWidth: 200 }}>
                            {r.title}
                          </h6>
                        </div>
                        <span className={`badge ${pill.cls} rounded-pill`}>
                          {pill.icon} {pill.text}
                        </span>
                      </div>
                    </div>

                    <div className="card-body d-flex flex-column">
                      <div className="small text-muted mb-2">
                        🏢 {r.department || "–"}
                      </div>

                      {/* Periods */}
                      {r.work_periods?.length > 0 && (
                        <div className="small mb-2 text-muted">
                          📅 {r.work_periods
                            .map((p) =>
                              p.end_date && p.end_date !== p.start_date
                                ? `${formatDateTH(p.start_date)}–${formatDateTH(p.end_date)}`
                                : formatDateTH(p.start_date)
                            )
                            .join(", ")}
                        </div>
                      )}

                      {r.deadline && (
                        <div className="small text-danger mb-2">
                          ⏰ ปิดรับ {formatDateTH(r.deadline)}
                        </div>
                      )}

                      {/* Progress */}
                      {r.capacity != null && (
                        <div className="mb-3">
                          <div className="d-flex justify-content-between small text-muted mb-1">
                            <span>ความคืบหน้า</span>
                            <span>{r.accepted_count}/{r.capacity}</span>
                          </div>
                          <div className="progress rounded-pill" style={{ height: 10 }}>
                            <div
                              className={`progress-bar ${pct < 70 ? 'bg-success' : pct < 90 ? 'bg-warning' : 'bg-danger'}`}
                              style={{ width: `${pct}%`, transition: 'width 0.5s' }}
                            />
                          </div>
                          <div className="small text-end text-muted mt-1">
                            เหลือ <b className="text-primary">{r.remaining}</b> ที่
                          </div>
                        </div>
                      )}

                      <p className="text-muted small flex-grow-1 mb-3" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {r.description || "—"}
                      </p>

                      {/* Actions */}
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-primary btn-sm flex-grow-1 rounded-pill"
                          onClick={() => navigate(`/announcements/${r.id}/applicants`)}
                        >
                          👥 จัดการผู้สมัคร
                        </button>
                        <button
                          className="btn btn-outline-secondary btn-sm rounded-pill"
                          onClick={() => navigate(`/announcements/${r.id}/edit`)}
                          title="แก้ไข"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm rounded-pill"
                          onClick={() => handleDelete(r.id)}
                          title="ลบ"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
