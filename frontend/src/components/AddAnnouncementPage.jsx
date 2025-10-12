// src/components/AddAnnouncementPage.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Swal from "sweetalert2";

const tz = "Asia/Bangkok";
const todayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

function parseSafeDate(s) {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function formatDateTH(s, withYear = true) {
  const d = parseSafeDate(s);
  if (!d) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: tz,
    day: "2-digit",
    month: "short",
    year: withYear ? "numeric" : undefined,
  }).format(d);
}
function formatTimeHM(t) {
  if (!t) return "";
  // HH:MM หรือ HH:MM:SS -> HH:MM
  return String(t).slice(0, 5);
}
function formatDateRangeTH(start, end) {
  const a = parseSafeDate(start);
  const b = parseSafeDate(end);
  if (a && b) {
    const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
    if (sameMonth) {
      const fmt = new Intl.DateTimeFormat("th-TH", {
        timeZone: tz,
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const dayFmt = new Intl.DateTimeFormat("th-TH", { timeZone: tz, day: "2-digit" });
      return `${dayFmt.format(a)}–${fmt.format(b)}`;
    }
    return `${formatDateTH(start)} – ${formatDateTH(end)}`;
  }
  return formatDateTH(start || end);
}

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

const AddAnnouncementPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    seats: 1,
    year: "",
    department: "",
    status: "open",
    location: "",
    deadline: "",
  });
  const [workPeriods, setWorkPeriods] = useState([
    { startDate: "", startTime: "", endDate: "", endTime: "" },
  ]);

  const [saving, setSaving] = useState(false);
  const teacherName = useMemo(
    () => user?.full_name || user?.fullName || user?.username || "Guest",
    [user]
  );
  const today = todayStr();

  // ----- handlers -----
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "seats") {
      setFormData((prev) => ({ ...prev, seats: Math.max(1, Number(value || 1)) }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePeriodChange = (idx, field, value) => {
    setWorkPeriods((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };

      // กฎช่วย: ถ้าแก้ startDate และ endDate ยังว่าง -> เซ็ต endDate = startDate อัตโนมัติ
      if (field === "startDate" && value && !next[idx].endDate) {
        next[idx].endDate = value;
      }
      return next;
    });
  };

  const addPeriod = () => {
    setWorkPeriods((prev) => [...prev, { startDate: "", startTime: "", endDate: "", endTime: "" }]);
  };
  const removePeriod = (idx) => {
    setWorkPeriods((prev) => prev.filter((_, i) => i !== idx));
  };

  // ----- validation -----
  const validate = () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      return "โปรดกรอกชื่อประกาศและรายละเอียดงาน";
    }
    if (!formData.year || !formData.department) {
      return "โปรดเลือกชั้นปีและสาขา";
    }

    // อย่างน้อย 1 ช่วง และต้องมี startDate
    if (!workPeriods.length) return "โปรดเพิ่มอย่างน้อย 1 ช่วงวันทำงาน";

    for (let i = 0; i < workPeriods.length; i++) {
      const p = workPeriods[i];
      if (!p.startDate) return `ช่วงที่ ${i + 1}: โปรดเลือกวันเริ่มทำงาน`;
      if (p.endDate && p.endDate < p.startDate) {
        return `ช่วงที่ ${i + 1}: วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่ม`;
      }
      if (formData.deadline && formData.deadline < p.startDate) {
        return `ช่วงที่ ${i + 1}: วันปิดรับต้องไม่น้อยกว่าวันเริ่มทำงาน`;
      }
      // ถ้ามีเวลา ทั้งสตาร์ทและเอนด์ ต้องอยู่ในรูปแบบ HH:MM
      if (p.startTime && !/^\d{2}:\d{2}/.test(p.startTime)) {
        return `ช่วงที่ ${i + 1}: เวลาเริ่มไม่ถูกต้อง`;
      }
      if (p.endTime && !/^\d{2}:\d{2}/.test(p.endTime)) {
        return `ช่วงที่ ${i + 1}: เวลาสิ้นสุดไม่ถูกต้อง`;
      }
      // ถ้าวันเดียวกันและกรอกทั้ง startTime & endTime ให้ตรวจเวลา
      if (p.startDate && p.endDate && p.startDate === p.endDate && p.startTime && p.endTime) {
        if (p.endTime < p.startTime) return `ช่วงที่ ${i + 1}: เวลาสิ้นสุดต้องไม่น้อยกว่าเวลาเริ่ม`;
      }
    }

    // (ออปชัน) ตรวจซ้อนทับช่วง—ถ้าต้องการเข้มงวดค่อยเปิดใช้
    // const sorted = [...workPeriods].sort((a, b) => (a.startDate || "") < (b.startDate || "") ? -1 : 1);
    // for (let i = 1; i < sorted.length; i++) {
    //   const prev = sorted[i - 1], cur = sorted[i];
    //   const prevEnd = prev.endDate || prev.startDate;
    //   if (prevEnd && cur.startDate && cur.startDate < prevEnd) {
    //     return "ช่วงวันทำงานซ้อนทับกัน โปรดตรวจสอบ";
    //   }
    // }

    return null;
  };

  // ----- submit -----
  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      Swal.fire({ icon: "warning", title: err });
      return;
    }

    try {
      setSaving(true);
      const API = (import.meta.env.VITE_API_BASE || "http://localhost:5000").replace(/\/+$/, "");

      // เข้ากับ backend เดิม: ใช้ช่วงแรกเป็นฟิลด์เดิม + แนบ work_periods ทั้งหมด
      const first = workPeriods[0];
      const payload = {
        title: formData.title,
        description: formData.description,
        seats: Number(formData.seats) || 1,
        // เดิม
        work_date: first.startDate,
        work_end: first.endDate || null,
        // ใส่เพิ่มสำหรับรองรับเวลา (หาก backend ยังไม่ใช้ก็ไม่เป็นไร)
        work_time_start: first.startTime || null,
        work_time_end: first.endTime || null,
        // ใหม่: ส่งทั้งอาร์เรย์
        work_periods: workPeriods.map((p) => ({
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
        teacher: teacherName,
      };

      const res = await fetch(`${API}/api/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("ไม่สามารถบันทึกข้อมูลได้");
      await Swal.fire({
        icon: "success",
        title: "บันทึกสำเร็จ!",
        text: "ประกาศรับสมัครนิสิตถูกบันทึกแล้ว",
        confirmButtonText: "ตกลง",
      });
      navigate("/student-info");
    } catch (err) {
      Swal.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    Swal.fire({
      title: "ยกเลิกการกรอกข้อมูล?",
      text: "ข้อมูลที่กรอกจะไม่ถูกบันทึก",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ใช่, ยกเลิก",
      cancelButtonText: "กลับไปกรอกต่อ",
    }).then((r) => r.isConfirmed && navigate("/student-info"));
  };

  // ----- preview helpers -----
  const previewDateLine = (p) => {
    const dateStr = formatDateRangeTH(p.startDate, p.endDate || p.startDate);
    const timeStr =
      p.startTime || p.endTime
        ? ` (${p.startTime ? formatTimeHM(p.startTime) : "—"}–${p.endTime ? formatTimeHM(p.endTime) : "—"})`
        : "";
    return `${dateStr}${timeStr}`;
  };
  const previewDeadline = formData.deadline ? formatDateTH(formData.deadline) : null;

  return (
    <div className="min-vh-100" style={{ background: "linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%)" }}>
      {/* Top Bar */}
      <div
        className="d-flex align-items-center px-3"
        style={{
          height: 72,
          background: "linear-gradient(90deg, #6f42c1, #8e5cff)",
          boxShadow: "0 4px 14px rgba(111,66,193,.22)",
        }}
      >
        <img
          src="/src/assets/csit.jpg"
          alt="Logo"
          className="rounded-3 me-3"
          style={{ height: 40, width: 40, objectFit: "cover" }}
        />
        <h5 className="text-white fw-semibold m-0">CSIT Competency System — Teacher</h5>
        <div className="ms-auto d-flex align-items-center">
          <span className="text-white-50 me-3">{teacherName}</span>
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

      {/* Main */}
      <div className="container-xxl py-4">
        <div className="row g-4">
          {/* Form */}
          <div className="col-12 col-lg-7">
            <div className="card border-0 shadow-sm rounded-4 w-100" style={{ backdropFilter: "blur(6px)" }}>
              <div className="card-body p-4 p-lg-5">
                <h3 className="fw-semibold text-center mb-4">สร้างประกาศรับสมัครนิสิต</h3>

                <form onSubmit={handleSubmit}>
                  {/* ชื่อประกาศ */}
                  <div className="form-floating mb-3">
                    <input
                      type="text"
                      id="title"
                      className="form-control rounded-3"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      placeholder="ชื่อประกาศ"
                      required
                    />
                    <label htmlFor="title">ชื่อประกาศ</label>
                  </div>

                  {/* รายละเอียดงาน */}
                  <div className="form-floating mb-3">
                    <textarea
                      id="description"
                      className="form-control rounded-3"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="รายละเอียดงาน"
                      style={{ height: 120 }}
                      required
                    />
                    <label htmlFor="description">รายละเอียดงาน</label>
                  </div>

                  {/* จำนวนที่รับ / วันปิดรับ / สถานที่ */}
                  <div className="row g-3">
                    <div className="col-sm-4">
                      <div className="form-floating">
                        <input
                          type="number"
                          id="seats"
                          className="form-control rounded-3"
                          name="seats"
                          value={formData.seats}
                          onChange={handleChange}
                          min={1}
                          placeholder="จำนวนที่รับ"
                          required
                        />
                        <label htmlFor="seats">จำนวนที่รับ</label>
                      </div>
                    </div>

                    <div className="col-sm-4">
                      <div className="form-floating">
                        <input
                          type="date"
                          id="deadline"
                          className="form-control rounded-3"
                          name="deadline"
                          value={formData.deadline}
                          onChange={handleChange}
                          min={today}
                          placeholder="วันปิดรับสมัคร"
                        />
                        <label htmlFor="deadline">วันปิดรับสมัคร</label>
                      </div>
                      <div className="form-text">ไม่บังคับ (แต่ควรไม่น้อยกว่าวันเริ่มทำงาน)</div>
                    </div>

                    <div className="col-sm-4">
                      <div className="form-floating">
                        <input
                          type="text"
                          id="location"
                          className="form-control rounded-3"
                          name="location"
                          value={formData.location}
                          onChange={handleChange}
                          placeholder="ห้องแลบ 204 / ทำงานจากบ้าน"
                        />
                        <label htmlFor="location">สถานที่ทำงาน</label>
                      </div>
                    </div>
                  </div>

                  {/* ช่วงวันทำงาน (หลายช่วง + เวลา) */}
                  <div className="mt-4">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <h6 className="m-0">ช่วงวันทำงาน / เวลา</h6>
                      <button type="button" className="btn btn-sm btn-outline-primary rounded-pill" onClick={addPeriod}>
                        + เพิ่มช่วง
                      </button>
                    </div>

                    <div className="d-flex flex-column gap-3">
                      {workPeriods.map((p, idx) => (
                        <div key={idx} className="card border-0 shadow-sm rounded-3">
                          <div className="card-body">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                              <div className="fw-semibold">ช่วงที่ {idx + 1}</div>
                              {workPeriods.length > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger rounded-pill"
                                  onClick={() => removePeriod(idx)}
                                >
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
                                      <input
                                        type="date"
                                        className="form-control rounded-3"
                                        id={`startDate_${idx}`}
                                        value={p.startDate}
                                        onChange={(e) => handlePeriodChange(idx, "startDate", e.target.value)}
                                        min={today}
                                        placeholder="วันเริ่ม"
                                        required
                                      />
                                      <label htmlFor={`startDate_${idx}`}>วันเริ่ม</label>
                                    </div>
                                  </div>
                                  <div className="col-5">
                                    <div className="form-floating">
                                      <input
                                        type="time"
                                        className="form-control rounded-3"
                                        id={`startTime_${idx}`}
                                        value={p.startTime}
                                        onChange={(e) => handlePeriodChange(idx, "startTime", e.target.value)}
                                        placeholder="เวลาเริ่ม"
                                      />
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
                                      <input
                                        type="date"
                                        className="form-control rounded-3"
                                        id={`endDate_${idx}`}
                                        value={p.endDate}
                                        onChange={(e) => handlePeriodChange(idx, "endDate", e.target.value)}
                                        min={p.startDate || today}
                                        placeholder="วันสิ้นสุด"
                                      />
                                      <label htmlFor={`endDate_${idx}`}>วันสิ้นสุด (ถ้ามี)</label>
                                    </div>
                                  </div>
                                  <div className="col-5">
                                    <div className="form-floating">
                                      <input
                                        type="time"
                                        className="form-control rounded-3"
                                        id={`endTime_${idx}`}
                                        value={p.endTime}
                                        onChange={(e) => handlePeriodChange(idx, "endTime", e.target.value)}
                                        placeholder="เวลาสิ้นสุด"
                                      />
                                      <label htmlFor={`endTime_${idx}`}>เวลาสิ้นสุด</label>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="form-text mt-2">
                              ไม่ใส่เวลาได้ (จะถือว่าเป็นงานเต็มวันของช่วงนั้น)
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ชั้นปี / สาขา / สถานะ */}
                  <div className="row g-3 mt-3">
                    <div className="col-sm-4">
                      <div className="form-floating">
                        <select
                          id="year"
                          className="form-select rounded-3"
                          name="year"
                          value={formData.year}
                          onChange={handleChange}
                          required
                        >
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
                        <select
                          id="department"
                          className="form-select rounded-3"
                          name="department"
                          value={formData.department}
                          onChange={handleChange}
                          required
                        >
                          <option value="">เลือกสาขา</option>
                          <option value="วิทยาการคอมพิวเตอร์">วิทยาการคอมพิวพิวเตอร์</option>
                          <option value="เทคโนโลยีสารสนเทศ">เทคโนโลยีสารสนเทศ</option>
                          <option value="ไม่จำกัด">ไม่จำกัด</option>
                        </select>
                        <label htmlFor="department">สาขาที่เกี่ยวข้อง</label>
                      </div>
                    </div>

                    <div className="col-sm-3">
                      <div className="form-floating">
                        <select
                          id="status"
                          className="form-select rounded-3"
                          name="status"
                          value={formData.status}
                          onChange={handleChange}
                        >
                          <option value="open">เปิดรับ</option>
                          <option value="closed">ปิดรับ</option>
                          <option value="archived">เก็บถาวร</option>
                        </select>
                        <label htmlFor="status">สถานะประกาศ</label>
                      </div>
                    </div>
                  </div>

                  {/* ปุ่ม */}
                  <div className="d-flex flex-wrap gap-2 justify-content-end mt-4">
                    <button
                      type="button"
                      className="btn btn-outline-secondary rounded-pill"
                      onClick={handleCancel}
                      disabled={saving}
                    >
                      ยกเลิก
                    </button>
                    <button type="submit" className="btn btn-primary rounded-pill" disabled={saving}>
                      {saving && (
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      )}
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
              <div
                className="ratio"
                style={{
                  aspectRatio: "21/9",
                  background: "linear-gradient(135deg, #6f42c1, #b388ff)",
                  position: "relative",
                }}
              >
                <div className="position-absolute top-0 end-0 m-2">
                  <StatusBadge status={formData.status} />
                </div>
                {formData.year && (
                  <span className="badge bg-light text-dark position-absolute bottom-0 start-0 m-2 fw-bold">
                    ชั้นปี {formData.year}
                  </span>
                )}
              </div>
              <div className="card-body d-flex flex-column">
                <h5 className="mb-1 text-truncate" title={formData.title || "ชื่อประกาศ"}>
                  {formData.title || "ชื่อประกาศ"}
                </h5>
                <div className="small text-muted mb-2">
                  <i className="bi bi-person-workspace me-1" />
                  อาจารย์: <span className="fw-medium text-dark">{teacherName}</span>
                </div>

                {/* แสดงหลายช่วง */}
                <div className="small mb-2">
                  <i className="bi bi-calendar-event me-1" />
                  <div className="d-flex flex-column">
                    {workPeriods.filter(p => p.startDate).length ? (
                      workPeriods.map((p, i) => (
                        <div key={i} className="text-body">
                          • {previewDateLine(p)}
                        </div>
                      ))
                    ) : (
                      <span className="text-muted">ยังไม่เลือกช่วงวันทำงาน</span>
                    )}
                  </div>
                </div>

                {previewDeadline && (
                  <div className="small text-muted mb-2">
                    <i className="bi bi-hourglass me-1" />
                    ปิดรับ: {previewDeadline}
                  </div>
                )}

                <div className="small mb-2">
                  <i className="bi bi-mortarboard me-1" />
                  สาขา: <span className="fw-medium">{formData.department || "—"}</span>
                </div>

                {formData.location && (
                  <div className="small text-muted mb-2">
                    <i className="bi bi-geo-alt me-1" />
                    {formData.location}
                  </div>
                )}

                {formData.seats ? (
                  <div className="small text-muted mb-2">
                    <i className="bi bi-people me-1" />
                    รับ {formData.seats} คน
                  </div>
                ) : null}

                {formData.description && (
                  <p className="text-muted mb-0" style={{ whiteSpace: "pre-wrap" }}>
                    {formData.description}
                  </p>
                )}
              </div>
            </div>

            <div className="text-muted small mt-2">
              พรีวิวนี้เป็นภาพรวมการ์ดประกาศที่จะไปแสดงในหน้า “ประกาศรับสมัคร”
            </div>
          </div>
        </div>
      </div>

      {/* Local styles */}
      <style>{`
        .form-control:focus, .form-select:focus{
          box-shadow: 0 0 0 .2rem rgba(111,66,193,.12);
          border-color: #8e5cff;
        }
      `}</style>
    </div>
  );
};

export default AddAnnouncementPage;
