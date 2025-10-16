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
  const label =
    status === "open" ? "เปิดรับ" : status === "closed" ? "ปิดรับ" : "เก็บถาวร";
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
    // ✅ เพิ่ม field จำนวนรับ
    seats: "", // ใช้เป็นอินพุตในฟอร์ม
  });

  // สำหรับพรีวิวข้อมูลความจุปัจจุบันตอนแก้ไข
  const [capInfo, setCapInfo] = useState({
    capacity: null,
    accepted_count: 0,
    remaining: null,
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
        // รองรับทั้ง capacity และ seats ที่มาจาก backend
        const rawCap = data?.capacity ?? data?.seats ?? "";
        const capNum =
          rawCap == null || String(rawCap).trim() === "" ? "" : String(Number(rawCap));

        setForm({
          title: data?.title || "",
          description: data?.description || "",
          department: data?.department || "",
          year: data?.year ?? "",
          status: data?.status || "open",
          deadline: toDateInput(data?.deadline),
          work_periods: Array.isArray(data?.work_periods) ? data.work_periods : [],
          seats: capNum, // ✅ แสดงจำนวนรับในช่องกรอก
        });

        setCapInfo({
          capacity:
            rawCap == null || String(rawCap).trim() === "" ? null : Number(rawCap),
          accepted_count: Number.isFinite(Number(data?.accepted_count))
            ? Number(data.accepted_count)
            : 0,
          remaining:
            data?.capacity == null
              ? null
              : Math.max(
                0,
                Number(data.capacity) -
                (Number.isFinite(Number(data?.accepted_count))
                  ? Number(data.accepted_count)
                  : 0)
              ),
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
      // ✅ map จำนวนรับ -> ส่งทั้ง seats และ capacity ให้ backend แน่นอน
      const payload = {
        ...form,
        teacher_id: user?.id ?? null,
        seats: form.seats ? Number(form.seats) : null,
        capacity: form.seats ? Number(form.seats) : null,
      };
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
    <div className="min-vh-100 position-relative bg-animated">
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
        {/* Header + Actions */}
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body d-flex flex-wrap align-items-center gap-2">
            <h4 className="m-0">{headerText}</h4>
            <div className="ms-auto small text-muted">
              สถานะปัจจุบัน: <StatusBadge status={form.status} />{" "}
              {form.deadline ? `· ปิดรับ ${formatTH(form.deadline)}` : ""}
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
              <form
                className="card border-0 shadow-sm rounded-4"
                onSubmit={onSubmit}
              >
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

                  {/* สาขา / ชั้นปี / สถานะ / เดดไลน์ / จำนวนรับ */}
                  <div className="row g-3">
                    <div className="col-sm-4">
                      <div className="form-floating">
                        <input
                          id="dept"
                          className="form-control rounded-3"
                          placeholder="สาขา"
                          value={form.department}
                          onChange={(e) =>
                            updateField("department", e.target.value)
                          }
                        />
                        <label htmlFor="dept">สาขาที่เกี่ยวข้อง</label>
                      </div>
                    </div>

                    <div className="col-sm-2">
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
                          onChange={(e) =>
                            updateField("deadline", e.target.value)
                          }
                        />
                        <label htmlFor="deadline">ปิดรับ</label>
                      </div>
                    </div>

                    {/* ✅ จำนวนรับ (คน) */}
                    <div className="col-sm-2">
                      <div className="form-floating">
                        <input
                          id="seats"
                          type="number"
                          min={1}
                          className="form-control rounded-3"
                          value={form.seats}
                          onChange={(e) => updateField("seats", e.target.value)}
                          placeholder="5"
                        />
                        <label htmlFor="seats">จำนวนรับ</label>
                      </div>
                    </div>
                  </div>

                  <hr className="my-4" />

                  {/* Work periods */}
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <h6 className="m-0">ช่วงวันที่ทำงาน</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary rounded-pill"
                      onClick={addPeriod}
                    >
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
                                    onChange={(e) =>
                                      updatePeriod(idx, "start_date", e.target.value)
                                    }
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
                                    onChange={(e) =>
                                      updatePeriod(idx, "end_date", e.target.value)
                                    }
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
                    <button
                      type="button"
                      className="btn btn-outline-secondary rounded-pill"
                      onClick={() => navigate(-1)}
                    >
                      ยกเลิก
                    </button>
                    <button
                      className="btn btn-primary rounded-pill"
                      type="submit"
                      disabled={saving}
                    >
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
                  <h5
                    className="mb-1 text-truncate"
                    title={form.title || "หัวข้อประกาศ"}
                  >
                    {form.title || "หัวข้อประกาศ"}
                  </h5>
                  <div className="small text-muted mb-2">
                    สาขา: <span className="fw-medium">{form.department || "—"}</span>
                    {form.deadline && <> · ปิดรับ {formatTH(form.deadline)}</>}
                    {/* ✅ แสดงจำนวนรับในพรีวิว */}
                    {form.seats && <> · รับ {form.seats} คน</>}
                  </div>

                  <div className="small mb-2">
                    <div className="text-muted">ช่วงวันที่ทำงาน:</div>
                    {form.work_periods?.length ? (
                      form.work_periods.map((p, i) => (
                        <div key={i}>
                          • {formatTH(p.start_date)}
                          {p.end_date && p.end_date !== p.start_date
                            ? ` – ${formatTH(p.end_date)}`
                            : ""}
                        </div>
                      ))
                    ) : (
                      <span className="text-muted">ยังไม่เลือกช่วง</span>
                    )}
                  </div>

                  {form.description && (
                    <p
                      className="text-muted mb-0"
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      {form.description}
                    </p>
                  )}
                </div>
              </div>

              {/* ถ้าเป็นแก้ไข: โชว์สถานะจำนวนรับปัจจุบัน (อิงข้อมูลที่โหลดมา) */}
              {isEdit && (
                <div className="card border-0 shadow-sm rounded-4 mt-3">
                  <div className="card-body small">
                    <div className="fw-semibold mb-1">สรุปจำนวนรับ (ปัจจุบัน)</div>
                    <div>รับทั้งหมด: {capInfo.capacity ?? "ไม่จำกัด"}</div>
                    <div>รับแล้ว: {capInfo.accepted_count}</div>
                    <div>
                      คงเหลือ:{" "}
                      {capInfo.capacity == null
                        ? "ไม่จำกัด"
                        : Math.max(
                          0,
                          (capInfo.capacity || 0) - (capInfo.accepted_count || 0)
                        )}
                    </div>
                    <div className="text-muted mt-2">
                      * การเปลี่ยน “จำนวนรับ” ในแบบฟอร์มด้านซ้ายจะบันทึกเป็นค่าใหม่ทันทีเมื่อกด “บันทึกการแก้ไข”
                    </div>
                  </div>
                </div>
              )}

              <div className="text-muted small mt-2">
                พรีวิวหน้าตาการ์ดที่จะไปแสดงหน้า “ประกาศรับสมัคร”
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Local styles */}
      <style>{`
        /* ===== Animated gradient bg & blobs (match Welcome/Login) ===== */
        .bg-animated {
          background: radial-gradient(1200px 600px at 10% -10%, #efe7ff 15%, transparent 60%),
                      radial-gradient(1000px 500px at 110% 10%, #e6f0ff 10%, transparent 55%),
                      linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%);
        }
        .glassy { backdrop-filter: blur(8px); }
        .topbar { position: sticky; top: 0; left: 0; width: 100%; background: linear-gradient(90deg, rgba(111,66,193,.9), rgba(142,92,255,.9)); box-shadow: 0 4px 16px rgba(111,66,193,.22); z-index: 1040; border-bottom: 1px solid rgba(255,255,255,.12); }

        .glass-card{ backdrop-filter: blur(6px); transition: transform .15s ease, box-shadow .15s ease; }
        .glass-card:hover{ transform: translateY(-2px); box-shadow: 0 12px 30px rgba(28,39,49,.12)!important; }
        .line-clamp-3{ display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
        .chip{ padding:.35rem .75rem; }

        .ratio-21x9{ aspect-ratio:21/9; width:100%; background:transparent; border-radius:1rem 1rem 0 0; overflow:hidden; }
        .banner-overlay{ position:absolute; inset:0; display:flex; justify-content:space-between; align-items:flex-start; padding:.5rem; pointer-events:none; }
        .banner-overlay .status-wrap, .banner-overlay .year-pill{ pointer-events:auto; }

        .year-pill{ display:inline-flex; align-items:center; padding:.45rem .9rem; border-radius:9999px; font-weight:700; font-size:.97rem; letter-spacing:.2px; color:#fff; background:linear-gradient(135deg,#0091ff,#6dd5fa); box-shadow:0 6px 18px rgba(0,0,0,.12); border:none; }
        .year-pill.year2{ background:linear-gradient(135deg,#6a11cb,#2575fc); }
        .year-pill.year3{ background:linear-gradient(135deg,#f7971e,#ffd200); color:#222; }
        .year-pill.year4{ background:linear-gradient(135deg,#ff416c,#ff4b2b); }
        .banner-overlay .badge{ font-size:.85rem; padding:.38rem .6rem; }

        /* Ripple */
        .ripple { position: relative; overflow: hidden; }
        .ripple:after { content: ""; position: absolute; inset: 0; border-radius: inherit; opacity: 0; background: radial-gradient(circle at var(--x,50%) var(--y,50%), rgba(255,255,255,.45), transparent 40%); transform: scale(0.2); transition: transform .3s, opacity .45s; pointer-events: none; }
        .ripple:active:after { opacity: 1; transform: scale(1); transition: 0s; }
        .ripple { --x: 50%; --y: 50%; }
        .ripple:focus-visible { outline: 3px solid rgba(142,92,255,.45); outline-offset: 2px; }

        /* Background blobs */
html, body {
  overflow-x: hidden;
}

/* ป้องกัน blob ล้นจอ */
.bg-blob {
  position: absolute;
  filter: blur(60px);
  opacity: .55;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  max-width: 100vw;
  will-change: transform;
}

/* ให้ container หลักไม่ล้น */
.bg-animated {
  overflow-x: hidden;
  width: 100%;
  max-width: 100vw;
}

.bg-blob-1{ width:420px; height:420px; left:-120px; top:-80px;  background:#d7c6ff; animation:drift1 18s ease-in-out infinite; }
.bg-blob-2{ width:360px; height:360px; right:-120px; top:120px; background:#c6ddff; animation:drift2 22s ease-in-out infinite; }
.bg-blob-3{ width:300px; height:300px; left:15%; bottom:-120px; background:#ffd9ec; animation:drift3 20s ease-in-out infinite; }

@keyframes drift1{ 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,10px)} }
@keyframes drift2{ 0%,100%{transform:translate(0,0)} 50%{transform:translate(-16px,8px)} }
@keyframes drift3{ 0%,100%{transform:translate(0,0)} 50%{transform:translate(12px,-12px)} }

      `}</style>

      {/* tiny script to position ripple center under cursor */}
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
