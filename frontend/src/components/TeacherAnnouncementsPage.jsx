// src/pages/TeacherAnnouncementsPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  listMyAnnouncements,
  deleteAnnouncement,
} from "../services/announcementsApi";
import Swal from "sweetalert2";

/* ===== helpers (TH time-safe) ===== */
const tz = "Asia/Bangkok";

/** แปลงสตริงวันที่แบบ YYYY-MM-DD ให้เป็น Date (local) เพื่อเลี่ยงการโดน shift เป็น UTC */
function parseSafeDate(s) {
  if (!s) return null;
  const str = String(s);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTH(s) {
  const d = s instanceof Date ? s : parseSafeDate(s);
  if (!d) return "–";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: tz,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** แปลงค่าความจุ/จำนวนคงเหลือให้อ่านง่าย */
function normalizeItem(x) {
  const rawCap = x.capacity;
  const capacity =
    rawCap == null || String(rawCap).trim() === "" ? null : Number(rawCap);

  const accepted = Number.isFinite(Number(x.accepted_count))
    ? Number(x.accepted_count)
    : 0;

  const remaining = capacity == null ? null : Math.max(0, capacity - accepted);

  return {
    ...x,
    capacity,
    accepted_count: accepted,
    remaining,
    work_periods: Array.isArray(x.work_periods) ? x.work_periods : [],
  };
}

/** label + class สำหรับสถานะ (รวมเคสเต็มแล้ว) */
function statusPill(r) {
  const full = r.capacity != null && (r.remaining ?? 0) <= 0;
  if (r.status === "closed") {
    return { text: "ปิดรับ", cls: "bg-secondary" };
  }
  if (r.status !== "open") {
    return { text: "เก็บถาวร", cls: "bg-dark" };
  }
  if (full) {
    return { text: "เต็มแล้ว", cls: "bg-warning text-dark" };
  }
  return { text: "เปิดรับ", cls: "bg-success" };
}

export default function TeacherAnnouncementsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // gatekeeping: ต้องเป็นครูเท่านั้น
  useEffect(() => {
    if (!user) return;
    if (user.role !== "teacher") {
      navigate("/home", { replace: true });
    }
  }, [user, navigate]);

  const fetchData = useCallback(async (teacherId) => {
    setLoading(true);
    setErr("");
    try {
      const r = await listMyAnnouncements(teacherId);
      const rawItems = Array.isArray(r) ? r : r?.items || [];
      const items = rawItems.map(normalizeItem);
      setRows(items);
    } catch (e) {
      setErr(e?.message || "โหลดรายการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  // load once user ready
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      await fetchData(user.id);
    })();
    return () => {
      alive = false; // เผื่ออนาคตสลับเป็น fetch แบบยกเลิกได้
    };
  }, [user?.id, fetchData]);

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
      {/* Decorative background blobs */}
      <div className="bg-blob bg-blob-1" aria-hidden="true" />
      <div className="bg-blob bg-blob-2" aria-hidden="true" />
      <div className="bg-blob bg-blob-3" aria-hidden="true" />

      {/* Top Bar */}
      <div className="hero-bar topbar glassy" style={{ height: 72 }}>
        <div className="container-xxl d-flex align-items-center h-100">
          <div className="d-flex align-items-center">
            {/* แนะนำให้ย้ายโลโก้ไปโฟลเดอร์ public แล้วใช้ /csit.jpg */}
            <img
              src="/csit.jpg"
              alt="Logo"
              className="rounded-3 shadow-sm"
              style={{ height: 40, width: 40, objectFit: "cover" }}
              onError={(e) => {
                // fallback กรณีมีรูปใน src/assets
                e.currentTarget.src = "/src/assets/csit.jpg";
              }}
            />
            <div className="ms-3 text-white fw-semibold">
              CSIT Competency System
            </div>
          </div>
          <div className="ms-auto d-flex align-items-center">
            <button
              className="btn btn-light btn-sm rounded-pill ripple"
              onClick={() => navigate(-1)}
            >
              ← ย้อนกลับ
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container-xxl py-4">
        {/* Toolbar */}
        <div className="d-flex flex-wrap align-items-center gap-2 mb-4">
          <h3 className="m-0 fw-semibold flex-grow-1">ประกาศของฉัน</h3>
          <button
            className="btn btn-primary rounded-pill shadow-sm"
            onClick={() => navigate("/create-announcement")}
          >
            <i className="bi bi-plus-circle me-1"></i> สร้างประกาศใหม่
          </button>
        </div>

        {/* Loading / Error / Empty / List */}
        {loading ? (
          <div className="text-center text-muted py-5">
            <div className="spinner-border text-primary mb-3" />
            <div>กำลังโหลดข้อมูล...</div>
          </div>
        ) : err ? (
          <div className="alert alert-danger text-center">{err}</div>
        ) : rows.length === 0 ? (
          <div className="alert alert-secondary text-center py-4">
            <i className="bi bi-info-circle me-2"></i>ยังไม่มีประกาศ
          </div>
        ) : (
          <div className="row g-4">
            {rows.map((r) => {
              const pill = statusPill(r);
              return (
                <div key={r.id} className="col-md-6 col-lg-4">
                  <div className="card shadow-sm border-0 rounded-4 h-100 overflow-hidden glass-card">
                    {/* Banner */}
                    <div
                      className="ratio"
                      style={{
                        aspectRatio: "21/9",
                        background:
                          "linear-gradient(135deg, #6f42c1, #b388ff)",
                        position: "relative",
                      }}
                    >
                      <span
                        className="badge bg-light text-dark fw-bold position-absolute bottom-0 start-0 m-2"
                        style={{ fontSize: "0.9rem" }}
                      >
                        ชั้นปี {r.year ?? "—"}
                      </span>

                      <span
                        className={`badge position-absolute top-0 end-0 m-2 ${pill.cls}`}
                      >
                        {pill.text}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="card-body d-flex flex-column">
                      <h6
                        className="fw-semibold mb-1 text-truncate"
                        title={r.title}
                      >
                        {r.title}
                      </h6>
                      <div className="small text-muted mb-2">
                        {r.department || "—"} · ชั้นปี {r.year ?? "—"}
                      </div>

                      {/* Work periods */}
                      {Array.isArray(r.work_periods) &&
                      r.work_periods.length > 0 ? (
                        <div className="small mb-2 text-muted">
                          <i className="bi bi-calendar-event me-1" />
                          {r.work_periods
                            .map((p) =>
                              p.end_date && p.end_date !== p.start_date
                                ? `${formatDateTH(p.start_date)}–${formatDateTH(
                                    p.end_date
                                  )}`
                                : `${formatDateTH(p.start_date)}`
                            )
                            .join(", ")}
                        </div>
                      ) : null}

                      {/* Deadline */}
                      {r.deadline && (
                        <div className="small text-muted mb-2">
                          <i className="bi bi-hourglass me-1" />
                          ปิดรับ {formatDateTH(r.deadline)}
                        </div>
                      )}

                      {/* Capacity / Remaining */}
                      <div className="small mb-2">
                        <i className="bi bi-people me-1" />
                        {r.capacity == null ? (
                          <>รับ: ไม่จำกัด</>
                        ) : (
                          <>
                            รับ: {Math.max(0, r.remaining ?? 0)} / {r.capacity}
                          </>
                        )}
                      </div>

                      {/* Description */}
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

                      {/* Actions */}
                      <div className="mt-auto d-flex justify-content-between flex-wrap gap-2">
                        <div className="btn-group w-100">
                          <button
                            className="btn btn-outline-primary btn-sm w-50"
                            onClick={() =>
                              navigate(`/announcements/${r.id}/applicants`)
                            }
                          >
                            <i className="bi bi-people me-1"></i> จัดการผู้สมัคร
                          </button>
                          <button
                            className="btn btn-outline-secondary btn-sm w-25"
                            onClick={() => navigate(`/announcements/${r.id}/edit`)}
                          >
                            <i className="bi bi-pencil-square me-1"></i> แก้ไข
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm w-25"
                            onClick={() => handleDelete(r.id)}
                          >
                            <i className="bi bi-trash me-1"></i> ลบ
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

       {/* style */}
      <style>{`
        /* Animated background & blobs */
        .bg-animated{background:radial-gradient(1200px 600px at 10% -10%, #efe7ff 15%, transparent 60%),radial-gradient(1000px 500px at 110% 10%, #e6f0ff 10%, transparent 55%),linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%);} 
        .glassy{backdrop-filter:blur(8px);} 
        .topbar{position:sticky;top:0;left:0;width:100%;background:linear-gradient(90deg, rgba(111,66,193,.9), rgba(142,92,255,.9));box-shadow:0 4px 16px rgba(111,66,193,.22);z-index:1040;border-bottom:1px solid rgba(255,255,255,.12);} 

        /* Floating motion */
        .card-float{animation:floatY 6s ease-in-out infinite;} 
        @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}

        .glass-card { backdrop-filter: blur(6px); transition: transform .15s ease, box-shadow .15s ease; }
        .glass-card:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(28,39,49,.12)!important; }
        .ratio-21x9 { aspect-ratio: 21/9; width: 100%; background: #e9ecef; }
        .year-pill { font-weight: 700; }
        .form-control:focus { box-shadow: 0 0 0 .2rem rgba(111,66,193,.12); border-color: #8e5cff; }
        .wave{position:fixed;left:0;right:0;bottom:-1px;width:100%;height:120px;}

        /* Ripple */
        .ripple{position:relative;overflow:hidden;} 
        .ripple:after{content:"";position:absolute;inset:0;border-radius:inherit;opacity:0;background:radial-gradient(circle at var(--x,50%) var(--y,50%), rgba(255,255,255,.45), transparent 40%);transform:scale(.2);transition:transform .3s, opacity .45s;pointer-events:none;} 
        .ripple:active:after{opacity:1;transform:scale(1);transition:0s;} 
        .ripple{--x:50%;--y:50%;} 
        .ripple:focus-visible{outline:3px solid rgba(142,92,255,.45);outline-offset:2px;}

        /* Blobs */
        .bg-blob{position:absolute;filter:blur(60px);opacity:.55;z-index:0;} 
        .bg-blob-1{width:420px;height:420px;left:-120px;top:-80px;background:#d7c6ff;animation:drift1 18s ease-in-out infinite;} 
        .bg-blob-2{width:360px;height:360px;right:-120px;top:120px;background:#c6ddff;animation:drift2 22s ease-in-out infinite;} 
        .bg-blob-3{width:300px;height:300px;left:15%;bottom:-120px;background:#ffd9ec;animation:drift3 20s ease-in-out infinite;} 
        @keyframes drift1{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,10px)}} 
        @keyframes drift2{0%,100%{transform:translate(0,0)}50%{transform:translate(-16px,8px)}} 
        @keyframes drift3{0%,100%{transform:translate(0,0)}50%{transform:translate(12px,-12px)}} 
      `}</style>

      {/* ripple positioning script */}
      <script dangerouslySetInnerHTML={{
        __html: `
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
