// src/components/competency/PeerEvaluationForm.jsx
import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { peer as peerApi } from "../../services/competencyApi";
import { getUsers } from "../../services/api"; // fallback กรณีไม่มี endpoint

const TOPICS = [
  { key: "communication", label: "สื่อสารกับทีม" },
  { key: "teamwork", label: "ทำงานเป็นทีม" },
  { key: "responsibility", label: "รับผิดชอบหน้าที่" },
  { key: "cooperation", label: "ให้ความร่วมมือ" },
  { key: "adaptability", label: "ปรับตัวในทีม" },
];

const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 1800,
  timerProgressBar: true,
});

export default function PeerEvaluationForm({ user, profile, periodKey }) {
  const [classmates, setClassmates] = useState([]);
  const [ratedIds, setRatedIds] = useState([]); // คนที่เราเคยประเมินในรอบนี้
  const [target, setTarget] = useState("");
  const [scores, setScores] = useState({});
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const account = profile?.account || {};
  const major_id = account.major_id ?? null;
  const year_level = account.year_level ?? null;
  const selfId = user?.id ?? account?.id ?? null;

  // โหลดคนที่เราเคยประเมินแล้วในรอบนี้
  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!selfId || !periodKey) return;
      try {
        const data = await peerApi.mySubmissions(selfId, periodKey);
        const ids = Array.isArray(data?.ratee_ids) ? data.ratee_ids.map(Number) : [];
        if (!ignore) setRatedIds(ids);
      } catch (e) {
        console.warn("load my-submissions error", e);
        if (!ignore) setRatedIds([]);
      }
    }
    run();
    return () => { ignore = true; };
  }, [selfId, periodKey]);

  // ดึงเพื่อนสาขา/ชั้นปีเดียวกัน
  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!major_id || !year_level) return;
      setLoading(true);
      try {
        let list = [];
        try {
          const got = await peerApi.classmates(major_id, year_level, selfId);
          list = Array.isArray(got) ? got : [];
        } catch {
          // fallback: ดึงทั้งหมดแล้ว filter หน้า FE
          const res = await getUsers();
          list = (res?.users || []).filter(
            (u) =>
              Number(u?.major_id) === Number(major_id) &&
              String(u?.year_level || "") === String(year_level) &&
              Number(u?.id) !== Number(selfId)
          );
        }
        // ตัดออกคนที่ประเมินไปแล้ว (ให้ "ซ่อน" ไปเลย)
        if (ratedIds.length) {
          const ratedSet = new Set(ratedIds.map(Number));
          list = list.filter((u) => !ratedSet.has(Number(u.id)));
        }
        if (!ignore) setClassmates(list);
      } catch (e) {
        console.error("load classmates error", e);
        if (!ignore) setClassmates([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    run();
    return () => { ignore = true; };
  }, [major_id, year_level, selfId, ratedIds]);

  const ready = useMemo(() => {
    return Boolean(periodKey && selfId && major_id && year_level && classmates.length > 0);
  }, [periodKey, selfId, major_id, year_level, classmates.length]);

  const canSubmit = useMemo(() => {
    if (!ready || !target) return false;
    return TOPICS.every((t) => {
      const v = Number(scores[t.key]);
      return Number.isFinite(v) && v >= 1 && v <= 5;
    });
  }, [ready, target, scores]);

  const handleScore = (k, v) => {
    const n = Number(v);
    setScores((prev) => ({ ...prev, [k]: n }));
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;

    setSaving(true);
    try {
      const payload = {
        period_key: periodKey,
        evaluator_id: selfId,
        target_id: Number(target),
        major_id: Number(major_id),
        year_level: String(year_level),
        scores: { ...scores },
        comment: (comment || "").trim(),
      };
      await peerApi.submit(payload);

      Toast.fire({ icon: "success", title: "บันทึกการประเมินแล้ว" });
      // กันซ้ำรอบต่อไปใน UI
      setRatedIds((prev) => [...new Set([...prev, Number(target)])]);
      // reset บางส่วน
      setScores({});
      setComment("");
      setTarget("");
    } catch (err) {
      console.error(err);
      if (err?.status === 409) {
        Swal.fire("ประเมินแล้ว", "คุณประเมินคนนี้ในรอบนี้ไปแล้ว", "info");
      } else {
        Swal.fire("บันทึกไม่สำเร็จ", (err?.message || "กรุณาลองใหม่อีกครั้ง"), "error");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!periodKey) {
    return <div className="alert alert-warning">ยังไม่ได้กำหนดรอบประเมิน (periodKey)</div>;
  }
  if (!major_id || !year_level) {
    return <div className="alert alert-warning">ข้อมูลสาขาหรือชั้นปีของผู้ใช้ไม่ครบ</div>;
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <h5 className="mb-3">แบบประเมินเพื่อน (รอบ {periodKey})</h5>

        {loading ? (
          <div className="text-muted">
            <span className="spinner-border spinner-border-sm me-2" />
            กำลังโหลดรายชื่อเพื่อน...
          </div>
        ) : classmates.length === 0 ? (
          <div className="alert alert-info mb-0">
            ไม่มีรายชื่อให้ประเมิน (อาจประเมินครบแล้ว หรือยังไม่มีเพื่อนในสาขา/ชั้นปีเดียวกัน)
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="mb-3">
              <label className="form-label">เลือกเพื่อนที่ต้องการประเมิน</label>
              <select
                className="form-select"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">— เลือก —</option>
                {classmates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullname || `${u.firstname || ""} ${u.lastname || ""}`.trim()} ({u.username || u.email})
                  </option>
                ))}
              </select>
              {!!ratedIds.length && (
                <div className="form-text">
                  *ชื่อที่ถูกประเมินแล้วในรอบนี้ถูกซ่อนออกจากรายการ
                </div>
              )}
            </div>

            <div className="row g-3">
              {TOPICS.map((t) => (
                <div className="col-md-6" key={t.key}>
                  <label className="form-label d-flex justify-content-between">
                    <span>{t.label}</span>
                    <b>{scores[t.key] || "-"}/5</b>
                  </label>
                  <input
                    type="range"
                    className="form-range"
                    min="1"
                    max="5"
                    step="1"
                    value={scores[t.key] || 0}
                    onChange={(e) => handleScore(t.key, e.target.value)}
                  />
                  <div className="d-flex justify-content-between small text-muted">
                    <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <label className="form-label">ข้อคิดเห็นเพิ่มเติม (ถ้ามี)</label>
              <textarea
                className="form-control"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="พิมพ์ข้อคิดเห็น..."
              />
            </div>

            <div className="mt-4 d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={!canSubmit || saving}>
                {saving ? "กำลังบันทึก..." : "บันทึกการประเมิน"}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => { setScores({}); setComment(""); }}
                disabled={saving}
              >
                ล้างฟอร์ม
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
