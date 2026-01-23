// src/pages/ApplicantsManagePage.jsx — Modern UI with gradient header and stats
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAnnouncement, listApplicants, changeApplicationStatus } from "../../services/announcementsApi";
import Swal from "sweetalert2";

/* === Status Labels === */
const COMPLETED_STATUS_TEXT = "ได้รับชั่วโมงแล้ว";

const STATUS_LABEL = {
  pending: "รอดำเนินการ",
  accepted: "อนุมัติแล้ว",
  rejected: "ปฏิเสธแล้ว",
  completed: COMPLETED_STATUS_TEXT,
};

const STATUS_CLASS = {
  pending: "bg-warning text-dark",
  accepted: "bg-success",
  rejected: "bg-danger",
  completed: "bg-info",
};

const StatusBadge = ({ status }) => (
  <span className={`badge rounded-pill ${STATUS_CLASS[status] || "bg-secondary"}`}>
    {status === "pending" && "⏳ "}
    {status === "accepted" && "✅ "}
    {status === "rejected" && "❌ "}
    {status === "completed" && "🏆 "}
    {STATUS_LABEL[status] || status}
  </span>
);

export default function ApplicantsManagePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ann, setAnn] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actingId, setActingId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const refreshAll = async () => {
    const [a, apps] = await Promise.all([getAnnouncement(id), listApplicants(id)]);
    setAnn(a);
    setRows(apps.items || apps || []);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        await refreshAll();
      } catch (e) {
        setErr(e?.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Stats
  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter(r => r.status === "pending").length,
    accepted: rows.filter(r => r.status === "accepted").length,
    rejected: rows.filter(r => r.status === "rejected").length,
    completed: rows.filter(r => r.status === "completed").length,
    occupied: rows.filter(r => r.status === "accepted" || r.status === "completed").length,
  }), [rows]);

  const filtered = useMemo(() => {
    const kw = searchDebounced.toLowerCase();
    return rows.filter(r => {
      const byKW = !kw ||
        String(r.username || "").toLowerCase().includes(kw) ||
        String(r.full_name || "").toLowerCase().includes(kw) ||
        String(STATUS_LABEL[r.status] || r.status || "").toLowerCase().includes(kw);
      const byStatus = statusFilter === "all" || r.status === statusFilter;
      return byKW && byStatus;
    });
  }, [rows, searchDebounced, statusFilter]);

  const capacity = ann?.capacity ?? null;
  const remaining = capacity != null ? Math.max(0, capacity - stats.occupied) : null;
  const progressPct = capacity ? Math.min(100, Math.round((stats.occupied / capacity) * 100)) : null;
  const canAcceptMore = capacity == null || stats.occupied < capacity;

  const doAction = async (app, action) => {
    if (action === "accept" && !canAcceptMore && app.status !== "accepted") {
      await Swal.fire("ที่นั่งเต็ม", "ไม่สามารถอนุมัติเพิ่มได้", "warning");
      return;
    }
    if (action === "complete" && app.status !== "accepted") {
      await Swal.fire("ยังไม่อนุมัติ", `ต้องอนุมัติก่อนจึงจะบันทึก "${COMPLETED_STATUS_TEXT}" ได้`, "info");
      return;
    }

    const verb = action === "accept" ? "อนุมัติ" : action === "reject" ? "ปฏิเสธ" : "บันทึกเสร็จสิ้น";
    const result = await Swal.fire({
      title: `ยืนยัน${verb}?`,
      text: `${app.full_name} (${app.username})`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ยืนยัน",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: action === "accept" ? "#198754" : action === "reject" ? "#dc3545" : "#0d6efd",
    });
    if (!result.isConfirmed) return;

    try {
      setActingId(app.id);
      await changeApplicationStatus(parseInt(app.id, 10), action);
      await refreshAll();
      await Swal.fire({ title: "สำเร็จ!", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (e) {
      await Swal.fire("เกิดข้อผิดพลาด", e?.message || "ดำเนินการไม่สำเร็จ", "error");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="min-vh-100 position-relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* Decorative */}
      <div className="position-absolute" style={{ top: -100, right: -100, width: 400, height: 400, background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }} />
      <div className="position-absolute" style={{ bottom: -150, left: -100, width: 500, height: 500, background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />

      {/* Top Bar */}
      <div className="py-3 px-4" style={{ background: 'rgba(0,0,0,0.1)' }}>
        <div className="container-xxl d-flex align-items-center">
          <div className="d-flex align-items-center">
            <img src="/csit.jpg" alt="Logo" className="rounded-3 shadow" style={{ height: 45, width: 45, objectFit: "cover" }} onError={(e) => (e.currentTarget.src = "/src/assets/csit.jpg")} />
            <div className="ms-3">
              <div className="text-white fw-bold">CSIT Competency System</div>
              <small className="text-white-50">จัดการผู้สมัคร</small>
            </div>
          </div>
          <div className="ms-auto d-flex gap-2">
            <button className="btn btn-outline-light btn-sm rounded-pill" onClick={() => navigate('/teacher-announcements')}>📢 ประกาศของฉัน</button>
            <button className="btn btn-light btn-sm rounded-pill" onClick={() => navigate(-1)}>← ย้อนกลับ</button>
          </div>
        </div>
      </div>

      <div className="container-xxl py-4 position-relative" style={{ zIndex: 1 }}>
        {/* Header Card */}
        <div className="card border-0 rounded-4 shadow mb-4 overflow-hidden" style={{ background: 'rgba(255,255,255,0.95)' }}>
          <div className="p-4 text-white" style={{ background: 'linear-gradient(135deg, #6f42c1 0%, #b388ff 100%)' }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <small className="opacity-75">ประกาศ</small>
                <h4 className="fw-bold mb-0">{ann?.title || "—"}</h4>
                <div className="opacity-75">👨‍🏫 {ann?.teacher_name || ann?.teacher || "-"}</div>
              </div>
              {capacity != null && (
                <div className="text-center">
                  <div className="display-4 fw-bold">{stats.occupied}/{capacity}</div>
                  <small>ที่นั่งที่ใช้</small>
                </div>
              )}
            </div>
          </div>

          {/* Progress */}
          {capacity != null && (
            <div className="px-4 py-3">
              <div className="d-flex justify-content-between small text-muted mb-1">
                <span>ความคืบหน้า</span>
                <span>เหลือ {remaining} ที่นั่ง</span>
              </div>
              <div className="progress rounded-pill" style={{ height: 12 }}>
                <div className={`progress-bar ${progressPct < 70 ? 'bg-success' : progressPct < 90 ? 'bg-warning' : 'bg-danger'}`} style={{ width: `${progressPct}%`, transition: 'width 0.5s' }} />
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="row g-3 mb-4">
          {[
            { key: 'all', label: 'ทั้งหมด', count: stats.total, icon: '📋', color: '#6c757d' },
            { key: 'pending', label: 'รอตรวจ', count: stats.pending, icon: '⏳', color: '#ffc107' },
            { key: 'accepted', label: 'อนุมัติ', count: stats.accepted, icon: '✅', color: '#198754' },
            { key: 'completed', label: COMPLETED_STATUS_TEXT, count: stats.completed, icon: '🏆', color: '#0dcaf0' },
            { key: 'rejected', label: 'ปฏิเสธ', count: stats.rejected, icon: '❌', color: '#dc3545' },
          ].map(s => (
            <div key={s.key} className="col">
              <button
                className={`card border-0 rounded-4 w-100 h-100 shadow-sm ${statusFilter === s.key ? 'ring-primary' : ''}`}
                style={{ background: statusFilter === s.key ? 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)' : 'white', border: statusFilter === s.key ? '2px solid #6f42c1' : 'none', cursor: 'pointer' }}
                onClick={() => setStatusFilter(s.key)}
              >
                <div className="card-body text-center py-3">
                  <div style={{ fontSize: '1.5rem' }}>{s.icon}</div>
                  <div className="fs-3 fw-bold" style={{ color: s.color }}>{s.count}</div>
                  <div className="small text-muted">{s.label}</div>
                </div>
              </button>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="card border-0 rounded-4 shadow mb-4" style={{ background: 'rgba(255,255,255,0.95)' }}>
          <div className="card-body py-3">
            <div className="input-group">
              <span className="input-group-text bg-transparent border-end-0">🔍</span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="ค้นหา รหัสนิสิต / ชื่อ / สถานะ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center text-white py-5">
            <div className="spinner-border mb-3" style={{ width: '3rem', height: '3rem' }} />
            <div className="fs-5">กำลังโหลดข้อมูล...</div>
          </div>
        ) : err ? (
          <div className="alert alert-danger rounded-4">{err}</div>
        ) : filtered.length === 0 ? (
          <div className="card border-0 rounded-4 shadow text-center py-5" style={{ background: 'rgba(255,255,255,0.95)' }}>
            <div style={{ fontSize: '4rem' }}>🤔</div>
            <h5 className="text-muted mt-3">ไม่พบผู้สมัคร</h5>
            <p className="text-muted">{rows.length === 0 ? 'ยังไม่มีผู้สมัครในประกาศนี้' : 'ลองเปลี่ยนตัวกรองหรือคำค้นหา'}</p>
          </div>
        ) : (
          <div className="card border-0 rounded-4 shadow overflow-hidden" style={{ background: 'rgba(255,255,255,0.95)' }}>
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead style={{ background: 'linear-gradient(90deg, #f8f9fa, #e9ecef)' }}>
                  <tr>
                    <th className="ps-4">รหัสนิสิต</th>
                    <th>ชื่อ-นามสกุล</th>
                    <th className="text-center">สถานะ</th>
                    <th className="text-end pe-4">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, idx) => {
                    const isActing = actingId === r.id;
                    const disableAccept = r.status === "accepted" || r.status === "completed" || isActing || (!canAcceptMore && r.status !== "accepted");
                    const disableComplete = r.status !== "accepted" || isActing;
                    const disableReject = r.status === "rejected" || isActing;

                    return (
                      <tr key={r.id} style={{ background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td className="ps-4 fw-medium">{r.username}</td>
                        <td>{r.full_name}</td>
                        <td className="text-center"><StatusBadge status={r.status} /></td>
                        <td className="text-end pe-4">
                          <div className="btn-group">
                            <button
                              className="btn btn-success btn-sm rounded-pill me-1"
                              disabled={disableAccept}
                              onClick={() => doAction(r, "accept")}
                              title={!canAcceptMore && r.status !== "accepted" ? "ที่นั่งเต็ม" : "อนุมัติ"}
                            >
                              {isActing ? <span className="spinner-border spinner-border-sm" /> : "✅ อนุมัติ"}
                            </button>
                            <button
                              className="btn btn-info btn-sm rounded-pill me-1"
                              disabled={disableComplete}
                              onClick={() => doAction(r, "complete")}
                            >
                              {isActing ? <span className="spinner-border spinner-border-sm" /> : "🏆 เสร็จสิ้น"}
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm rounded-pill"
                              disabled={disableReject}
                              onClick={() => doAction(r, "reject")}
                            >
                              {isActing ? <span className="spinner-border spinner-border-sm" /> : "❌"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="card-footer bg-white">
              <small className="text-muted">แสดง {filtered.length} จาก {rows.length} รายการ</small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
