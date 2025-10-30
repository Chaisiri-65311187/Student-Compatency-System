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
  if (r.status === "closed") return { text: "ปิดรับ", cls: "bg-secondary" };
  if (r.status !== "open") return { text: "เก็บถาวร", cls: "bg-dark" };
  if (full) return { text: "เต็มแล้ว", cls: "bg-warning text-dark" };
  return { text: "เปิดรับ", cls: "bg-success" };
}

export default function TeacherAnnouncementsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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

  const handleDelete = useCallback(
    async (id) => {
      const c = await Swal.fire({
        title: "ยืนยันการลบ?",
        text: "ประกาศนี้จะถูกลบถาวร",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "ลบ",
        cancelButtonText: "ยกเลิก",
      });
      if (!c.isConfirmed) return;
      try {
        await deleteAnnouncement(id, user.id);
        setRows((prev) => prev.filter((x) => x.id !== id));
        Swal.fire("ลบสำเร็จ!", "", "success");
      } catch (e) {
        Swal.fire("ลบไม่สำเร็จ", e?.message || "เกิดข้อผิดพลาด", "error");
      }
    },
    [user?.id]
  );

  if (!user) return null;

  return (
    <div className="min-vh-100 position-relative overflow-hidden bg-animated">
      <div className="bg-blob bg-blob-1" aria-hidden="true" />
      <div className="bg-blob bg-blob-2" aria-hidden="true" />
      <div className="bg-blob bg-blob-3" aria-hidden="true" />

      {/* Top bar */}
      <div className="hero-bar topbar glassy" style={{ height: 72 }}>
        <div className="container-xxl d-flex align-items-center h-100">
          <div className="d-flex align-items-center">
            <img
              src="/csit.jpg"
              alt="Logo"
              className="rounded-3 shadow-sm"
              style={{ height: 40, width: 40, objectFit: "cover" }}
              onError={(e) => (e.currentTarget.src = "/src/assets/csit.jpg")}
            />
            <div className="ms-3 text-white fw-semibold">CSIT Competency System</div>
          </div>
          <div className="ms-auto">
            <button className="btn btn-light btn-sm rounded-pill ripple" onClick={() => navigate(-1)}>
              ← ย้อนกลับ
            </button>
          </div>
        </div>
      </div>

      <div className="container-xxl py-4">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <h3 className="fw-semibold m-0">ประกาศของฉัน</h3>
          <button
            className="btn btn-primary rounded-pill shadow-sm"
            onClick={() => navigate("/create-announcement")}
          >
            <i className="bi bi-plus-circle me-1" />
            สร้างประกาศใหม่
          </button>
        </div>

        {loading ? (
          <div className="text-center text-muted py-5">
            <div className="spinner-border text-primary mb-3" />
            <div>กำลังโหลดข้อมูล...</div>
          </div>
        ) : err ? (
          <div className="alert alert-danger text-center">{err}</div>
        ) : rows.length === 0 ? (
          <div className="alert alert-secondary text-center py-4">
            <i className="bi bi-info-circle me-2" />ยังไม่มีประกาศ
          </div>
        ) : (
          <div className="row g-4">
            {rows.map((r) => {
              const pill = statusPill(r);
              const pct =
                r.capacity == null
                  ? null
                  : Math.min(100, Math.round((r.accepted_count / r.capacity) * 100));
              const barColor =
                pct == null
                  ? "bg-secondary"
                  : pct < 70
                    ? "bg-success"
                    : pct < 90
                      ? "bg-warning"
                      : "bg-danger";
              return (
                <div key={r.id} className="col-md-6 col-lg-4">
                  <div className="card border-0 shadow-sm rounded-4 h-100 glass-card">
                    <div
                      className="ratio"
                      style={{
                        aspectRatio: "21/9",
                        background: "linear-gradient(135deg,#6f42c1,#b388ff)",
                        position: "relative",
                      }}
                    >
                      <span
                        className="badge bg-light text-dark fw-bold position-absolute bottom-0 start-0 m-2"
                      >
                        ชั้นปี {r.year ?? "–"}
                      </span>
                      <span className={`badge position-absolute top-0 end-0 m-2 ${pill.cls}`}>
                        {pill.text}
                      </span>
                    </div>

                    <div className="card-body d-flex flex-column">
                      <h6 className="fw-semibold mb-1 text-truncate" title={r.title}>
                        {r.title}
                      </h6>
                      <div className="small text-muted mb-2">
                        {r.department || "–"} · ปี {r.year ?? "–"}
                      </div>

                      {/* Periods */}
                      {r.work_periods?.length > 0 && (
                        <div className="small mb-2 text-muted">
                          <i className="bi bi-calendar-event me-1" />
                          {r.work_periods
                            .map((p) =>
                              p.end_date && p.end_date !== p.start_date
                                ? `${formatDateTH(p.start_date)}–${formatDateTH(p.end_date)}`
                                : formatDateTH(p.start_date)
                            )
                            .join(", ")}
                        </div>
                      )}

                      {r.deadline && (
                        <div className="small text-muted mb-2">
                          <i className="bi bi-hourglass me-1" />ปิดรับ {formatDateTH(r.deadline)}
                        </div>
                      )}

                      {/* Progress */}
                      {r.capacity != null && (
                        <div className="mb-2">
                          <div className="progress" style={{ height: 8 }}>
                            <div
                              className={`progress-bar ${barColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="small text-muted mt-1">
                            อนุมัติแล้ว {r.accepted_count} / {r.capacity} · เหลือ{" "}
                            {r.remaining}
                          </div>
                        </div>
                      )}

                      <p
                        className="text-muted small flex-grow-1 mb-2"
                        style={{
                          whiteSpace: "pre-wrap",
                          maxHeight: "3.5em",
                          overflow: "hidden",
                        }}
                      >
                        {r.description || "—"}
                      </p>

                      <div className="mt-auto d-flex gap-2">
                        <button
                          className="btn btn-outline-primary btn-sm w-50"
                          onClick={() => navigate(`/announcements/${r.id}/applicants`)}
                        >
                          <i className="bi bi-people me-1" /> จัดการผู้สมัคร
                        </button>
                        <button
                          className="btn btn-outline-secondary btn-sm w-25"
                          onClick={() => navigate(`/announcements/${r.id}/edit`)}
                        >
                          <i className="bi bi-pencil-square me-1" /> แก้ไข
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm w-25"
                          onClick={() => handleDelete(r.id)}
                        >
                          <i className="bi bi-trash me-1" /> ลบ
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

      <style>{`
        .bg-animated {
          background: radial-gradient(1200px 600px at 10% -10%, #efe7ff 15%, transparent 60%),
                      radial-gradient(1000px 500px at 110% 10%, #e6f0ff 10%, transparent 55%),
                      linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%);
        }
        .glassy{backdrop-filter:blur(8px);}
        .topbar{position:sticky;top:0;z-index:1040;background:linear-gradient(90deg,rgba(111,66,193,.9),rgba(142,92,255,.9));box-shadow:0 4px 16px rgba(111,66,193,.22);}
        .glass-card{transition:.15s;backdrop-filter:blur(6px);}
        .glass-card:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(28,39,49,.12)!important;}
        .bg-blob{position:absolute;filter:blur(60px);opacity:.55;z-index:0;}
        .bg-blob-1{width:420px;height:420px;left:-120px;top:-80px;background:#d7c6ff;animation:drift1 18s ease-in-out infinite;}
        .bg-blob-2{width:360px;height:360px;right:-120px;top:120px;background:#c6ddff;animation:drift2 22s ease-in-out infinite;}
        .bg-blob-3{width:300px;height:300px;left:15%;bottom:-120px;background:#ffd9ec;animation:drift3 20s ease-in-out infinite;}
        @keyframes drift1{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,10px)}}
        @keyframes drift2{0%,100%{transform:translate(0,0)}50%{transform:translate(-16px,8px)}}
        @keyframes drift3{0%,100%{transform:translate(0,0)}50%{transform:translate(12px,-12px)}}
      `}</style>
    </div>
  );
}
