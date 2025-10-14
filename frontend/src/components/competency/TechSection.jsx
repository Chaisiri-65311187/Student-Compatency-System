// src/components/competency/TechSection.jsx
import React, { useEffect, useState } from "react";
import {
  listTrainings, addTraining,
  getLatestLanguagesAll, saveLanguage
} from "../../services/competencyApi";

// ปรับให้ date input เป็น yyyy-MM-dd
const asDateInput = (s) => (s ? String(s).slice(0, 10) : "");

export default function TechSection({ user }) {
  const [trainings, setTrainings] = useState([]);

  // ----- อบรม -----
  const [trainingId, setTrainingId] = useState("");
  const [trainingDate, setTrainingDate] = useState("");
  const [trainingProof, setTrainingProof] = useState("");

  // ----- ICT/ITPE -----
  const [ictScore, setIctScore] = useState("");
  const [ictDate, setIctDate] = useState("");
  const [itpeScore, setItpeScore] = useState("");
  const [itpeDate, setItpeDate] = useState("");
  const [savingExam, setSavingExam] = useState(false);

  const refresh = async () => {
    const t = await listTrainings(user.id);
    setTrainings(t.items || []);

    const langAll = await getLatestLanguagesAll(user.id);
    if (langAll?.ICT) {
      setIctScore(langAll.ICT.score_raw ?? "");
      setIctDate(asDateInput(langAll.ICT.taken_at));
    }
    if (langAll?.ITPE) {
      setItpeScore(langAll.ITPE.score_raw ?? "");
      setItpeDate(asDateInput(langAll.ITPE.taken_at));
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */}, []);

  const onAddTraining = async () => {
    if (!trainingId) return alert("กรอก training_id (เพิ่ม master ที่ admin ก่อน)");
    await addTraining({
      account_id: user.id,
      training_id: Number(trainingId),
      taken_at: trainingDate || null,
      proof_url: trainingProof || null,
    });
    setTrainingId(""); setTrainingDate(""); setTrainingProof("");
    refresh();
  };

  const saveIct = async () => {
    if (!ictScore) return alert("กรอกคะแนน ICT (เปอร์เซ็นต์ 0–100)");
    setSavingExam(true);
    try {
      await saveLanguage({
        account_id: user.id,
        framework: "ICT",
        level: null,
        score_raw: Number(ictScore),
        taken_at: ictDate || null,
      });
      alert("บันทึกคะแนน ICT สำเร็จ");
      refresh();
    } catch (e) {
      alert(e?.message || "บันทึกคะแนน ICT ไม่สำเร็จ");
    } finally {
      setSavingExam(false);
    }
  };

  const saveItpe = async () => {
    if (!itpeScore) return alert("กรอกคะแนน ITPE (เปอร์เซ็นต์ 0–100)");
    setSavingExam(true);
    try {
      await saveLanguage({
        account_id: user.id,
        framework: "ITPE",
        level: null,
        score_raw: Number(itpeScore),
        taken_at: itpeDate || null,
      });
      alert("บันทึกคะแนน ITPE สำเร็จ");
      refresh();
    } catch (e) {
      alert(e?.message || "บันทึกคะแนน ITPE ไม่สำเร็จ");
    } finally {
      setSavingExam(false);
    }
  };

  return (
    <div className="row g-4">
      {/* ---------- อบรม/เวิร์กช็อป ---------- */}
      <div className="col-12">
        <h6>อบรม/เวิร์กช็อป</h6>
        <div className="table-responsive">
          <table className="table">
            <thead><tr><th>หัวข้อ</th><th>ผู้จัด</th><th>ชั่วโมง</th><th>วันที่</th><th>หลักฐาน</th></tr></thead>
            <tbody>
              {trainings.map((t, i) => (
                <tr key={i}>
                  <td>{t.title}</td>
                  <td>{t.provider || "-"}</td>
                  <td>{t.hours ?? "-"}</td>
                  <td>{t.taken_at || "-"}</td>
                  <td>{t.proof_url ? <a href={t.proof_url} target="_blank" rel="noreferrer">link</a> : "-"}</td>
                </tr>
              ))}
              {!trainings.length && <tr><td colSpan={5} className="text-muted">ยังไม่มีอบรม</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="border rounded p-3">
          <div className="small text-muted mb-2">
            * ชั่วคราว: ต้องทราบ <b>training_id</b> จากระบบ
          </div>
          <div className="row g-2">
            <div className="col-3"><input className="form-control" placeholder="training_id"
                                           value={trainingId} onChange={(e)=>setTrainingId(e.target.value)} /></div>
            <div className="col-3"><input className="form-control" type="date"
                                           value={trainingDate} onChange={(e)=>setTrainingDate(e.target.value)} /></div>
            <div className="col-6"><input className="form-control" placeholder="หลักฐาน URL"
                                           value={trainingProof} onChange={(e)=>setTrainingProof(e.target.value)} /></div>
            <div className="col-12"><button className="btn btn-outline-primary" onClick={onAddTraining}>เพิ่มอบรม</button></div>
          </div>
        </div>
      </div>

      {/* ---------- คะแนนสอบ ICT / ITPE ---------- */}
      <div className="col-12">
        <div className="card shadow-sm">
          <div className="card-body">
            <h6 className="mb-3">บันทึกคะแนนสอบ ICT / ITPE</h6>

            <div className="row g-3">
              {/* ICT */}
              <div className="col-12 col-md-6">
                <div className="border rounded p-3 h-100">
                  <div className="fw-semibold mb-2">ICT</div>
                  <div className="row g-2">
                    <div className="col-5">
                      <input className="form-control" type="number" min="0" max="100" step="1"
                             placeholder="คะแนน ICT (% 0–100)"
                             value={ictScore} onChange={(e)=>setIctScore(e.target.value)} />
                    </div>
                    <div className="col-5">
                      <input className="form-control" type="date"
                             value={asDateInput(ictDate)} onChange={(e)=>setIctDate(e.target.value)} />
                    </div>
                    <div className="col-2">
                      <button className="btn btn-primary w-100" disabled={savingExam} onClick={saveIct}>บันทึก</button>
                    </div>
                  </div>
                  <div className="form-text mt-1">เกณฑ์ผ่าน ≥ 50%</div>
                </div>
              </div>

              {/* ITPE */}
              <div className="col-12 col-md-6">
                <div className="border rounded p-3 h-100">
                  <div className="fw-semibold mb-2">ITPE</div>
                  <div className="row g-2">
                    <div className="col-5">
                      <input className="form-control" type="number" min="0" max="100" step="1"
                             placeholder="คะแนน ITPE (% 0–100)"
                             value={itpeScore} onChange={(e)=>setItpeScore(e.target.value)} />
                    </div>
                    <div className="col-5">
                      <input className="form-control" type="date"
                             value={asDateInput(itpeDate)} onChange={(e)=>setItpeDate(e.target.value)} />
                    </div>
                    <div className="col-2">
                      <button className="btn btn-primary w-100" disabled={savingExam} onClick={saveItpe}>บันทึก</button>
                    </div>
                  </div>
                  <div className="form-text mt-1">IP ผ่าน ≥55% · FE ผ่าน ≥60%</div>
                </div>
              </div>
            </div>

            {savingExam && <div className="text-muted small mt-3">กำลังบันทึกคะแนน…</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
