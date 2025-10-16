// src/pages/EditAnnouncementPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getAnnouncement as getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
} from "../services/announcementsApi";

const tz = "Asia/Bangkok";
const toDateInput = (v) => (v ? String(v).slice(0, 10) : "");
const formatTH = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d)) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: tz,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
};

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

export default function EditAnnouncementPage({ mode = "edit" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = mode === "edit";

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    department: "",
    year: "",
    status: "open",
    deadline: "",
    work_periods: [], // [{ start_date, end_date }]
  });

  const headerText = useMemo(
    () => (isEdit ? "แก้ไขประกาศ" : "สร้างประกาศใหม่"),
    [isEdit]
  );

  // โหลดข้อมูลเดิมเมื่อเป็นโหมดแก้ไข
  useEffect(() => {
    if (!isEdit || !id) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getAnnouncementById(id);
        setForm({
          title: data?.title || "",
          description: data?.description || "",
          department: data?.department || "",
          year: data?.year ?? "",
          status: data?.status || "open",
          deadline: toDateInput(data?.deadline),
          work_periods: Array.isArray(data?.work_periods) ? data.work_periods : [],
        });
      } catch (e) {
        console.error(e);
        setError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, id]);

  const updateField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // จัดการช่วงเวลาปฏิบัติงาน
  const addPeriod = () =>
    setForm((p) => ({
      ...p,
      work_periods: [...(p.work_periods || []), { start_date: "", end_date: "" }],
    }));

  const updatePeriod = (idx, k, v) =>
    setForm((p) => {
      const arr = [...(p.work_periods || [])];
      arr[idx] = { ...arr[idx], [k]: v };
      return { ...p, work_periods: arr };
    });

  const removePeriod = (idx) =>
    setForm((p) => {
      const arr = [...(p.work_periods || [])];
      arr.splice(idx, 1);
      return { ...p, work_periods: arr };
    });

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, teacher_id: user?.id ?? null };
      if (isEdit) {
        await updateAnnouncement(id, payload);
        alert("บันทึกการแก้ไขสำเร็จ");
      } else {
        await createAnnouncement(payload);
        alert("สร้างประกาศใหม่สำเร็จ");
      }
      navigate("/teacher-announcements");
    } catch (e) {
      console.error(e);
      setError(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-vh-100" style={{ background: "linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%)" }}>
      {/* Top Bar ให้โทนเดียวกับหน้าอื่น */}
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
        <div className="ms-auto">
          <button className="btn btn-light btn-sm rounded-pill me-2" onClick={() => navigate(-1)}>
            ← ย้อนกลับ
          </button>
          <button className="btn btn-light btn-sm rounded-pill" onClick={() => navigate("/teacher-announcements")}>
            รายการประกาศของฉัน
          </button>
        </div>
      </div>

      <div className="container-xxl py-4">
        {/* Header + Actions */}
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body d-flex flex-wrap align-items-center gap-2">
            <h4 className="m-0">{headerText}</h4>
            <div className="ms-auto small text-muted">
              สถานะปัจจุบัน: <StatusBadge status={form.status} /> {form.deadline ? `· ปิดรับ ${formatTH(form.deadline)}` : ""}
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger rounded-4">{error}</div>}

        {loading ? (
          <div className="text-muted">
            <span className="spinner-border spinner-border-sm me-2" />
            กำลังโหลดข้อมูล…
          </div>
        ) : (
          <div className="row g-4">
            {/* ฟอร์ม */}
            <div className="col-12 col-lg-7">
              <form className="card border-0 shadow-sm rounded-4" onSubmit={onSubmit}>
                <div className="card-body p-4 p-lg-5">
                  {/* หัวข้อ */}
                  <div className="form-floating mb-3">
                    <input
                      id="title"
                      className="form-control rounded-3"
                      value={form.title}
                      onChange={(e) => updateField("title", e.target.value)}
                      placeholder="หัวข้อ"
                      required
                    />
                    <label htmlFor="title">หัวข้อประกาศ</label>
                  </div>

                  {/* รายละเอียด */}
                  <div className="form-floating mb-3">
                    <textarea
                      id="desc"
                      className="form-control rounded-3"
                      value={form.description}
                      onChange={(e) => updateField("description", e.target.value)}
                      placeholder="รายละเอียด"
                      style={{ height: 140 }}
                    />
                    <label htmlFor="desc">รายละเอียดงาน</label>
                  </div>

                  {/* สาขา / ชั้นปี / สถานะ / เดดไลน์ */}
                  <div className="row g-3">
                    <div className="col-sm-5">
                      <div className="form-floating">
                        <input
                          id="dept"
                          className="form-control rounded-3"
                          placeholder="สาขา"
                          value={form.department}
                          onChange={(e) => updateField("department", e.target.value)}
                        />
                        <label htmlFor="dept">สาขาที่เกี่ยวข้อง</label>
                      </div>
                    </div>

                    <div className="col-sm-3">
                      <div className="form-floating">
                        <select
                          id="year"
                          className="form-select rounded-3"
                          value={form.year}
                          onChange={(e) => updateField("year", e.target.value)}
                        >
                          <option value="">ทุกชั้นปี</option>
                          <option value="1">ชั้นปี 1</option>
                          <option value="2">ชั้นปี 2</option>
                          <option value="3">ชั้นปี 3</option>
                          <option value="4">ชั้นปี 4</option>
                        </select>
                        <label htmlFor="year">ชั้นปีที่สมัครได้</label>
                      </div>
                    </div>

                    <div className="col-sm-2">
                      <div className="form-floating">
                        <select
                          id="status"
                          className="form-select rounded-3"
                          value={form.status}
                          onChange={(e) => updateField("status", e.target.value)}
                        >
                          <option value="open">เปิดรับ</option>
                          <option value="closed">ปิดรับ</option>
                          <option value="archived">เก็บถาวร</option>
                        </select>
                        <label htmlFor="status">สถานะ</label>
                      </div>
                    </div>

                    <div className="col-sm-2">
                      <div className="form-floating">
                        <input
                          id="deadline"
                          type="date"
                          className="form-control rounded-3"
                          value={toDateInput(form.deadline)}
                          onChange={(e) => updateField("deadline", e.target.value)}
                        />
                        <label htmlFor="deadline">ปิดรับ</label>
                      </div>
                    </div>
                  </div>

                  <hr className="my-4" />

                  {/* Work periods */}
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <h6 className="m-0">ช่วงวันที่ทำงาน</h6>
                    <button type="button" className="btn btn-sm btn-outline-primary rounded-pill" onClick={addPeriod}>
                      + เพิ่มช่วง
                    </button>
                  </div>

                  {form.work_periods?.length ? (
                    <div className="d-flex flex-column gap-2">
                      {form.work_periods.map((p, idx) => (
                        <div className="card border-0 shadow-sm rounded-3" key={idx}>
                          <div className="card-body">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                              <div className="fw-semibold">ช่วงที่ {idx + 1}</div>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger rounded-pill"
                                onClick={() => removePeriod(idx)}
                              >
                                ลบช่วง
                              </button>
                            </div>
                            <div className="row g-2">
                              <div className="col-6">
                                <div className="form-floating">
                                  <input
                                    type="date"
                                    id={`start_${idx}`}
                                    className="form-control rounded-3"
                                    value={toDateInput(p.start_date)}
                                    onChange={(e) => updatePeriod(idx, "start_date", e.target.value)}
                                  />
                                  <label htmlFor={`start_${idx}`}>เริ่ม</label>
                                </div>
                              </div>
                              <div className="col-6">
                                <div className="form-floating">
                                  <input
                                    type="date"
                                    id={`end_${idx}`}
                                    className="form-control rounded-3"
                                    value={toDateInput(p.end_date)}
                                    onChange={(e) => updatePeriod(idx, "end_date", e.target.value)}
                                  />
                                  <label htmlFor={`end_${idx}`}>สิ้นสุด (ถ้ามี)</label>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted small">ยังไม่มีช่วงวันที่ทำงาน</div>
                  )}

                  <div className="d-flex flex-wrap gap-2 justify-content-end mt-4">
                    <button type="button" className="btn btn-outline-secondary rounded-pill" onClick={() => navigate(-1)}>
                      ยกเลิก
                    </button>
                    <button className="btn btn-primary rounded-pill" type="submit" disabled={saving}>
                      {saving ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" />
                          กำลังบันทึก…
                        </>
                      ) : isEdit ? (
                        "บันทึกการแก้ไข"
                      ) : (
                        "สร้างประกาศ"
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* พรีวิวแบบการ์ด (ช่วยเช็คหน้าตา) */}
            <div className="col-12 col-lg-5">
              <div className="card shadow-sm border-0 rounded-4 overflow-hidden h-100">
                <div
                  className="ratio"
                  style={{
                    aspectRatio: "21/9",
                    background: "linear-gradient(135deg,#6f42c1,#b388ff)",
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
                  <h5 className="mb-1 text-truncate" title={form.title || "หัวข้อประกาศ"}>
                    {form.title || "หัวข้อประกาศ"}
                  </h5>
                  <div className="small text-muted mb-2">
                    สาขา: <span className="fw-medium">{form.department || "—"}</span>
                    {form.deadline && <> · ปิดรับ {formatTH(form.deadline)}</>}
                  </div>

                  <div className="small mb-2">
                    <div className="text-muted">ช่วงวันที่ทำงาน:</div>
                    {form.work_periods?.length ? (
                      form.work_periods.map((p, i) => (
                        <div key={i}>
                          • {formatTH(p.start_date)}{p.end_date && p.end_date !== p.start_date ? ` – ${formatTH(p.end_date)}` : ""}
                        </div>
                      ))
                    ) : (
                      <span className="text-muted">ยังไม่เลือกช่วง</span>
                    )}
                  </div>

                  {form.description && (
                    <p className="text-muted mb-0" style={{ whiteSpace: "pre-wrap" }}>
                      {form.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-muted small mt-2">พรีวิวหน้าตาการ์ดที่จะไปแสดงหน้า “ประกาศรับสมัคร”</div>
            </div>
          </div>
        )}
      </div>

      {/* แต่งโฟกัส/เงาให้กลืนกับหน้าอื่น */}
      <style>{`
        .form-control:focus, .form-select:focus{
          box-shadow: 0 0 0 .2rem rgba(111,66,193,.12);
          border-color: #8e5cff;
        }
      `}</style>
    </div>
  );
}
