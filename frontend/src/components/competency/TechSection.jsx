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
const isValidUrl = (u) => {
  if (!u) return true;
  try { new URL(u); return true; } catch { return false; }
};
const isValidPercent = (v) => {
  if (v === "" || v == null) return false;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100;
};

export default function TechSection({ user }) {
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);

  // ----- อบรม -----
  const [trainingId, setTrainingId] = useState("");
  const [trainingDate, setTrainingDate] = useState("");
  const [trainingProof, setTrainingProof] = useState("");
  const [adding, setAdding] = useState(false);

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
    if (!String(trainingId).trim()) {
      return Swal.fire("ยังไม่กรอก training_id", "กรุณาระบุรหัสคอร์สอบรม", "warning");
    }
    const tid = Number(trainingId);
    if (!Number.isInteger(tid) || tid <= 0) {
      return Swal.fire("training_id ไม่ถูกต้อง", "ต้องเป็นเลขจำนวนเต็มมากกว่า 0", "warning");
    }
    if (trainingProof && !isValidUrl(trainingProof)) {
      return Swal.fire("URL ไม่ถูกต้อง", "โปรดตรวจสอบลิงก์หลักฐาน", "warning");
    }
    try {
      setAdding(true);
      await addTraining({
        account_id: user.id,
        training_id: tid,
        taken_at: trainingDate || null,
        proof_url: trainingProof || null,
      });
      setTrainingId(""); setTrainingDate(""); setTrainingProof("");
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
        <h6>อบรม/เวิร์กช็อป</h6>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>หัวข้อ</th><th>ผู้จัด</th><th>ชั่วโมง</th><th>วันที่</th><th>หลักฐาน</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-muted">กำลังโหลด…</td></tr>
              ) : (
                <>
                  {trainings.map((t, i) => (
                    <tr key={i}>
                      <td>{t.title}</td>
                      <td>{t.provider || "-"}</td>
                      <td>{t.hours ?? "-"}</td>
                      <td>{asDateInput(t.taken_at) || "-"}</td>
                      <td>{t.proof_url ? <a href={t.proof_url} target="_blank" rel="noreferrer">link</a> : "-"}</td>
                    </tr>
                  ))}
                  {!trainings.length && (
                    <tr><td colSpan={5} className="text-muted">ยังไม่มีอบรม</td></tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="border rounded p-3">
          <div className="small text-muted mb-2">
            * ชั่วคราว: ต้องทราบ <b>training_id</b> จากระบบ
          </div>
          <div className="row g-2">
            <div className="col-3">
              <input className="form-control" placeholder="training_id"
                     value={trainingId} onChange={(e)=>setTrainingId(e.target.value)}
                     disabled={adding} />
            </div>
            <div className="col-3">
              <input className="form-control" type="date"
                     value={trainingDate} onChange={(e)=>setTrainingDate(e.target.value)}
                     disabled={adding} />
            </div>
            <div className="col-6">
              <input className="form-control" placeholder="หลักฐาน URL"
                     value={trainingProof} onChange={(e)=>setTrainingProof(e.target.value)}
                     disabled={adding} />
            </div>
            <div className="col-12">
              <button className="btn btn-outline-primary" onClick={onAddTraining} disabled={adding}>
                {adding ? "กำลังบันทึก..." : "เพิ่มอบรม"}
              </button>
            </div>
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
                             value={ictScore} onChange={(e)=>setIctScore(e.target.value)} disabled={savingIct} />
                    </div>
                    <div className="col-5">
                      <input className="form-control" type="date"
                             value={ictDate} onChange={(e)=>setIctDate(e.target.value)} disabled={savingIct} />
                    </div>
                    <div className="col-2">
                      <button className="btn btn-primary w-100"
                              disabled={savingIct || !isValidPercent(ictScore)} onClick={saveIct}>
                        {savingIct ? "…" : "บันทึก"}
                      </button>
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
                             value={itpeScore} onChange={(e)=>setItpeScore(e.target.value)} disabled={savingItpe} />
                    </div>
                    <div className="col-5">
                      <input className="form-control" type="date"
                             value={itpeDate} onChange={(e)=>setItpeDate(e.target.value)} disabled={savingItpe} />
                    </div>
                    <div className="col-2">
                      <button className="btn btn-primary w-100"
                              disabled={savingItpe || !isValidPercent(itpeScore)} onClick={saveItpe}>
                        {savingItpe ? "…" : "บันทึก"}
                      </button>
                    </div>
                  </div>
                  <div className="form-text mt-1">IP ผ่าน ≥55% · FE ผ่าน ≥60%</div>
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
