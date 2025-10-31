import React, { useEffect, useState, useMemo } from "react";
import { getLatestLanguage, saveLanguage } from "../../services/competencyApi";
import Swal from "sweetalert2"; // ✅ เพิ่ม SweetAlert2

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

/* แปลงวันที่ให้เป็น yyyy-mm-dd (รองรับทั้ง Date และสตริง) */
const toISODate = (v) => {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

export default function LanguageSection({ user }) {
  const [latest, setLatest] = useState(null);
  const [level, setLevel] = useState("");
  const [date, setDate] = useState("");
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false); // ✅ โหมดแก้ไข

  const accountId = user?.id;

  // โหลดผลล่าสุด
  useEffect(() => {
    if (!accountId) return;
    (async () => {
      try {
        const r = await getLatestLanguage(accountId);
        const rec = r?.latest || null;
        setLatest(rec);
      } catch (e) {
        setLatest(null);
      }
    })();
  }, [accountId]);

  // กด "แก้ไขผลล่าสุด"
  const startEdit = () => {
    if (!latest) return;
    setLevel(latest.level || "");
    setDate(toISODate(latest.taken_at || latest.takenAt || latest.date || ""));
    setRaw(latest.score_raw ?? latest.scoreRaw ?? latest.result ?? "");
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setLevel("");
    setDate("");
    setRaw("");
  };

  const onSave = async () => {
    if (!accountId)
      return Swal.fire("ไม่พบข้อมูลผู้ใช้", "กรุณาเข้าสู่ระบบอีกครั้ง", "error");
    if (!level)
      return Swal.fire("ยังไม่ได้เลือกระดับ CEPT", "กรุณาเลือกระดับก่อนบันทึก", "warning");

    const payload = {
      account_id: accountId,
      framework: "CEPT",
      level,
      taken_at: date || null,
      score_raw: raw || null,
      ...(editMode && latest?.id ? { id: latest.id } : {}),
    };

    try {
      setLoading(true);
      await saveLanguage(payload);
      const r = await getLatestLanguage(accountId);
      setLatest(r?.latest || null);

      // ล้างฟอร์ม + ออกจากโหมดแก้ไข
      setLevel("");
      setDate("");
      setRaw("");
      setEditMode(false);

      await Swal.fire({
        icon: "success",
        title: editMode ? "อัปเดตผลภาษาเรียบร้อย!" : "บันทึกผลภาษาเรียบร้อย!",
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (e) {
      Swal.fire("เกิดข้อผิดพลาด", e?.message || "บันทึกไม่สำเร็จ", "error");
    } finally {
      setLoading(false);
    }
  };

  const mainBtnLabel = useMemo(
    () => (editMode ? "อัปเดตผลภาษา" : "บันทึกผลภาษา"),
    [editMode]
  );

  return (
    <div className="row g-3">
      {/* ฟอร์มกรอก/แก้ไข */}
      <div className="col-12 col-md-4">
        <label className="form-label">ระดับ CEPT</label>
        <select
          className="form-select"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          disabled={loading}
        >
          <option value="">เลือก</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="col-6 col-md-4">
        <label className="form-label">วันที่สอบ</label>
        <input
          className="form-control"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="col-6 col-md-4">
        <label className="form-label">คะแนนดิบ/รหัสผล</label>
        <input
          className="form-control"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="เช่น 78/100 หรือ CEPT-YYYY-####"
          disabled={loading}
        />
      </div>

      <div className="col-12 d-flex gap-2">
        <button className="btn btn-primary" onClick={onSave} disabled={loading}>
          {loading ? "กำลังบันทึก..." : mainBtnLabel}
        </button>

        {latest && !editMode && (
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={startEdit}
            disabled={loading}
          >
            แก้ไขผลล่าสุด
          </button>
        )}

        {editMode && (
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={cancelEdit}
            disabled={loading}
          >
            ยกเลิก
          </button>
        )}
      </div>

      {/* แสดงผลล่าสุด */}
      <div className="col-12">
        <div className="alert alert-info mt-3 mb-0">
          <strong>ผลล่าสุด: </strong>
          {latest
            ? `${latest.level || "-"} (${toISODate(
                latest.taken_at || latest.takenAt
              ) || "ไม่ระบุวันที่"})`
            : "ยังไม่มี"}
        </div>
      </div>
    </div>
  );
}
