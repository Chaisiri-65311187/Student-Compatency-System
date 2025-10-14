// src/components/AddAnnouncementPage.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Swal from "sweetalert2";

const tz = "Asia/Bangkok";
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const parseSafeDate = (s) => { if (!s) return null; const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s)); if (m) return new Date(+m[1], +m[2] - 1, +m[3]); const d = new Date(s); return isNaN(d) ? null : d; };
const formatDateTH = (s, withYear = true) => { const d = parseSafeDate(s); if (!d) return "-"; return new Intl.DateTimeFormat("th-TH", { timeZone: tz, day: "2-digit", month: "short", year: withYear ? "numeric" : undefined }).format(d); };
const formatTimeHM = (t) => !t ? "" : String(t).slice(0, 5);
const formatDateRangeTH = (start, end) => { const a = parseSafeDate(start), b = parseSafeDate(end); if (a && b) { const same = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear(); if (same) { const fmt = new Intl.DateTimeFormat("th-TH", { timeZone: tz, day: "2-digit", month: "short", year: "numeric" }); const dFmt = new Intl.DateTimeFormat("th-TH", { timeZone: tz, day: "2-digit" }); return `${dFmt.format(a)}–${fmt.format(b)}`; } return `${formatDateTH(start)} – ${formatDateTH(end)}`; } return formatDateTH(start || end); };

const StatusBadge = ({ status }) => {
  const cls = status === "open" ? "badge text-bg-success" : status === "closed" ? "badge text-bg-secondary" : "badge text-bg-dark";
  const label = status === "open" ? "เปิดรับ" : status === "closed" ? "ปิดรับ" : "เก็บถาวร";
  return <span className={cls}>{label}</span>;
};

export default function AddAnnouncementPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "", description: "", seats: 1, year: "", department: "",
    status: "open", location: "", deadline: "",
  });
  const [workPeriods, setWorkPeriods] = useState([{ startDate: "", startTime: "", endDate: "", endTime: "" }]);
  const [saving, setSaving] = useState(false);

  const teacherName = useMemo(() => user?.full_name || user?.fullName || user?.username || "Guest", [user]);
  const today = todayStr();

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "seats") setFormData(p => ({ ...p, seats: Math.max(1, Number(value || 1)) }));
    else setFormData(p => ({ ...p, [name]: value }));
  };
  const handlePeriodChange = (i, field, value) => {
    setWorkPeriods(prev => {
      const next = [...prev]; next[i] = { ...next[i], [field]: value };
      if (field === "startDate" && value && !next[i].endDate) next[i].endDate = value;
      return next;
    });
  };
  const addPeriod = () => setWorkPeriods(p => [...p, { startDate: "", startTime: "", endDate: "", endTime: "" }]);
  const removePeriod = (i) => setWorkPeriods(p => p.filter((_, idx) => idx !== i));

  const validate = () => {
    if (!formData.title.trim() || !formData.description.trim()) return "โปรดกรอกชื่อประกาศและรายละเอียดงาน";
    if (!formData.year || !formData.department) return "โปรดเลือกชั้นปีและสาขา";
    if (!workPeriods.length) return "โปรดเพิ่มอย่างน้อย 1 ช่วงวันทำงาน";
    for (let i = 0; i < workPeriods.length; i++) {
      const p = workPeriods[i];
      if (!p.startDate) return `ช่วงที่ ${i + 1}: โปรดเลือกวันเริ่มทำงาน`;
      if (p.endDate && p.endDate < p.startDate) return `ช่วงที่ ${i + 1}: วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่ม`;
      if (formData.deadline && formData.deadline < p.startDate) return `ช่วงที่ ${i + 1}: วันปิดรับต้องไม่น้อยกว่าวันเริ่มทำงาน`;
      if (p.startDate && p.endDate && p.startDate === p.endDate && p.startTime && p.endTime && p.endTime < p.startTime)
        return `ช่วงที่ ${i + 1}: เวลาสิ้นสุดต้องไม่น้อยกว่าเวลาเริ่ม`;
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { await Swal.fire({ icon: "warning", title: err }); return; }

    try {
      setSaving(true);
      const API = (import.meta.env.VITE_API_BASE || "http://localhost:3000").replace(/\/+$/, "");

      const first = workPeriods[0];
      const payload = {
        title: formData.title,
        description: formData.description,
        seats: Number(formData.seats) || 1,
        work_date: first.startDate || null,
        work_end: first.endDate || null,
        work_time_start: first.startTime || null,
        work_time_end: first.endTime || null,
        work_periods: workPeriods.map(p => ({
          start_date: p.startDate,
          end_date: p.endDate || p.startDate,
          start_time: p.startTime || null,
          end_time: p.endTime || null,
        })),
        year: formData.year,
        department: formData.department,
        status: formData.status,
        location: formData.location,
        deadline: formData.deadline || null,
        teacher_id: user?.id || null,
        teacher: user?.full_name || user?.username || null,          // (เผื่อแสดงชื่ออย่างรวดเร็ว)
      };

      const res = await fetch(`${API}/api/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("ไม่สามารถบันทึกข้อมูลได้");

      await Swal.fire({ icon: "success", title: "บันทึกสำเร็จ!", text: "ประกาศถูกบันทึกแล้ว" });
      navigate("/teacher-announcements"); // ไปหน้าจัดการ/รายการประกาศ
    } catch (err) {
      await Swal.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const previewDateLine = (p) => {
    const dateStr = formatDateRangeTH(p.startDate, p.endDate || p.startDate);
    const timeStr = (p.startTime || p.endTime)
      ? ` (${p.startTime ? formatTimeHM(p.startTime) : "—"}–${p.endTime ? formatTimeHM(p.endTime) : "—"})`
      : "";
    return `${dateStr}${timeStr}`;
  };
  const previewDeadline = formData.deadline ? formatDateTH(formData.deadline) : null;

  return (
    <div className="min-vh-100" style={{ background: "linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%)" }}>
      {/* Top Bar */}
      <div className="d-flex align-items-center px-3" style={{ height: 72, background: "linear-gradient(90deg,#6f42c1,#8e5cff)", boxShadow: "0 4px 14px rgba(111,66,193,.22)" }}>
        <img src="/src/assets/csit.jpg" alt="Logo" className="rounded-3 me-3" style={{ height: 40, width: 40, objectFit: "cover" }} />
        <h5 className="text-white fw-semibold m-0">CSIT Competency System — Teacher</h5>
        <div className="ms-auto d-flex align-items-center">
          <span className="text-white-50 me-3">{teacherName}</span>
          <button className="btn btn-light btn-sm rounded-pill" onClick={() => { logout?.(); navigate("/login"); }}>ออกจากระบบ</button>
        </div>
      </div>

      {/* Main */}
      <div className="container-xxl py-4">
        <div className="row g-4">
          {/* Form */}
          <div className="col-12 col-lg-7">
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body p-4 p-lg-5">
                <h3 className="fw-semibold text-center mb-4">สร้างประกาศรับสมัครนิสิต</h3>

                <form onSubmit={handleSubmit}>
                  {/* ชื่อประกาศ */}
                  <div className="form-floating mb-3">
                    <input type="text" id="title" className="form-control rounded-3"
                      name="title" value={formData.title} onChange={handleChange}
                      placeholder="ชื่อประกาศ" required />
                    <label htmlFor="title">ชื่อประกาศ</label>
                  </div>

                  {/* รายละเอียด */}
                  <div className="form-floating mb-3">
                    <textarea id="description" className="form-control rounded-3"
                      name="description" value={formData.description} onChange={handleChange}
                      placeholder="รายละเอียดงาน" style={{ height: 120 }} required />
                    <label htmlFor="description">รายละเอียดงาน</label>
                  </div>

                  {/* จำนวน/เดดไลน์/สถานที่ */}
                  <div className="row g-3">
                    <div className="col-sm-4">
                      <div className="form-floating">
                        <input type="number" id="seats" className="form-control rounded-3"
                          name="seats" value={formData.seats} onChange={handleChange}
                          min={1} placeholder="จำนวนที่รับ" required />
                        <label htmlFor="seats">จำนวนที่รับ</label>
                      </div>
                    </div>
                    <div className="col-sm-4">
                      <div className="form-floating">
                        <input type="date" id="deadline" className="form-control rounded-3"
                          name="deadline" value={formData.deadline} onChange={handleChange}
                          min={today} placeholder="วันปิดรับสมัคร" />
                        <label htmlFor="deadline">วันปิดรับสมัคร</label>
                      </div>
                      <div className="form-text">ไม่บังคับ</div>
                    </div>
                    <div className="col-sm-4">
                      <div className="form-floating">
                        <input type="text" id="location" className="form-control rounded-3"
                          name="location" value={formData.location} onChange={handleChange}
                          placeholder="ห้องแลบ 204 / Remote" />
                        <label htmlFor="location">สถานที่ทำงาน</label>
                      </div>
                    </div>
                  </div>

                  {/* ช่วงวันทำงานหลายช่วง */}
                  <div className="mt-4">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <h6 className="m-0">ช่วงวันทำงาน / เวลา</h6>
                      <button type="button" className="btn btn-sm btn-outline-primary rounded-pill" onClick={addPeriod}>+ เพิ่มช่วง</button>
                    </div>

                    <div className="d-flex flex-column gap-3">
                      {workPeriods.map((p, idx) => (
                        <div key={idx} className="card border-0 shadow-sm rounded-3">
                          <div className="card-body">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                              <div className="fw-semibold">ช่วงที่ {idx + 1}</div>
                              {workPeriods.length > 1 && (
                                <button type="button" className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => removePeriod(idx)}>
                                  ลบช่วง
                                </button>
                              )}
                            </div>

                            <div className="row g-3">
                              {/* เริ่ม */}
                              <div className="col-md-6">
                                <div className="row g-2">
                                  <div className="col-7">
                                    <div className="form-floating">
                                      <input type="date" className="form-control rounded-3" id={`startDate_${idx}`}
                                        value={p.startDate} onChange={(e) => handlePeriodChange(idx, "startDate", e.target.value)}
                                        min={today} placeholder="วันเริ่ม" required />
                                      <label htmlFor={`startDate_${idx}`}>วันเริ่ม</label>
                                    </div>
                                  </div>
                                  <div className="col-5">
                                    <div className="form-floating">
                                      <input type="time" className="form-control rounded-3" id={`startTime_${idx}`}
                                        value={p.startTime} onChange={(e) => handlePeriodChange(idx, "startTime", e.target.value)} />
                                      <label htmlFor={`startTime_${idx}`}>เวลาเริ่ม</label>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* สิ้นสุด */}
                              <div className="col-md-6">
                                <div className="row g-2">
                                  <div className="col-7">
                                    <div className="form-floating">
                                      <input type="date" className="form-control rounded-3" id={`endDate_${idx}`}
                                        value={p.endDate} onChange={(e) => handlePeriodChange(idx, "endDate", e.target.value)}
                                        min={p.startDate || today} placeholder="วันสิ้นสุด" />
                                      <label htmlFor={`endDate_${idx}`}>วันสิ้นสุด (ถ้ามี)</label>
                                    </div>
                                  </div>
                                  <div className="col-5">
                                    <div className="form-floating">
                                      <input type="time" className="form-control rounded-3" id={`endTime_${idx}`}
                                        value={p.endTime} onChange={(e) => handlePeriodChange(idx, "endTime", e.target.value)} />
                                      <label htmlFor={`endTime_${idx}`}>เวลาสิ้นสุด</label>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="form-text mt-2">ไม่ใส่เวลาได้ (ถือว่าเต็มวัน)</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ปี/สาขา/สถานะ */}
                  <div className="row g-3 mt-3">
                    <div className="col-sm-4">
                      <div className="form-floating">
                        <select id="year" className="form-select rounded-3" name="year"
                          value={formData.year} onChange={handleChange} required>
                          <option value="">เลือกชั้นปี</option>
                          <option value="1">ชั้นปี 1</option>
                          <option value="2">ชั้นปี 2</option>
                          <option value="3">ชั้นปี 3</option>
                          <option value="4">ชั้นปี 4</option>
                        </select>
                        <label htmlFor="year">ชั้นปีที่สมัครได้</label>
                      </div>
                    </div>

                    <div className="col-sm-5">
                      <div className="form-floating">
                        <select id="department" className="form-select rounded-3" name="department"
                          value={formData.department} onChange={handleChange} required>
                          <option value="">เลือกสาขา</option>
                          <option value="วิทยาการคอมพิวเตอร์">วิทยาการคอมพิวเตอร์</option>
                          <option value="เทคโนโลยีสารสนเทศ">เทคโนโลยีสารสนเทศ</option>
                          <option value="ไม่จำกัด">ไม่จำกัด</option>
                        </select>
                        <label htmlFor="department">สาขาที่เกี่ยวข้อง</label>
                      </div>
                    </div>

                    <div className="col-sm-3">
                      <div className="form-floating">
                        <select id="status" className="form-select rounded-3" name="status"
                          value={formData.status} onChange={handleChange}>
                          <option value="open">เปิดรับ</option>
                          <option value="closed">ปิดรับ</option>
                          <option value="archived">เก็บถาวร</option>
                        </select>
                        <label htmlFor="status">สถานะประกาศ</label>
                      </div>
                    </div>
                  </div>

                  {/* ปุ่ม */}
                  <div className="d-flex gap-2 justify-content-end mt-4">
                    <button type="button" className="btn btn-outline-secondary rounded-pill"
                      onClick={() => navigate("/announcements")} disabled={saving}>
                      ยกเลิก
                    </button>
                    <button type="submit" className="btn btn-primary rounded-pill" disabled={saving}>
                      {saving && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />}
                      ส่งข้อมูล
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="col-12 col-lg-5">
            <div className="card shadow-sm border-0 rounded-4 overflow-hidden h-100">
              <div className="ratio" style={{ aspectRatio: "21/9", background: "linear-gradient(135deg,#6f42c1,#b388ff)", position: "relative" }}>
                <div className="position-absolute top-0 end-0 m-2"><StatusBadge status={formData.status} /></div>
                {formData.year && <span className="badge bg-light text-dark position-absolute bottom-0 start-0 m-2 fw-bold">ชั้นปี {formData.year}</span>}
              </div>
              <div className="card-body d-flex flex-column">
                <h5 className="mb-1 text-truncate" title={formData.title || "ชื่อประกาศ"}>{formData.title || "ชื่อประกาศ"}</h5>
                <div className="small text-muted mb-2"><i className="bi bi-person-workspace me-1" />อาจารย์: <span className="fw-medium text-dark">{teacherName}</span></div>
                <div className="small mb-2">
                  <i className="bi bi-calendar-event me-1" />
                  <div className="d-flex flex-column">
                    {workPeriods.filter(p => p.startDate).length
                      ? workPeriods.map((p, i) => <div key={i} className="text-body">• {previewDateLine(p)}</div>)
                      : <span className="text-muted">ยังไม่เลือกช่วงวันทำงาน</span>}
                  </div>
                </div>
                {formData.deadline && <div className="small text-muted mb-2"><i className="bi bi-hourglass me-1" />ปิดรับ: {formatDateTH(formData.deadline)}</div>}
                <div className="small mb-2"><i className="bi bi-mortarboard me-1" />สาขา: <span className="fw-medium">{formData.department || "—"}</span></div>
                {formData.location && <div className="small text-muted mb-2"><i className="bi bi-geo-alt me-1" />{formData.location}</div>}
                {!!formData.seats && <div className="small text-muted mb-2"><i className="bi bi-people me-1" />รับ {formData.seats} คน</div>}
                {formData.description && <p className="text-muted mb-0" style={{ whiteSpace: "pre-wrap" }}>{formData.description}</p>}
              </div>
            </div>
            <div className="text-muted small mt-2">พรีวิวการ์ดประกาศ</div>
          </div>
        </div>
      </div>

      <style>{`
        .form-control:focus, .form-select:focus{
          box-shadow: 0 0 0 .2rem rgba(111,66,193,.12);
          border-color: #8e5cff;
        }
      `}</style>
    </div>
  );
}
