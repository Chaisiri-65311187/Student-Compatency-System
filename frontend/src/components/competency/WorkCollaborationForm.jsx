import React, { useEffect, useMemo, useState } from "react";
import { peer, getCompetencyProfile } from "../../services/competencyApi";
import Swal from "sweetalert2";

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

/** Toast สั้น ๆ มุมขวาบน */
const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 1800,
  timerProgressBar: true,
});

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

/** เดาว่ามี submission แล้วหรือยัง จากผลที่แบ็กเอนด์ส่งมา (รองรับหลายรูปแบบ) */
function hasSelfSubmission(res) {
  if (!res) return false;
  if (Array.isArray(res.items) && res.items.length > 0) return true;
  if (res.id) return true;
  const any = Number(res.avg ?? res.summary?.self_avg ?? 0);
  if (Number.isFinite(any) && any > 0) return true;
  return false;
}

export default function WorkCollaborationForm({ user }) {
  const periodKey = usePeriodKey();

  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState({});
  const [saving, setSaving] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [checking, setChecking] = useState(true);   // กำลังเช็คว่าเคยส่งหรือยัง
  const [error, setError] = useState("");

  // เช็คครั้งเดียวตอนเปิดหน้า: เคยส่ง self ประเมินรอบนี้หรือยัง
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setChecking(true);
        const okAvail = await peer.isAvailable();
        if (!okAvail) throw new Error("ระบบประเมินเพื่อนไม่ได้เปิดใช้งาน (peer api ไม่พร้อม)");

        let res;
        if (typeof peer.self === "function") {
          res = await peer.self(user.id, periodKey);
        } else {
          res = await peer.given(user.id, periodKey);
        }
        if (!alive) return;

        if (hasSelfSubmission(res)) setSubmitted(true);
      } catch (e) {
        console.warn(e);
        Toast.fire({ icon: "warning", title: "เชื่อมต่อระบบประเมินไม่ได้ — ยังส่งได้" });
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, [user.id, periodKey]);

  const handleChange = (key, val) => {
    setScores((prev) => ({ ...prev, [key]: val }));
  };
  const handleNote = (key, val) => {
    setNotes((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async () => {
    setError("");

    if (submitted) {
      Swal.fire({
        icon: "info",
        title: "คุณได้ส่งแบบประเมินรอบนี้แล้ว",
        text: "ไม่สามารถส่งซ้ำได้",
        confirmButtonText: "ตกลง",
      });
      return;
    }
    if (Object.keys(scores).length < TOPICS.length) {
      Swal.fire({
        icon: "warning",
        title: "ให้คะแนนไม่ครบ",
        text: "กรุณาให้คะแนนครบทุกข้อก่อนส่งแบบประเมิน",
        confirmButtonText: "ตกลง",
      });
      return;
    }

    // ยืนยันก่อนส่ง (ส่งได้ครั้งเดียว)
    const confirm = await Swal.fire({
      icon: "question",
      title: "ยืนยันการส่งแบบประเมิน?",
      text: "ส่งแล้วแก้ไขไม่ได้ และส่งได้เพียงครั้งเดียวในรอบนี้",
      showCancelButton: true,
      confirmButtonText: "ส่งเลย",
      cancelButtonText: "ยกเลิก",
    });
    if (!confirm.isConfirmed) return;

    setSaving(true);
    try {
      // ป้องกันแข่งเงื่อนไข: เช็คซ้ำอีกครั้งก่อนบันทึก
      try {
        const resCheck = typeof peer.self === "function"
          ? await peer.self(user.id, periodKey)
          : await peer.given(user.id, periodKey);
        if (hasSelfSubmission(resCheck)) {
          setSubmitted(true);
          Swal.fire({
            icon: "info",
            title: "คุณได้ส่งแบบประเมินรอบนี้แล้ว",
            confirmButtonText: "ตกลง",
          });
          return;
        }
      } catch { /* ignore */ }

      // ดึงข้อมูลโปรไฟล์เพื่อเติม major_id / year_level (ถ้ามี)
      let major_id = null;
      let year_level = null;
      try {
        const prof = await getCompetencyProfile(user.id);
        major_id = prof?.account?.major_id ?? null;
        year_level = prof?.account?.year_level ?? null;
      } catch { /* ใช้ค่า null ได้ */ }

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
        comment: JSON.stringify({ notes }),
      };

      const okAvail = await peer.isAvailable();
      if (!okAvail) throw new Error("ระบบประเมินเพื่อนไม่ได้เปิดใช้งาน (peer api ไม่พร้อม)");

      const res = await peer.submit(payload);
      if (!res || res.ok !== true) throw new Error("บันทึกประเมินตนเองไม่สำเร็จ");

      setSubmitted(true);
      await Swal.fire({
        icon: "success",
        title: "บันทึกแบบประเมินเรียบร้อย!",
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (err) {
      console.error(err);
      setError(err?.message || "เกิดข้อผิดพลาดในการบันทึก");
      Swal.fire({
        icon: "error",
        title: "บันทึกไม่สำเร็จ",
        text: err?.message || "กรุณาลองใหม่อีกครั้ง",
        confirmButtonText: "ตกลง",
      });
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <div className="alert alert-secondary rounded-4">
        กำลังตรวจสอบสถานะการส่งแบบประเมินของคุณ…
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="alert alert-success rounded-4">
        ✅ บันทึกแบบประเมินตนเองเรียบร้อยแล้ว
        <div className="small text-muted mt-1">
          คะแนนนี้จะถูกนำไปคิด “ทำงานร่วมกับผู้อื่น”
          <br />สัดส่วนปัจจุบัน: Self 40% + Peer 60% (หรือขึ้นกับการตั้งค่าของระบบ)
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
                    disabled={saving}
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
                    disabled={saving}
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
