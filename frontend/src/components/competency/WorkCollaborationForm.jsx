import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { peer as peerApi, getCompetencyProfile } from "../../services/competencyApi";

/* ตัวเลือกคะแนน (สเกล 1–5) */
const SCORE_OPTIONS = [1, 2, 3, 4, 5];

/* หัวข้อการประเมิน (5 มิติ) */
const TOPICS = [
  { key: "communication", label: "สื่อสารอย่างมีประสิทธิภาพกับผู้อื่น" },
  { key: "teamwork", label: "ทำงานร่วมกับทีมและรับฟังความคิดเห็นของผู้อื่น" },
  { key: "responsibility", label: "มีความรับผิดชอบต่อหน้าที่และส่วนรวม" },
  { key: "cooperation", label: "ให้ความร่วมมือและช่วยเหลือสมาชิกในทีม" },
  { key: "adaptability", label: "ปรับตัวเข้ากับผู้อื่นและสถานการณ์ได้ดี" },
];

const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 1800,
  timerProgressBar: true,
});

/** หา periodKey ปัจจุบัน */
const usePeriodKey = () =>
  useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const sem = m <= 5 ? 1 : 2;
    return `${y}-${sem}`;
  }, []);

/** ตรวจว่ามี self submission แล้วหรือยัง */
function hasSelfSubmission(res) {
  return Number(res?.avg ?? 0) > 0;
}

export default function WorkCollaborationForm({ user }) {
  const periodKey = usePeriodKey();
  const userId = user?.id ?? null;

  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  /* ตรวจสอบว่ามีการส่ง self ไปแล้วหรือยัง */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setChecking(true);
        const okAvail = await peerApi.isAvailable();
        if (!okAvail) throw new Error("peer api ไม่พร้อม");

        const res = await peerApi.self(userId, periodKey);
        if (!alive) return;

        if (hasSelfSubmission(res)) {
          setSubmitted(true);
        }
      } catch (e) {
        console.warn(e);
        Toast.fire({
          icon: "warning",
          title: "ไม่สามารถตรวจสอบสถานะได้ (ยังส่งได้)",
        });
      } finally {
        if (alive) setChecking(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, periodKey]);

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
      });
      return;
    }

    if (TOPICS.some((t) => !scores[t.key])) {
      Swal.fire({
        icon: "warning",
        title: "ให้คะแนนไม่ครบ",
        text: "กรุณาให้คะแนนครบทุกข้อ",
      });
      return;
    }

    const confirm = await Swal.fire({
      icon: "question",
      title: "ยืนยันการส่งแบบประเมิน?",
      text: "ส่งแล้วไม่สามารถแก้ไขได้",
      showCancelButton: true,
      confirmButtonText: "ส่งเลย",
      cancelButtonText: "ยกเลิก",
    });
    if (!confirm.isConfirmed) return;

    setSaving(true);
    try {
      // ดึง profile เพื่อเติม major/year
      let major_id = null;
      let year_level = null;
      try {
        const prof = await getCompetencyProfile(userId);
        major_id = prof?.account?.major_id ?? null;
        year_level = prof?.account?.year_level ?? null;
      } catch { }

      const payload = {
        period_key: periodKey,
        evaluator_id: userId,
        target_id: userId, // ✅ self evaluation
        major_id,
        year_level,
        scores: { ...scores },
        comment: JSON.stringify(notes),
      };

      const okAvail = await peerApi.isAvailable();
      if (!okAvail) throw new Error("ระบบประเมินไม่พร้อม");

      await peerApi.submit(payload);

      setSubmitted(true);
      await Swal.fire({
        icon: "success",
        title: "บันทึกแบบประเมินเรียบร้อย",
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (err) {
      console.error(err);
      setError(err?.message || "เกิดข้อผิดพลาด");
      Swal.fire({
        icon: "error",
        title: "บันทึกไม่สำเร็จ",
        text: err?.message || "กรุณาลองใหม่",
      });
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <div className="alert alert-secondary rounded-4">
        กำลังตรวจสอบสถานะการส่งแบบประเมิน…
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="alert alert-success rounded-4">
        ✅ คุณได้ส่งแบบประเมินตนเองเรียบร้อยแล้ว
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
              <th style={{ width: "45%", borderTop: "none" }}>หัวข้อประเมิน</th>
              <th className="text-center" style={{ width: "25%", borderTop: "none" }}>
                คะแนน (1–5)
              </th>
              <th style={{ borderTop: "none" }}>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {TOPICS.map((t) => (
              <tr key={t.key}>
                <td>{t.label}</td>
                <td className="text-center">
                  <select
                    className="form-select w-auto mx-auto rounded-3"
                    value={scores[t.key] ?? ""}
                    onChange={(e) =>
                      handleChange(t.key, Number(e.target.value))
                    }
                    disabled={saving}
                  >
                    <option value="">เลือก</option>
                    {SCORE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="form-control rounded-3"
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
            className="btn btn-primary rounded-pill px-4 shadow-sm fw-semibold"
            disabled={saving}
            onClick={handleSubmit}
            style={{ background: "linear-gradient(135deg, #0d6efd, #0a58ca)", border: "none" }}
          >
            {saving ? "กำลังบันทึก..." : "ส่งแบบประเมิน"}
          </button>
        </div>
      </div>
    </div>
  );
}
