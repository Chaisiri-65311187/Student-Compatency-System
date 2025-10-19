import React, { useEffect, useState } from "react";
import { peer } from "../../services/competencyApi";

const TOPICS = [
  { key: "communication",  label: "สื่อสารกับทีม" },
  { key: "teamwork",       label: "ทำงานเป็นทีม" },
  { key: "responsibility", label: "รับผิดชอบหน้าที่" },
  { key: "cooperation",    label: "ให้ความร่วมมือ" },
  { key: "adaptability",   label: "ปรับตัวในทีม" },
];

export default function PeerEvaluationForm({ user, periodKey, profile }) {
  const [peerReady, setPeerReady] = useState(true);     // ฟีเจอร์ peer ใช้ได้ไหม
  const [loading, setLoading] = useState(false);
  const [classmates, setClassmates] = useState([]);
  const [target, setTarget] = useState("");
  const [scores, setScores] = useState({});
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const major_id = profile?.account?.major_id;
  const year_level = profile?.account?.year_level;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!major_id || !year_level || !user?.id) return;
     setLoading(true);
      const resp = await peer.classmates(major_id, year_level, user.id).catch(() => null);
      // ถ้าเรียกได้ (แม้จะเป็น [] หรือ {items: []}) = พร้อมใช้งาน
      const mates = Array.isArray(resp?.items) ? resp.items
                  : Array.isArray(resp)        ? resp
                  : null;
      if (!alive) return;
      setPeerReady(mates !== null);
      const list = Array.isArray(mates)
        ? mates
            .filter(m => Number(m?.id) !== Number(user.id))
            .sort((a,b) => String(a.full_name||"").localeCompare(String(b.full_name||""), "th"))
        : [];
      setClassmates(list);
      setLoading(false);
    })();
    return () => { alive = false; };
   }, [major_id, year_level, user?.id]);

  const submit = async () => {
    if (!peerReady) return alert("ระบบประเมินเพื่อนยังไม่พร้อมใช้งาน");
    if (!target) return alert("เลือกเพื่อนที่จะประเมิน");
    const allFilled = TOPICS.every(t => {
      const v = Number(scores[t.key]);
      return Number.isFinite(v) && v >= 1 && v <= 5;
    });
    if (!allFilled) return alert("ให้คะแนนให้ครบทุกข้อ (1–5)");

    setSaving(true);
    try {
      await peer.submit({
        period_key: periodKey,
        rater_id: user.id,
        ratee_id: Number(target),
        major_id,
        year_level,
        ...scores,
        comment: (comment || "").trim(),
      });
      alert("บันทึกสำเร็จ");
      setTarget(""); setScores({}); setComment("");
    } catch (e) {
      alert(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  // ถ้า peer ไม่พร้อม แสดงข้อความและปิดฟอร์ม
  if (!peerReady) {
    return (
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body">
          <h6 className="fw-semibold mb-2">ประเมินเพื่อนในสาขา (รอบ {periodKey})</h6>
          <div className="alert alert-warning mb-0">
            ระบบประเมินเพื่อนยังไม่พร้อมใช้งานในขณะนี้
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-body">
        <h6 className="fw-semibold mb-3">ประเมินเพื่อนในสาขา (รอบ {periodKey})</h6>

        <div className="row g-2 mb-3">
          <div className="col-md-6">
            <label className="form-label">เลือกเพื่อน</label>
            <select
              className="form-select"
              value={target}
              onChange={(e)=>setTarget(e.target.value)}
              disabled={loading || classmates.length === 0}
            >
              <option value="">{loading ? "กำลังโหลด..." : "— เลือก —"}</option>
              {classmates.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.username})
                </option>
              ))}
            </select>
            {(!loading && classmates.length === 0) && (
              <div className="form-text text-muted">ยังไม่พบรายชื่อเพื่อนในสาขา/ชั้นปีเดียวกัน</div>
            )}
          </div>
        </div>

        <table className="table align-middle">
          <thead>
            <tr><th>หัวข้อ</th><th style={{width:140}}>คะแนน (1–5)</th></tr>
          </thead>
          <tbody>
            {TOPICS.map(t=>(
              <tr key={t.key}>
                <td>{t.label}</td>
                <td>
                  <select
                    className="form-select"
                    value={scores[t.key] ?? ""}
                    onChange={(e)=>setScores(s=>({...s, [t.key]: Number(e.target.value)}))}
                    disabled={!target}
                  >
                    <option value="">{target ? "เลือก" : "เลือกเพื่อนก่อน"}</option>
                    {[1,2,3,4,5].map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={2}>
                <label className="form-label">หมายเหตุ/ข้อเสนอแนะ (ถ้ามี)</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={comment}
                  onChange={(e)=>setComment(e.target.value)}
                  disabled={!target}
                />
              </td>
            </tr>
          </tbody>
        </table>

        <div className="text-end">
          <button
            className="btn btn-primary rounded-pill"
            onClick={submit}
            disabled={saving || !target}
          >
            {saving ? "กำลังบันทึก..." : "ส่งประเมิน"}
          </button>
        </div>
      </div>
    </div>
  );
}
