import React, { useEffect, useState } from "react";
import { getLatestLanguage, saveLanguage } from "../../services/competencyApi";
const LEVELS = ["A1","A2","B1","B2","C1","C2"];

export default function LanguageSection({ user }){
  const [latest, setLatest] = useState(null);
  const [level, setLevel] = useState("");
  const [date, setDate] = useState("");
  const [raw, setRaw] = useState("");

  useEffect(()=>{ getLatestLanguage(user.id).then(r=> setLatest(r.latest||null)); },[user.id]);

  const onSave = async ()=>{
    if (!level) return alert("เลือกระดับ CEPT ก่อน");
    await saveLanguage({ account_id:user.id, framework:"CEPT", level, taken_at: date||null, score_raw: raw||null });
    const r = await getLatestLanguage(user.id);
    setLatest(r.latest||null);
    setLevel(""); setDate(""); setRaw("");
    alert("บันทึกผลภาษาเรียบร้อย");
  };

  return (
    <div className="row g-3">
      <div className="col-12 col-md-4">
        <label className="form-label">ระดับ CEPT</label>
        <select className="form-select" value={level} onChange={e=>setLevel(e.target.value)}>
          <option value="">เลือก</option>
          {LEVELS.map(l=> <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <div className="col-6 col-md-4">
        <label className="form-label">วันที่สอบ</label>
        <input className="form-control" type="date" value={date} onChange={e=>setDate(e.target.value)} />
      </div>
      <div className="col-6 col-md-4">
        <label className="form-label">คะแนนดิบ/รหัสผล</label>
        <input className="form-control" value={raw} onChange={e=>setRaw(e.target.value)} placeholder="เช่น 78/100" />
      </div>
      <div className="col-12">
        <button className="btn btn-primary" onClick={onSave}>บันทึกผลภาษา</button>
      </div>

      <div className="col-12">
        <div className="alert alert-info mt-3">
          <strong>ผลล่าสุด:</strong> {latest ? `${latest.level} (${latest.taken_at || "ไม่ระบุวันที่"})` : "ยังไม่มี"}
        </div>
      </div>
    </div>
  );
}
