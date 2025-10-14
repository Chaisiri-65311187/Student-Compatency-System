// src/pages/TeacherAnnouncementsPage.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { listMyAnnouncements, deleteAnnouncement } from "../services/announcementsApi";
import Swal from "sweetalert2";

const tz = "Asia/Bangkok";
function formatDateTH(s) {
  if (!s) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: tz,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(s));
}

export default function TeacherAnnouncementsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await listMyAnnouncements(user.id);
        setRows(r.items || []);
      } catch (e) {
        setErr(e?.message || "โหลดรายการไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const handleDelete = async (id) => {
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
  };

  if (!user) return null;

  return (
    <div
      className="min-vh-100"
      style={{ background: "linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%)" }}
    >
      {/* 🔹 Top Bar */}
      <div
        className="d-flex align-items-center px-3"
        style={{
          height: 72,
          background: "linear-gradient(90deg,#6f42c1,#8e5cff)",
          boxShadow: "0 4px 14px rgba(111,66,193,.22)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <img
          src="/src/assets/csit.jpg"
          alt="Logo"
          className="rounded-3 me-3"
          style={{ width: 40, height: 40, objectFit: "cover" }}
        />
        <h5 className="text-white fw-semibold m-0">
          CSIT Competency System — Teacher
        </h5>
        <div className="ms-auto d-flex align-items-center">
          <span className="text-white-50 me-3">
            {user?.full_name || user?.username}
          </span>
          <button
            className="btn btn-light btn-sm rounded-pill"
            onClick={() => {
              if (logout) logout();
              navigate("/login");
            }}
          >
            ออกจากระบบ
          </button>
        </div>
      </div>

      {/* 🔹 Content */}
      <div className="container-xxl py-4">
        {/* Toolbar: ปุ่มย้อนกลับ + สร้างใหม่ */}
        <div className="d-flex flex-wrap align-items-center gap-2 mb-4">
          <button
            className="btn btn-outline-secondary rounded-pill"
            onClick={() => navigate(-1)}
          >
            ← ย้อนกลับ
          </button>
          <h3 className="m-0 fw-semibold flex-grow-1">ประกาศของฉัน</h3>
          <button
            className="btn btn-primary rounded-pill shadow-sm"
            onClick={() => navigate("/create-announcement")}
          >
            <i className="bi bi-plus-circle me-1"></i> สร้างประกาศใหม่
          </button>
        </div>

        {/* Loading / Error / Empty */}
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
            {rows.map((r) => (
              <div key={r.id} className="col-md-6 col-lg-4">
                <div className="card shadow-sm border-0 rounded-4 h-100 overflow-hidden">
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
                      className={`badge position-absolute top-0 end-0 m-2 ${
                        r.status === "open"
                          ? "bg-success"
                          : r.status === "closed"
                          ? "bg-secondary"
                          : "bg-dark"
                      }`}
                    >
                      {r.status === "open"
                        ? "เปิดรับ"
                        : r.status === "closed"
                        ? "ปิดรับ"
                        : "เก็บถาวร"}
                    </span>
                  </div>

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

                    {Array.isArray(r.work_periods) && r.work_periods.length ? (
                      <div className="small mb-2 text-muted">
                        <i className="bi bi-calendar-event me-1" />
                        {r.work_periods
                          .map(
                            (p) =>
                              `${formatDateTH(p.start_date)}${
                                p.end_date ? "–" + formatDateTH(p.end_date) : ""
                              }`
                          )
                          .join(", ")}
                      </div>
                    ) : null}

                    {r.deadline && (
                      <div className="small text-muted mb-2">
                        <i className="bi bi-hourglass me-1" />
                        ปิดรับ {formatDateTH(r.deadline)}
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

                    <div className="mt-auto d-flex justify-content-between">
                      <button
                        className="btn btn-outline-primary btn-sm rounded-pill px-3"
                        onClick={() => navigate(`/announcements/${r.id}/edit`)}
                      >
                        <i className="bi bi-pencil me-1"></i>แก้ไข
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm rounded-pill px-3"
                        onClick={() => handleDelete(r.id)}
                      >
                        <i className="bi bi-trash me-1"></i>ลบ
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* local style */}
      <style>{`
        .btn:focus, .form-control:focus, .form-select:focus {
          box-shadow: 0 0 0 .2rem rgba(111,66,193,.12);
          border-color: #8e5cff;
        }
      `}</style>
    </div>
  );
}
