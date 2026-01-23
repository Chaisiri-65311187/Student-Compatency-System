// src/components/teacher/AddAnnouncementPage.jsx
// — Modern UI, merged capacity field, shared helpers
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { createAnnouncement } from "../../services/announcementsApi";
import Swal from "sweetalert2";
import {
  toISODate, toHHMM, dateTH, lineFromPeriod,
  DEPTS, YEARS, STATUSES, ROLE_OPTIONS, ACTIVITY_CATS,
  sharedPageStyles
} from "../../utils/announcementHelpers";

export default function AddAnnouncementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState({
    title: "",
    description: "",
    department: "ไม่จำกัด",
    year: "",
    seats: "", // Used for both seats and capacity
    role_target: "student",
    activity_category: "social",
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
        if (k === "startDate" && v && !next.endDate) next.endDate = v;
        return next;
      })
    );
  const addPeriod = () =>
    setPeriods((ps) => [...ps, { startDate: "", endDate: "", startTime: "", endTime: "" }]);
  const removePeriod = (idx) => setPeriods((ps) => ps.filter((_, i) => i !== idx));

  const validate = () => {
    if (!form.title.trim()) return "กรุณากรอกหัวข้อประกาศ";
    const seatsNum = Number(form.seats);
    if (!seatsNum || seatsNum < 1) return "กรุณากรอกจำนวนรับเป็นเลข ≥ 1";
    if (!periods.length || !periods[0].startDate)
      return "กรุณาใส่ช่วงวันที่ทำงานอย่างน้อย 1 ช่วง";
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const msg = validate();
    if (msg) return Swal.fire("ไม่สามารถบันทึกได้", msg, "warning");

    const wp = periods.map((p, i) => ({
      start_date: toISODate(p.startDate),
      end_date: toISODate(p.endDate || p.startDate),
      start_time: toHHMM(p.startTime),
      end_time: toHHMM(p.endTime),
      _idx: i,
    }));
    const first = wp[0] || {};
    const seatsNum = Number(form.seats) || 1;

    const payload = {
      title: form.title,
      description: form.description,
      department: form.department || "ไม่จำกัด",
      year: form.year ? Number(form.year) : null,
      status: form.status || "open",
      location: form.location || "",
      deadline: toISODate(form.deadline),
      seats: seatsNum,
      capacity: seatsNum, // Use same value for both
      role_target: form.role_target,
      activity_category: form.activity_category || "social",
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

  const previewLines = periods.filter((p) => p.startDate).map(lineFromPeriod);

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
            <img src="/csit.jpg" alt="Logo" className="rounded-3 shadow-sm" style={{ height: 40, width: 40, objectFit: "cover" }} onError={(e) => (e.currentTarget.src = "/src/assets/csit.jpg")} />
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
            <form className="card border-0 shadow-sm rounded-4" onSubmit={onSubmit} noValidate>
              <div className="card-body p-4 p-lg-5">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h3 className="fw-semibold mb-0">สร้างประกาศรับสมัคร</h3>
                  <span className="badge text-bg-secondary rounded-pill">
                    <i className="bi bi-plus-circle me-1" /> สร้างใหม่
                  </span>
                </div>

                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label" htmlFor="title">หัวข้อประกาศ</label>
                    <input id="title" name="title" type="text" className="form-control rounded-3" value={form.title} onChange={(e) => updateField("title", e.target.value)} required />
                  </div>

                  <div className="col-12">
                    <label className="form-label" htmlFor="description">รายละเอียด</label>
                    <textarea id="description" name="description" className="form-control rounded-3" rows={4} value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="ลักษณะงาน / หน้าที่ / สิ่งที่ต้องเตรียม ฯลฯ" />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label" htmlFor="role_target">กลุ่มเป้าหมาย</label>
                    <select id="role_target" name="role_target" className="form-select rounded-3" value={form.role_target} onChange={(e) => updateField("role_target", e.target.value)}>
                      {ROLE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label" htmlFor="activity_category">ประเภทกิจกรรม (Competency)</label>
                    <select id="activity_category" name="activity_category" className="form-select rounded-3" value={form.activity_category} onChange={(e) => updateField("activity_category", e.target.value)}>
                      {ACTIVITY_CATS.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label" htmlFor="department">สาขา</label>
                    <select id="department" name="department" className="form-select rounded-3" value={form.department} onChange={(e) => updateField("department", e.target.value)}>
                      {DEPTS.map((d) => (<option key={d} value={d}>{d}</option>))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label" htmlFor="year">ชั้นปี</label>
                    <select id="year" name="year" className="form-select rounded-3" value={form.year} onChange={(e) => updateField("year", e.target.value)}>
                      <option value="">ทุกชั้นปี</option>
                      {YEARS.map((y) => (<option key={y} value={y}>{y}</option>))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label" htmlFor="status">สถานะ</label>
                    <select id="status" name="status" className="form-select rounded-3" value={form.status} onChange={(e) => updateField("status", e.target.value)}>
                      {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label" htmlFor="seats">จำนวนรับ (คน)</label>
                    <input id="seats" name="seats" type="number" min={1} className="form-control rounded-3" value={form.seats} onChange={(e) => updateField("seats", e.target.value)} required />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label" htmlFor="deadline">ปิดรับสมัคร</label>
                    <input id="deadline" name="deadline" type="date" className="form-control rounded-3" min={today} value={form.deadline} onChange={(e) => updateField("deadline", e.target.value)} />
                  </div>

                  <div className="col-12">
                    <label className="form-label" htmlFor="location">สถานที่ทำงาน</label>
                    <input id="location" name="location" type="text" className="form-control rounded-3" value={form.location} onChange={(e) => updateField("location", e.target.value)} placeholder="ระบุสถานที่" />
                  </div>

                  <div className="col-12">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <label className="form-label m-0">ช่วงวันที่ทำงาน</label>
                      <button type="button" className="btn btn-outline-primary btn-sm rounded-pill" onClick={addPeriod}>+ เพิ่มช่วง</button>
                    </div>
                    {periods.map((p, idx) => (
                      <div key={idx} className="card border-0 bg-light rounded-3 mb-2">
                        <div className="card-body p-3">
                          <div className="row g-2 align-items-end">
                            <div className="col-md-3">
                              <small className="text-muted d-block mb-1">เริ่ม</small>
                              <input type="date" className="form-control form-control-sm rounded-3" value={p.startDate} onChange={(e) => updatePeriod(idx, "startDate", e.target.value)} min={today} />
                            </div>
                            <div className="col-md-3">
                              <small className="text-muted d-block mb-1">สิ้นสุด</small>
                              <input type="date" className="form-control form-control-sm rounded-3" value={p.endDate} onChange={(e) => updatePeriod(idx, "endDate", e.target.value)} min={p.startDate || today} />
                            </div>
                            <div className="col-md-2">
                              <small className="text-muted d-block mb-1">เวลาเริ่ม</small>
                              <input type="time" className="form-control form-control-sm rounded-3" value={p.startTime} onChange={(e) => updatePeriod(idx, "startTime", e.target.value)} />
                            </div>
                            <div className="col-md-2">
                              <small className="text-muted d-block mb-1">เวลาจบ</small>
                              <input type="time" className="form-control form-control-sm rounded-3" value={p.endTime} onChange={(e) => updatePeriod(idx, "endTime", e.target.value)} />
                            </div>
                            <div className="col-md-2 text-end">
                              <button type="button" className="btn btn-outline-danger btn-sm rounded-3" onClick={() => removePeriod(idx)} disabled={periods.length === 1}><i className="bi bi-trash" /></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card-footer bg-transparent border-0 d-flex justify-content-end gap-2 px-4 pb-4">
                <button type="button" className="btn btn-outline-secondary rounded-pill px-4" onClick={() => navigate(-1)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary rounded-pill px-4">บันทึก</button>
              </div>
            </form>
          </div>

          {/* PREVIEW */}
          <div className="col-12 col-lg-5">
            <div className="card shadow-sm border-0 rounded-4 overflow-hidden h-100">
              <div className="ratio" style={{ aspectRatio: "21/9", background: "linear-gradient(135deg, #6f42c1, #b388ff)", position: "relative" }}>
                {form.year && <span className="badge bg-white text-dark position-absolute bottom-0 start-0 m-3 shadow-sm">ปี {form.year}</span>}
              </div>
              <div className="card-body d-flex flex-column">
                <h5 className="mb-2 fw-bold text-truncate">{form.title || "ชื่อประกาศ"}</h5>
                <div className="text-muted small mb-3">👨‍🏫 {user?.full_name || user?.username || "—"}</div>

                <div className="small mb-2">
                  <i className="bi bi-people me-2"></i>รับ {form.seats || "-"} คน
                </div>
                {previewLines.map((L, i) => <div key={i} className="small mb-1 text-muted"><i className="bi bi-calendar-event me-2"></i>{L}</div>)}
                {form.deadline && <div className="small text-danger mb-2"><i className="bi bi-clock me-2"></i>ปิดรับ {toISODate(form.deadline)}</div>}

                {form.description && <p className="small text-muted mt-3 pt-3 border-top">{form.description}</p>}
              </div>
            </div>
            <div className="text-center mt-3 text-muted small">ตัวอย่างการแสดงผล</div>
          </div>
        </div>
      </div>

      <style>{sharedPageStyles}</style>
      <script dangerouslySetInnerHTML={{
        __html: `document.addEventListener('pointerdown', (e) => {
          const el = e.target.closest('.ripple');
          if (!el) return;
          const rect = el.getBoundingClientRect();
          el.style.setProperty('--x', ((e.clientX - rect.left) / rect.width * 100).toFixed(2) + '%');
          el.style.setProperty('--y', ((e.clientY - rect.top) / rect.height * 100).toFixed(2) + '%');
        }, { passive: true });`
      }} />
    </div>
  );
}
