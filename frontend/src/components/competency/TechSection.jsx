// src/components/competency/TechSection.jsx
import React, { useEffect, useState } from "react";
import {
  listTrainings,
  addTraining,
  getLatestLanguagesAll,
  saveLanguage,
} from "../../services/competencyApi";
import Swal from "sweetalert2";

// date → yyyy-MM-dd (สำหรับ input[type=date])
const asDateInput = (s) => (s ? String(s).slice(0, 10) : "");

// Toast มุมขวาบน
const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 1800,
  timerProgressBar: true,
});

// helpers
// ไม่ต้องใช้ isValidUrl แล้ว เพราะเปลี่ยนเป็น file upload
const isValidPercent = (v) => {
  if (v === "" || v == null) return false;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100;
};

export default function TechSection({ user }) {
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);

  // ----- อบรม -----
  const [trainingTitle, setTrainingTitle] = useState("");
  const [trainingDate, setTrainingDate] = useState("");
  const [trainingFile, setTrainingFile] = useState(null);
  const [adding, setAdding] = useState(false);
  const fileInputRef = React.useRef(null);

  // ----- ICT/ITPE -----
  const [ictScore, setIctScore] = useState("");
  const [ictDate, setIctDate] = useState("");

  const [itpeScore, setItpeScore] = useState("");
  const [itpeDate, setItpeDate] = useState("");

  const [savingIct, setSavingIct] = useState(false);
  const [savingItpe, setSavingItpe] = useState(false);

  const refresh = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const t = await listTrainings(user.id);
      setTrainings(t.items || []);

      const langAll = await getLatestLanguagesAll(user.id);
      if (langAll?.ICT) {
        setIctScore(
          langAll.ICT.score_raw != null ? String(langAll.ICT.score_raw) : ""
        );
        setIctDate(asDateInput(langAll.ICT.taken_at));
      } else {
        setIctScore("");
        setIctDate("");
      }
      if (langAll?.ITPE) {
        setItpeScore(
          langAll.ITPE.score_raw != null ? String(langAll.ITPE.score_raw) : ""
        );
        setItpeDate(asDateInput(langAll.ITPE.taken_at));
      } else {
        setItpeScore("");
        setItpeDate("");
      }
    } catch (e) {
      Swal.fire("โหลดข้อมูลไม่สำเร็จ", e?.message || "กรุณาลองใหม่", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const onAddTraining = async () => {
    if (!String(trainingTitle).trim()) {
      return Swal.fire("ยังไม่กรอกชื่อ", "กรุณาระบุชื่อใบรับรอง หรือ หัวข้ออบรม", "warning");
    }
    try {
      setAdding(true);

      const formData = new FormData();
      formData.append("account_id", user.id);
      formData.append("title", trainingTitle.trim());
      if (trainingDate) formData.append("taken_at", trainingDate);
      if (trainingFile) formData.append("proof_file", trainingFile);

      await addTraining(formData);

      setTrainingTitle("");
      setTrainingDate("");
      setTrainingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      await refresh();
      Toast.fire({ icon: "success", title: "เพิ่มอบรมแล้ว" });
    } catch (e) {
      Swal.fire("บันทึกไม่สำเร็จ", e?.message || "กรุณาลองใหม่", "error");
    } finally {
      setAdding(false);
    }
  };

  const saveIct = async () => {
    if (!isValidPercent(ictScore)) {
      return Swal.fire("คะแนน ICT ไม่ถูกต้อง", "กรุณาใส่ตัวเลข 0–100", "warning");
    }
    if (ictDate && Number.isNaN(new Date(ictDate).getTime())) {
      return Swal.fire("วันที่ ICT ไม่ถูกต้อง", "โปรดเลือกวันที่สอบ", "warning");
    }
    setSavingIct(true);
    try {
      await saveLanguage({
        account_id: user.id,
        framework: "ICT",
        level: null,
        score_raw: Number(ictScore),
        taken_at: ictDate || null,
      });
      await refresh();
      Toast.fire({ icon: "success", title: "บันทึกคะแนน ICT แล้ว" });
    } catch (e) {
      Swal.fire("บันทึกคะแนน ICT ไม่สำเร็จ", e?.message || "กรุณาลองใหม่", "error");
    } finally {
      setSavingIct(false);
    }
  };

  const saveItpe = async () => {
    if (!isValidPercent(itpeScore)) {
      return Swal.fire("คะแนน ITPE ไม่ถูกต้อง", "กรุณาใส่ตัวเลข 0–100", "warning");
    }
    if (itpeDate && Number.isNaN(new Date(itpeDate).getTime())) {
      return Swal.fire("วันที่ ITPE ไม่ถูกต้อง", "โปรดเลือกวันที่สอบ", "warning");
    }
    setSavingItpe(true);
    try {
      await saveLanguage({
        account_id: user.id,
        framework: "ITPE", // ถ้า backend แยก IP/FE ให้เปลี่ยนให้ตรง schema
        level: null,
        score_raw: Number(itpeScore),
        taken_at: itpeDate || null,
      });
      await refresh();
      Toast.fire({ icon: "success", title: "บันทึกคะแนน ITPE แล้ว" });
    } catch (e) {
      Swal.fire("บันทึกคะแนน ITPE ไม่สำเร็จ", e?.message || "กรุณาลองใหม่", "error");
    } finally {
      setSavingItpe(false);
    }
  };

  if (!user?.id) return <div className="text-muted">กำลังเตรียมข้อมูลผู้ใช้…</div>;

  return (
    <div className="row g-4">
      {/* ---------- อบรม/เวิร์กช็อป ---------- */}
      <div className="col-12">
        <h6 className="fw-bold mb-3">อบรม/เวิร์กช็อป</h6>
        <div className="table-responsive rounded-4 shadow-sm border-0 mb-3">
          <table className="table align-middle table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ borderTop: "none" }}>หัวข้อ</th>
                <th style={{ borderTop: "none" }}>วันที่</th>
                <th style={{ borderTop: "none" }}>หลักฐาน</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="text-muted p-3">กำลังโหลด…</td></tr>
              ) : (
                <>
                  {trainings.map((t, i) => {
                    // รองรับทั้ง proof_url (ข้อมูลเดิม) และ proof_file_path (ข้อมูลใหม่)
                    const proofLink = t.proof_file_path
                      ? `${import.meta.env?.VITE_API_BASE || 'http://localhost:3000'}${t.proof_file_path}`
                      : t.proof_url;
                    return (
                      <tr key={i}>
                        <td className="fw-semibold text-dark">{t.title || "-"}</td>
                        <td>{asDateInput(t.taken_at) || "-"}</td>
                        <td>
                          {proofLink ? (
                            <a href={proofLink} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary rounded-pill">
                              <i className="bi bi-file-earmark me-1"></i>ดูหลักฐาน
                            </a>
                          ) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                  {!trainings.length && (
                    <tr><td colSpan={3} className="text-muted p-3 text-center">ยังไม่มีข้อมูลอบรม</td></tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="card border-0 shadow-sm rounded-4 bg-light">
          <div className="card-body">
            <div className="small text-muted mb-2">
              <i className="bi bi-plus-circle me-1"></i>
              เพิ่มข้อมูลอบรม/ใบรับรอง
            </div>
            <div className="row g-2">
              <div className="col-md-4 col-12">
                <input
                  className="form-control rounded-3 border-0"
                  placeholder="ชื่อใบรับรอง หรือ หัวข้ออบรม"
                  value={trainingTitle}
                  onChange={(e) => setTrainingTitle(e.target.value)}
                  disabled={adding}
                />
              </div>
              <div className="col-md-2 col-6">
                <input
                  className="form-control rounded-3 border-0"
                  type="date"
                  value={trainingDate}
                  onChange={(e) => setTrainingDate(e.target.value)}
                  disabled={adding}
                />
              </div>
              <div className="col-md-4 col-6">
                <input
                  ref={fileInputRef}
                  className="form-control rounded-3 border-0"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setTrainingFile(e.target.files?.[0] || null)}
                  disabled={adding}
                />
              </div>
              <div className="col-md-2 col-12">
                <button
                  className="btn btn-outline-primary w-100 rounded-pill shadow-sm"
                  onClick={onAddTraining}
                  disabled={adding || !trainingTitle.trim()}
                >
                  {adding ? "กำลังบันทึก…" : "เพิ่ม"}
                </button>
              </div>
            </div>
            <div className="form-text mt-2 small">
              รองรับไฟล์ PDF, รูปภาพ (JPG, PNG), Word (ขนาดไม่เกิน 10MB)
            </div>
          </div>
        </div>
      </div>

      {/* ---------- คะแนนสอบ ICT / ITPE ---------- */}
      <div className="col-12">
        <div className="card shadow-sm border-0 rounded-4">
          <div className="card-body">
            <h6 className="mb-3 fw-bold">บันทึกคะแนนสอบ ICT / ITPE</h6>

            <div className="row g-3">
              {/* ICT */}
              <div className="col-12 col-md-6">
                <div className="card bg-light border-0 rounded-4 h-100">
                  <div className="card-body">
                    <div className="fw-semibold mb-2 text-primary">ICT</div>
                    <div className="row g-2">
                      <div className="col-12">
                        <input className="form-control rounded-3 border-0" type="number" min="0" max="100" step="1"
                          placeholder="คะแนน ICT (% 0–100)"
                          value={ictScore} onChange={(e) => setIctScore(e.target.value)} disabled={savingIct} />
                      </div>
                      <div className="col-8">
                        <input className="form-control rounded-3 border-0" type="date"
                          value={ictDate} onChange={(e) => setIctDate(e.target.value)} disabled={savingIct} />
                      </div>
                      <div className="col-4">
                        <button className="btn btn-primary w-100 rounded-pill shadow-sm"
                          disabled={savingIct || !isValidPercent(ictScore)} onClick={saveIct}
                          style={{ background: "linear-gradient(135deg, #0d6efd, #0a58ca)", border: "none" }}>
                          {savingIct ? "…" : "บันทึก"}
                        </button>
                      </div>
                    </div>
                    <div className="form-text mt-2 small">เกณฑ์ผ่าน ≥ 50%</div>
                  </div>
                </div>
              </div>

              {/* ITPE */}
              <div className="col-12 col-md-6">
                <div className="card bg-light border-0 rounded-4 h-100">
                  <div className="card-body">
                    <div className="fw-semibold mb-2 text-primary">ITPE</div>
                    <div className="row g-2">
                      <div className="col-12">
                        <input className="form-control rounded-3 border-0" type="number" min="0" max="100" step="1"
                          placeholder="คะแนน ITPE (% 0–100)"
                          value={itpeScore} onChange={(e) => setItpeScore(e.target.value)} disabled={savingItpe} />
                      </div>
                      <div className="col-8">
                        <input className="form-control rounded-3 border-0" type="date"
                          value={itpeDate} onChange={(e) => setItpeDate(e.target.value)} disabled={savingItpe} />
                      </div>
                      <div className="col-4">
                        <button className="btn btn-primary w-100 rounded-pill shadow-sm"
                          disabled={savingItpe || !isValidPercent(itpeScore)} onClick={saveItpe}
                          style={{ background: "linear-gradient(135deg, #0d6efd, #0a58ca)", border: "none" }}>
                          {savingItpe ? "…" : "บันทึก"}
                        </button>
                      </div>
                    </div>
                    <div className="form-text mt-2 small">IP ผ่าน ≥55% · FE ผ่าน ≥60%</div>
                  </div>
                </div>
              </div>
            </div>

            {(savingIct || savingItpe) && (
              <div className="text-muted small mt-3">กำลังบันทึกคะแนน…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
