// src/components/AddAnnouncementPage.jsx — no-animation, clean UI
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { createAnnouncement } from "../../services/announcementsApi";
import Swal from "sweetalert2";

/* ===== Helpers ===== */
const tz = "Asia/Bangkok";
const toISODate = (s) => {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const toHHMM = (s) => {
  if (!s) return null;
  const m = /^(\d{2}):?(\d{2})/.exec(String(s));
  return m ? `${m[1]}:${m[2]}` : null;
};
const parseSafe = (s) => (s ? new Date(s) : null);
const dateTH = (s) => {
  const d = parseSafe(s);
  if (!d || isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: tz,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
};
const timeHM = (t) => (t ? String(t).slice(0, 5) : "");
const lineFromPeriod = (p) => {
  const a = toISODate(p.startDate);
  const b = toISODate(p.endDate || p.startDate);
  const date = a && b && a !== b ? `${dateTH(a)} – ${dateTH(b)}` : dateTH(a || b);
  const time =
    p.startTime || p.endTime
      ? ` (${timeHM(p.startTime) || "—"}–${timeHM(p.endTime) || "—"})`
      : "";
  return `${date}${time}`;
};

const DEPTS = ["ไม่จำกัด", "วิทยาการคอมพิวเตอร์", "เทคโนโลยีสารสนเทศ"];
const YEARS = [1, 2, 3, 4];
const STATUSES = ["open", "closed", "archived"];

const StatusBadge = ({ status }) => {
  const cls =
    status === "open"
      ? "badge text-bg-success"
      : status === "closed"
        ? "badge text-bg-secondary"
        : "badge text-bg-dark";
  const label = status === "open" ? "เปิดรับ" : status === "closed" ? "ปิดรับ" : "เก็บถาวร";
  return <span className={cls}>{label}</span>;
};

export default function AddAnnouncementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState({
    title: "",
    description: "",
    department: "ไม่จำกัด",
    year: "",
    seats: "",
    status: "open",
    location: "",
    deadline: "",
  });

  const [periods, setPeriods] = useState([
    { startDate: "", endDate: "", startTime: "", endTime: "" },
  ]);

  const today = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }, []);

  const updateField = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const updatePeriod = (idx, k, v) =>
    setPeriods((ps) =>
      ps.map((p, i) => {
        if (i !== idx) return p;
        const next = { ...p, [k]: v };
        // ช่วยกรอก: ถ้ากรอกวันที่เริ่มแล้วยังไม่ใส่สิ้นสุด ให้คัดลอก
        if (k === "startDate" && v && !next.endDate) next.endDate = v;
        return next;
      })
    );
  const addPeriod = () =>
    setPeriods((ps) => [...ps, { startDate: "", endDate: "", startTime: "", endTime: "" }]);
  const removePeriod = (idx) => setPeriods((ps) => ps.filter((_, i) => i !== idx));

  const validate = () => {
    if (!form.title.trim()) return "กรุณากรอกหัวข้อประกาศ";
    if (!form.seats || Number(form.seats) < 1) return "กรุณากรอกจำนวนรับเป็นเลข ≥ 1";
    if (!periods.length || !periods[0].startDate)
      return "กรุณาใส่ช่วงวันที่ทำงานอย่างน้อย 1 ช่วง";
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const msg = validate();
    if (msg) {
      await Swal.fire("ไม่สามารถบันทึกได้", msg, "warning");
      return;
    }

    const wp = periods.map((p) => ({
      start_date: toISODate(p.startDate),
      end_date: toISODate(p.endDate || p.startDate),
      start_time: toHHMM(p.startTime),
      end_time: toHHMM(p.endTime),
    }));
    const first = wp[0] || {};

    const payload = {
      title: form.title,
      description: form.description,
      department: form.department || "ไม่จำกัด",
      year: form.year ? Number(form.year) : null,
      status: form.status || "open",
      location: form.location || "",
      deadline: toISODate(form.deadline),
      seats: Number(form.seats) || 1,
      capacity: Number(form.seats) || 1,

      work_periods: wp,
      work_date: first.start_date || null,
      work_end: first.end_date || null,
      work_time_start: first.start_time || null,
      work_time_end: first.end_time || null,

      teacher_id: user?.id || null,
      teacher: user?.full_name || user?.username || null,
    };

    try {
      await createAnnouncement(payload);
      await Swal.fire("บันทึกสำเร็จ", "สร้างประกาศเรียบร้อย", "success");
      navigate(-1);
    } catch (e) {
      Swal.fire("บันทึกไม่สำเร็จ", e?.message || "เกิดข้อผิดพลาด", "error");
    }
  };

  // ===== PREVIEW =====
  const previewLines = periods.filter((p) => p.startDate).map(lineFromPeriod);
  const previewDeadline = form.deadline ? dateTH(form.deadline) : null;

  const seatHint = (() => {
    const n = Number(form.seats);
    if (!n) return "กรอกจำนวนผู้เข้าร่วม";
    if (n < 3) return "ขนาดเล็ก – เหมาะกับงานเฉพาะกิจ";
    if (n <= 10) return "ขนาดกลาง – กลุ่มย่อย";
    return "ขนาดใหญ่ – พิจารณาแบ่งรอบ/เวร";
  })();

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
              ย้อนกลับ
            </button>
          </div>
        </div>
      </div>

      <div className="container-xxl py-4">
        <div className="row g-4">
          {/* FORM */}
          <div className="col-12 col-lg-7">
            <form
              className="card border-0 shadow-sm rounded-4"
              onSubmit={onSubmit}
              noValidate
            >
              <div className="card-body p-4 p-lg-5">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h3 className="fw-semibold mb-0">สร้างประกาศรับสมัครนิสิต</h3>
                  <span className="badge text-bg-secondary rounded-pill">
                    <i className="bi bi-person-plus me-1" />
                    สร้างใหม่
                  </span>
                </div>

                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">หัวข้อประกาศ</label>
                    <div className="input-group">
                      <span className="input-group-text bg-transparent">
                        <i className="bi bi-megaphone" />
                      </span>
                      <input
                        type="text"
                        className="form-control rounded-end-3"
                        value={form.title}
                        onChange={(e) => updateField("title", e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="col-12">
                    <label className="form-label">รายละเอียด</label>
                    <textarea
                      className="form-control rounded-3"
                      rows={4}
                      value={form.description}
                      onChange={(e) => updateField("description", e.target.value)}
                      placeholder="ลักษณะงาน / หน้าที่ / สิ่งที่ต้องเตรียม ฯลฯ"
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">สาขาที่เกี่ยวข้อง</label>
                    <select
                      className="form-select rounded-3"
                      value={form.department}
                      onChange={(e) => updateField("department", e.target.value)}
                    >
                      {DEPTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">ชั้นปีที่สมัครได้</label>
                    <select
                      className="form-select rounded-3"
                      value={form.year}
                      onChange={(e) => updateField("year", e.target.value)}
                    >
                      <option value="">ไม่กำหนด</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">สถานะ</label>
                    <select
                      className="form-select rounded-3"
                      value={form.status}
                      onChange={(e) => updateField("status", e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">จำนวนรับ (คน)</label>
                    <div className="input-group">
                      <span className="input-group-text bg-transparent">
                        <i className="bi bi-people" />
                      </span>
                      <input
                        type="number"
                        min={1}
                        className="form-control rounded-end-3"
                        value={form.seats}
                        onChange={(e) => updateField("seats", e.target.value)}
                        placeholder="เช่น 5"
                        required
                      />
                    </div>
                    <div className="form-text">{seatHint}</div>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">วันปิดรับสมัคร</label>
                    <input
                      type="date"
                      className="form-control rounded-3"
                      min={today}
                      value={form.deadline}
                      onChange={(e) => updateField("deadline", e.target.value)}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">สถานที่ทำงาน</label>
                    <div className="input-group">
                      <span className="input-group-text bg-transparent">
                        <i className="bi bi-geo-alt" />
                      </span>
                      <input
                        type="text"
                        className="form-control rounded-end-3"
                        value={form.location}
                        onChange={(e) => updateField("location", e.target.value)}
                        placeholder="เช่น ห้องแลบ 204 / ทำงานจากบ้าน"
                      />
                    </div>
                  </div>

                  {/* Work periods */}
                  <div className="col-12 mt-2">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <label className="form-label m-0">
                        ช่วงวันที่ทำงาน / เวลา (เพิ่มได้หลายช่วง)
                      </label>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm rounded-pill"
                        onClick={addPeriod}
                      >
                        + เพิ่มช่วง
                      </button>
                    </div>

                    <div className="d-flex flex-column gap-2">
                      {periods.map((p, idx) => (
                        <div key={idx} className="card border-0 shadow-sm rounded-3">
                          <div className="card-body">
                            <div className="row g-2 align-items-end">
                              <div className="col-md-3">
                                <label className="form-label small">วันที่เริ่ม</label>
                                <input
                                  type="date"
                                  className="form-control rounded-3"
                                  min={today}
                                  value={p.startDate}
                                  onChange={(e) =>
                                    updatePeriod(idx, "startDate", e.target.value)
                                  }
                                />
                              </div>
                              <div className="col-md-3">
                                <label className="form-label small">วันที่สิ้นสุด</label>
                                <input
                                  type="date"
                                  className="form-control rounded-3"
                                  min={p.startDate || today}
                                  value={p.endDate}
                                  onChange={(e) =>
                                    updatePeriod(idx, "endDate", e.target.value)
                                  }
                                />
                              </div>
                              <div className="col-md-2">
                                <label className="form-label small">เวลาเริ่ม</label>
                                <input
                                  type="time"
                                  className="form-control rounded-3"
                                  value={p.startTime}
                                  onChange={(e) =>
                                    updatePeriod(idx, "startTime", e.target.value)
                                  }
                                />
                              </div>
                              <div className="col-md-2">
                                <label className="form-label small">เวลาสิ้นสุด</label>
                                <input
                                  type="time"
                                  className="form-control rounded-3"
                                  value={p.endTime}
                                  onChange={(e) =>
                                    updatePeriod(idx, "endTime", e.target.value)
                                  }
                                />
                              </div>
                              <div className="col-md-2 d-grid">
                                <button
                                  type="button"
                                  className="btn btn-outline-danger rounded-3"
                                  disabled={periods.length === 1}
                                  onClick={() => removePeriod(idx)}
                                >
                                  ลบช่วงนี้
                                </button>
                              </div>
                            </div>
                            <div className="form-text mt-2">
                              ไม่ใส่เวลาได้ (ถือว่าเต็มวัน)
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-footer bg-transparent border-0 d-flex justify-content-end gap-2 px-4 pb-4">
                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-pill"
                  onClick={() => navigate(-1)}
                >
                  ยกเลิก
                </button>
                <button type="submit" className="btn btn-primary rounded-pill">
                  บันทึกประกาศ
                </button>
              </div>
            </form>
          </div>

          {/* PREVIEW */}
          <div className="col-12 col-lg-5">
            <div className="card shadow-sm border-0 rounded-4 overflow-hidden h-100">
              <div
                className="ratio"
                style={{
                  aspectRatio: "21/9",
                  background: "linear-gradient(135deg, #6f42c1, #b388ff)",
                  position: "relative",
                }}
              >
                <div className="position-absolute top-0 end-0 m-2">
                  <StatusBadge status={form.status} />
                </div>
                {form.year && (
                  <span className="badge bg-light text-dark position-absolute bottom-0 start-0 m-2 fw-bold">
                    ชั้นปี {form.year}
                  </span>
                )}
              </div>
              <div className="card-body d-flex flex-column">
                <h5
                  className="mb-1 text-truncate"
                  title={form.title || "ชื่อประกาศ"}
                >
                  {form.title || "ชื่อประกาศ"}
                </h5>
                <div className="small text-muted mb-2">
                  อาจารย์:{" "}
                  <span className="fw-medium text-dark">
                    {user?.full_name || user?.username || "—"}
                  </span>
                </div>

                <div className="small mb-2">
                  <div className="text-muted">ช่วงวันที่ทำงาน:</div>
                  {previewLines.length ? (
                    previewLines.map((ln, i) => (
                      <div key={i} className="text-body">
                        • {ln}
                      </div>
                    ))
                  ) : (
                    <span className="text-muted">ยังไม่เลือกช่วงวันทำงาน</span>
                  )}
                </div>

                {previewDeadline && (
                  <div className="small text-muted mb-2">
                    ปิดรับ: {previewDeadline}
                  </div>
                )}

                <div className="small mb-2">
                  สาขา: <span className="fw-medium">{form.department || "—"}</span>
                </div>
                {form.location && (
                  <div className="small text-muted mb-2">
                    สถานที่: {form.location}
                  </div>
                )}
                {form.seats && (
                  <div className="small text-muted mb-2">รับ {form.seats} คน</div>
                )}

                {form.description && (
                  <p className="text-muted mb-0" style={{ whiteSpace: "pre-wrap" }}>
                    {form.description}
                  </p>
                )}
              </div>
            </div>
            <div className="text-muted small mt-2">
              * พรีวิวนี้คือการ์ดที่จะไปแสดงในหน้า “ประกาศรับสมัคร”
            </div>
          </div>
        </div>
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
