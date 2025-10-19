import React, { useMemo, useState } from "react";
import { peer, getCompetencyProfile } from "../../services/competencyApi";

/* ตัวเลือกคะแนน (สเกล 1–5 ฝั่ง UI) */
const SCORE_OPTIONS = [1, 2, 3, 4, 5];

/* หัวข้อการประเมิน (5 มิติ) */
const TOPICS = [
  { key: "communication", label: "สื่อสารอย่างมีประสิทธิภาพกับผู้อื่น" },
  { key: "teamwork", label: "ทำงานร่วมกับทีมและรับฟังความคิดเห็นของผู้อื่น" },
  { key: "responsibility", label: "มีความรับผิดชอบต่อหน้าที่และส่วนรวม" },
  { key: "cooperation", label: "ให้ความร่วมมือและช่วยเหลือสมาชิกในทีม" },
  { key: "adaptability", label: "ปรับตัวเข้ากับผู้อื่นและสถานการณ์ได้ดี" },
];

/** แปลงคะแนน 1–5 → 0–100 (1=20, 5=100) */
const toPct = (v) => (v == null ? 0 : Math.round((Number(v) / 5) * 100));

/** หา periodKey ปัจจุบัน เช่น 2025-1 (มค–พค = เทอม 1, มิย–ธค = เทอม 2) */
const usePeriodKey = () => {
  return useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const sem = m <= 5 ? 1 : 2;
    return `${y}-${sem}`;
  }, []);
};

export default function WorkCollaborationForm({ user }) {
  const periodKey = usePeriodKey();

  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (key, val) => {
    setScores((prev) => ({ ...prev, [key]: val }));
  };

  const handleNote = (key, val) => {
    setNotes((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async () => {
    setError("");
    if (Object.keys(scores).length < TOPICS.length) {
      alert("กรุณาให้คะแนนครบทุกข้อก่อนส่งแบบประเมิน");
      return;
    }
    setSaving(true);
    try {
      // ดึงข้อมูลโปรไฟล์เพื่อเติม major_id / year_level (ถ้ามี)
      let major_id = null;
      let year_level = null;
      try {
        const prof = await getCompetencyProfile(user.id);
        major_id = prof?.account?.major_id ?? null;
        year_level = prof?.account?.year_level ?? null;
      } catch {
        // เงียบไว้ ใช้ null ได้
      }

      // แปลงสเกล 1–5 → 0–100 ตาม backend/สูตรรวม
      const payload = {
        period_key: periodKey,
        rater_id: user.id,
        ratee_id: user.id, // self
        major_id,
        year_level,
        communication: toPct(scores.communication),
        teamwork: toPct(scores.teamwork),
        responsibility: toPct(scores.responsibility),
        cooperation: toPct(scores.cooperation),
        adaptability: toPct(scores.adaptability),
        comment: JSON.stringify({ notes }), // เก็บหมายเหตุทุกแกนไว้ใน comment
      };

      // ส่งเข้าระบบ peer (backend จะ upsert และตั้ง is_self=1)
      const okAvail = await peer.isAvailable();
      if (!okAvail) {
        throw new Error("ระบบประเมินเพื่อนไม่ได้เปิดใช้งาน (peer api ไม่พร้อม)");
      }
      const res = await peer.submit(payload);
      if (!res || res.ok !== true) {
        throw new Error("บันทึกประเมินตนเองไม่สำเร็จ");
      }
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError(err?.message || "เกิดข้อผิดพลาดในการบันทึก");
      alert(err?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <div className="alert alert-success rounded-4">
        ✅ บันทึกแบบประเมินตนเองเรียบร้อยแล้ว
        <div className="small text-muted mt-1">
          คะแนนนี้จะถูกนำไปคิด “ทำงานร่วมกับผู้อื่น” (Self 40% + Peer 60%)
        </div>
      </div>
    );
  }

  return (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-body">
        <h5 className="fw-semibold mb-1 text-primary">
          แบบประเมินตนเองด้านการทำงานร่วมกับผู้อื่น
        </h5>
        <div className="text-muted small mb-3">
          รอบประเมิน: <b>{periodKey}</b>
        </div>

        {error && (
          <div className="alert alert-danger rounded-4 py-2">{error}</div>
        )}

        <table className="table align-middle">
          <thead>
            <tr className="table-light">
              <th style={{ width: "45%" }}>หัวข้อประเมิน</th>
              <th className="text-center" style={{ width: "25%" }}>
                คะแนน (1–5)
              </th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {TOPICS.map((t) => (
              <tr key={t.key}>
                <td>{t.label}</td>
                <td className="text-center">
                  <select
                    className="form-select w-auto mx-auto"
                    value={scores[t.key] ?? ""}
                    onChange={(e) => handleChange(t.key, Number(e.target.value))}
                  >
                    <option value="">เลือก</option>
                    {SCORE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {scores[t.key] != null && (
                    <div className="small text-muted mt-1">
                      = {toPct(scores[t.key])} / 100
                    </div>
                  )}
                </td>
                <td>
                  <input
                    className="form-control"
                    placeholder="หมายเหตุ (ถ้ามี)"
                    value={notes[t.key] ?? ""}
                    onChange={(e) => handleNote(t.key, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="text-end">
          <button
            className="btn btn-primary rounded-pill"
            disabled={saving}
            onClick={handleSubmit}
          >
            {saving ? "กำลังบันทึก..." : "ส่งแบบประเมิน"}
          </button>
        </div>
      </div>
    </div>
  );
}
