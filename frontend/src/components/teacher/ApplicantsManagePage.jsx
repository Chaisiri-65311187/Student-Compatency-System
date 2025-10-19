// src/pages/ApplicantsManagePage.jsx — refined UI (with Swal + capacity guard)
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAnnouncement, listApplicants, changeApplicationStatus } from "../../services/announcementsApi";
import Swal from "sweetalert2";

const StatusBadge = ({ status }) => {
  const cls =
    status === "accepted"
      ? "badge text-bg-success"
      : status === "rejected"
        ? "badge text-bg-danger"
        : "badge text-bg-secondary";
  const label =
    status === "accepted" ? "อนุมัติแล้ว" : status === "rejected" ? "ปฏิเสธแล้ว" : "รอดำเนินการ";
  return <span className={cls}>{label}</span>;
};

const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`btn btn-sm ${active ? "btn-primary" : "btn-outline-secondary"}`}
    style={{ borderRadius: 999 }}
  >
    {children}
  </button>
);

export default function ApplicantsManagePage() {
  const { id } = useParams(); // announcement id
  const navigate = useNavigate();

  const [ann, setAnn] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | pending | accepted | rejected
  const [actingId, setActingId] = useState(null); // แสดงสปินเนอร์เฉพาะแถวที่กำลังกด
  const [liveMsg, setLiveMsg] = useState("");

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

  const acceptedCount = useMemo(() => rows.filter((r) => r.status === "accepted").length, [rows]);
  const pendingCount = useMemo(() => rows.filter((r) => r.status === "pending").length, [rows]);
  const rejectedCount = useMemo(() => rows.filter((r) => r.status === "rejected").length, [rows]);

  const filtered = useMemo(() => {
    const kw = searchDebounced.toLowerCase();
    return rows.filter((r) => {
      const byKW =
        !kw ||
        String(r.username || "").toLowerCase().includes(kw) ||
        String(r.full_name || "").toLowerCase().includes(kw) ||
        String(r.status || "").toLowerCase().includes(kw);
      const byStatus = statusFilter === "all" ? true : r.status === statusFilter;
      return byKW && byStatus;
    });
  }, [rows, searchDebounced, statusFilter]);

  const capacity = ann?.capacity ?? null;
  const remaining = ann?.remaining ?? (capacity != null ? Math.max(0, capacity - acceptedCount) : null);
  const progressPct =
    capacity != null && capacity > 0 ? Math.min(100, Math.round((acceptedCount / capacity) * 100)) : null;

  const canAcceptMore = capacity == null || acceptedCount < capacity;

  const progressColor = (() => {
    if (progressPct == null) return "bg-secondary";
    if (progressPct < 70) return "bg-success";
    if (progressPct < 90) return "bg-warning";
    return "bg-danger";
  })();

  const doAction = async (app, action) => {
    if (action === "accept" && !canAcceptMore && app.status !== "accepted") {
      await Swal.fire("ที่นั่งเต็ม", "ไม่สามารถอนุมัติเพิ่มได้เพราะครบจำนวนแล้ว", "warning");
      return;
    }

    const verb = action === "accept" ? "อนุมัติ" : "ปฏิเสธ";
    const result = await Swal.fire({
      title: `ยืนยัน${verb}?`,
      text: `${app.full_name} (${app.username})`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: `ยืนยัน`,
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: action === "accept" ? "#198754" : "#dc3545",
    });
    if (!result.isConfirmed) return;

    try {
      setActingId(app.id);
      await changeApplicationStatus(id, app.id, action);
      setLiveMsg(`${verb}เรียบร้อย: ${app.full_name}`);
      await refreshAll(); // refresh ทั้งหัว/ตาราง (อัปเดต remaining/progress)
      await Swal.fire("สำเร็จ", `${verb}ผู้สมัครเรียบร้อย`, "success");
    } catch (e) {
      setLiveMsg(`ผิดพลาด: ${e?.message || "ดำเนินการไม่สำเร็จ"}`);
      await Swal.fire("เกิดข้อผิดพลาด", e?.message || "ดำเนินการไม่สำเร็จ", "error");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="min-vh-100 position-relative overflow-hidden bg-animated">
      {/* Decorative background blobs */}
      <div className="bg-blob bg-blob-1" aria-hidden="true" />
      <div className="bg-blob bg-blob-2" aria-hidden="true" />
      <div className="bg-blob bg-blob-3" aria-hidden="true" />
      {/* Top Bar – ให้เหมือนทุกหน้า */}
      <div className="hero-bar topbar glassy" style={{ height: 72 }}>
        <div className="container-xxl d-flex align-items-center h-100">
          <div className="d-flex align-items-center">
            <img src="/src/assets/csit.jpg" alt="Logo" className="rounded-3 shadow-sm" style={{ height: 40, width: 40, objectFit: "cover" }} />
            <div className="ms-3 text-white fw-semibold">CSIT Competency System</div>
          </div>
          <div className="ms-auto d-flex align-items-center">
            <button className="btn btn-light btn-sm rounded-pill ripple" onClick={() => navigate(-1)}>
              ← ย้อนกลับ
            </button>
          </div>
        </div>
      </div>

      <div className="container-xxl py-4">
        {/* Header card */}
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body d-flex flex-wrap gap-3 align-items-center">
            <div className="me-auto">
              <div className="small text-muted mb-1">ประกาศ</div>
              <div className="fw-semibold fs-5">{ann?.title || "—"}</div>
              <div className="text-muted small">
                อาจารย์ผู้รับผิดชอบ: {ann?.teacher_name || ann?.teacher || "-"}
              </div>
            </div>

            {/* capacity / progress */}
            <div style={{ minWidth: 300 }}>
              <div className="small text-muted">สถานะที่นั่ง</div>
              {capacity == null ? (
                <div className="badge text-bg-light fs-6">รับ: ไม่จำกัด</div>
              ) : (
                <>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-valuenow={progressPct || 0}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    style={{ height: 10 }}
                    aria-label="ความคืบหน้าการอนุมัติ"
                  >
                    <div className={`progress-bar ${progressColor}`} style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="mt-1 small text-muted">
                    อนุมัติแล้ว {acceptedCount} / {capacity} · เหลือ {remaining}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body d-flex flex-wrap gap-2 align-items-center">
            <h5 className="m-0 me-auto">จัดการผู้สมัคร</h5>

            {/* status chips */}
            <div className="d-flex flex-wrap gap-2">
              <Chip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
                ทั้งหมด ({rows.length})
              </Chip>
              <Chip active={statusFilter === "pending"} onClick={() => setStatusFilter("pending")}>
                รอตรวจ ({pendingCount})
              </Chip>
              <Chip active={statusFilter === "accepted"} onClick={() => setStatusFilter("accepted")}>
                อนุมัติแล้ว ({acceptedCount})
              </Chip>
              <Chip active={statusFilter === "rejected"} onClick={() => setStatusFilter("rejected")}>
                ปฏิเสธแล้ว ({rejectedCount})
              </Chip>
            </div>

            <div className="position-relative ms-auto" style={{ minWidth: 260 }}>
              <i className="bi bi-search position-absolute" style={{ left: 12, top: 10, opacity: 0.5 }} />
              <input
                type="text"
                className="form-control ps-5 rounded-pill"
                placeholder="ค้นหา รหัสนิสิต / ชื่อ / สถานะ"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="กล่องค้นหาผู้สมัคร"
              />
            </div>
          </div>
        </div>

        {/* live region for SR */}
        <div className="visually-hidden" aria-live="polite">{liveMsg}</div>

        {/* Content */}
        {loading ? (
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body">
              {/* skeleton rows */}
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="placeholder-wave mb-3">
                  <span className="placeholder col-3 me-2"></span>
                  <span className="placeholder col-4 me-2"></span>
                  <span className="placeholder col-2"></span>
                </div>
              ))}
              <div className="text-muted small">
                <span className="spinner-border spinner-border-sm me-2" />
                กำลังโหลดผู้สมัคร…
              </div>
            </div>
          </div>
        ) : err ? (
          <div className="alert alert-danger rounded-4">{err}</div>
        ) : filtered.length === 0 ? (
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body text-center text-muted py-5">
              <div className="mb-2" style={{ fontSize: 24 }}>🤔</div>
              ยังไม่มีผู้สมัครหรือไม่ตรงกับการค้นหา
            </div>
          </div>
        ) : (
          <div className="card border-0 shadow-sm rounded-4">
            <div className="table-responsive">
              <table className="table align-middle mb-0 table-hover">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 160 }}>รหัสนิสิต</th>
                    <th>ชื่อ</th>
                    <th style={{ width: 140 }}>สถานะ</th>
                    <th className="text-end" style={{ width: 240 }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const disableAccept =
                      r.status === "accepted" || actingId === r.id || (!canAcceptMore && r.status !== "accepted");
                    const acceptTitle = !canAcceptMore && r.status !== "accepted" ? "ที่นั่งเต็ม" : "อนุมัติ";
                    return (
                      <tr
                        key={r.id}
                        className={
                          r.status === "accepted"
                            ? "table-success-subtle"
                            : r.status === "rejected"
                              ? "table-danger-subtle"
                              : ""
                        }
                      >
                        <td className="fw-medium">{r.username}</td>
                        <td>{r.full_name}</td>
                        <td><StatusBadge status={r.status} /></td>
                        <td className="text-end">
                          <div className="btn-group">
                            <button
                              className="btn btn-outline-success btn-sm"
                              disabled={disableAccept}
                              onClick={() => doAction(r, "accept")}
                              title={acceptTitle}
                              aria-label={`อนุมัติ ${r.full_name}`}
                            >
                              {actingId === r.id ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-2" />
                                  กำลังอนุมัติ…
                                </>
                              ) : (
                                "อนุมัติ"
                              )}
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm"
                              disabled={r.status === "rejected" || actingId === r.id}
                              onClick={() => doAction(r, "reject")}
                              aria-label={`ปฏิเสธ ${r.full_name}`}
                            >
                              {actingId === r.id ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-2" />
                                  กำลังปฏิเสธ…
                                </>
                              ) : (
                                "ปฏิเสธ"
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer summary */}
            <div className="card-footer bg-white rounded-4">
              <div className="small text-muted">
                ทั้งหมด {rows.length.toLocaleString("th-TH")} รายการ · แสดง{" "}
                {filtered.length.toLocaleString("th-TH")} รายการที่ค้นหาได้
              </div>
            </div>
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
