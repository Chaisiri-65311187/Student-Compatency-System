// src/pages/ApplicantsManagePage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAnnouncement, listApplicants, changeApplicationStatus } from "../services/announcementsApi";

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

export default function ApplicantsManagePage() {
  const { id } = useParams(); // announcement id
  const navigate = useNavigate();

  const [ann, setAnn] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  const refreshAll = async () => {
    const [a, apps] = await Promise.all([getAnnouncement(id), listApplicants(id)]);
    setAnn(a);
    setRows(apps.items || apps || []);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refreshAll();
      } catch (e) {
        setErr(e.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const doAction = async (app, action) => {
    try {
      await changeApplicationStatus(id, app.id, action);
      await refreshAll(); // refresh ทั้งหัว/ตาราง (อัปเดต remaining)
    } catch (e) {
      alert(e.message || "ดำเนินการไม่สำเร็จ");
    }
  };

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter(
      (r) =>
        String(r.username || "").toLowerCase().includes(kw) ||
        String(r.full_name || "").toLowerCase().includes(kw) ||
        String(r.status || "").toLowerCase().includes(kw)
    );
  }, [rows, search]);

  return (
    <div className="min-vh-100" style={{ background: "linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%)" }}>
      {/* Top Bar – ให้เหมือนทุกหน้า */}
      <div
        className="d-flex align-items-center px-3"
        style={{
          height: 72,
          background: "linear-gradient(90deg, #6f42c1, #8e5cff)",
          boxShadow: "0 4px 14px rgba(111,66,193,.22)",
          position: "sticky",
          top: 0,
          zIndex: 1040,
        }}
      >
        <img
          src="/src/assets/csit.jpg"
          alt="Logo"
          className="rounded-3 me-3"
          style={{ height: 40, width: 40, objectFit: "cover" }}
        />
        <h5 className="text-white fw-semibold m-0">CSIT Competency System — Teacher</h5>
        <div className="ms-auto d-flex align-items-center gap-2">
          <button className="btn btn-light btn-sm rounded-pill" onClick={() => navigate(-1)}>
            ← ย้อนกลับ
          </button>
        </div>
      </div>

      <div className="container-xxl py-4">
        {/* Header card */}
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body d-flex flex-wrap gap-3 align-items-center">
            <div className="me-auto">
              <div className="small text-muted mb-1">ประกาศ</div>
              <div className="fw-semibold fs-5">{ann?.title || "—"}</div>
              <div className="text-muted small">อาจารย์ผู้รับผิดชอบ: {ann?.teacher_name || "-"}</div>
            </div>
            <div className="text-end">
              <div className="small text-muted">จำนวนที่รับ</div>
              <div className="badge text-bg-light fs-6">
                รับ: {ann?.remaining ?? "ไม่จำกัด"}
                {ann?.capacity != null && <> / {ann.capacity}</>}
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body d-flex flex-wrap gap-2 align-items-center">
            <h5 className="m-0 me-auto">จัดการผู้สมัคร</h5>
            <div className="position-relative" style={{ minWidth: 260 }}>
              <i className="bi bi-search position-absolute" style={{ left: 12, top: 10, opacity: 0.5 }} />
              <input
                type="text"
                className="form-control ps-5 rounded-pill"
                placeholder="ค้นหา รหัสนิสิต / ชื่อ / สถานะ"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-muted">
            <span className="spinner-border spinner-border-sm me-2" />
            กำลังโหลดผู้สมัคร…
          </div>
        ) : err ? (
          <div className="alert alert-danger rounded-4">{err}</div>
        ) : filtered.length === 0 ? (
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body text-center text-muted py-5">
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
                    <th className="text-end" style={{ width: 200 }}>
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="fw-medium">{r.username}</td>
                      <td>{r.full_name}</td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="text-end">
                        <div className="btn-group">
                          <button
                            className="btn btn-outline-success btn-sm"
                            disabled={r.status === "accepted"}
                            onClick={() => doAction(r, "accept")}
                          >
                            อนุมัติ
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            disabled={r.status === "rejected"}
                            onClick={() => doAction(r, "reject")}
                          >
                            ปฏิเสธ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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

      {/* Local styles ให้กลืนกับหน้าอื่น */}
      <style>{`
        .form-control:focus{
          box-shadow: 0 0 0 .2rem rgba(111,66,193,.12);
          border-color: #8e5cff;
        }
      `}</style>
    </div>
  );
}
