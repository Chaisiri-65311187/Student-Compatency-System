// src/components/competency/AcademicSection.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  getCompetencyProfile, updateCompetencyProfile,
  getRequiredCourses, saveCourseGrades, recalcAcademic,
  getSavedGrades
} from "../../services/competencyApi";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

const GRADE_OPTIONS = ["","A","B+","B","C+","C","D+","D","F"];

// ✅ helper กันค้าง: ใส่ timeout ให้ทุกคำสั่ง async
function withTimeout(promise, ms = 15000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`การดำเนินการนานเกินไป (${ms/1000}s)`)), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); })
           .catch((e) => { clearTimeout(t); reject(e); });
  });
}

export default function AcademicSection({ user }){
  const [majorId, setMajorId] = useState(null);
  const [yearLevel, setYearLevel] = useState(4);
  const [gpa, setGpa] = useState("");

  const [reqMap, setReqMap] = useState({});
  const [grades, setGrades] = useState({});

  const [calc1, setCalc1] = useState(null);
  const [calc2, setCalc2] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  /* 1) โหลดโปรไฟล์ */
  useEffect(()=>{
    if (!user?.id) return;
    (async ()=>{
      setLoading(true);
      try {
        const res = await withTimeout(getCompetencyProfile(user.id), 15000);
        const acct = res?.account || {};
        const y = acct.year_level ?? 4;
        setMajorId(acct.major_id ?? null);
        setYearLevel(y);
        if (acct.manual_gpa != null) setGpa(String(acct.manual_gpa));
      } finally {
        setLoading(false);
      }
    })();
  },[user?.id]);

  /* 2) โหลดวิชาบังคับ + เกรดที่เคยบันทึก */
  useEffect(()=>{
    if (!user?.id || !majorId || !yearLevel) return;

    (async ()=>{
      setLoading(true);
      try {
        const tasks = [];
        for (let y = 1; y <= yearLevel; y++){
          for (let s = 1; s <= 2; s++){
            tasks.push(
              withTimeout(getRequiredCourses({ major: majorId, year: y, sem: s }), 15000)
                .then(r => ({ type: "req", y, s, list: r.required || [] }))
            );
          }
        }
        tasks.push(
          withTimeout(getSavedGrades(user.id), 15000).then(r => ({ type: "grades", map: r.map || {} }))
        );

        const results = await Promise.all(tasks);

        const nextReqMap = {};
        const initialFormGrades = {};
        let saved = {};

        results.forEach(it=>{
          if (it.type === "req"){
            const key = `${it.y}-${it.s}`;
            nextReqMap[key] = it.list;
            it.list.forEach(c => {
              if (initialFormGrades[c.code] === undefined) initialFormGrades[c.code] = "";
            });
          } else if (it.type === "grades"){
            saved = it.map;
          }
        });

        Object.keys(initialFormGrades).forEach(code=>{
          if (saved[code]) initialFormGrades[code] = saved[code];
        });

        setReqMap(nextReqMap);
        setGrades(initialFormGrades);
      } finally {
        setLoading(false);
      }
    })();
  },[user?.id, majorId, yearLevel]);

  /* 3) รวมรายการบันทึก */
  const itemsForSave = useMemo(()=>{
    const items = [];
    for (let y = 1; y <= yearLevel; y++){
      for (let s = 1; s <= 2; s++){
        const list = reqMap[`${y}-${s}`] || [];
        list.forEach(c => {
          const letter = grades[c.code];
          if (letter) {
            items.push({
              course_code: c.code,
              letter,
              year: 2568, // TODO
              semester: s,
            });
          }
        });
      }
    }
    return items;
  },[reqMap, grades, yearLevel]);

  /* 4) เปลี่ยนเกรด */
  const onChangeGrade = (code, val) =>
    setGrades(prev => ({ ...prev, [code]: val }));

  /* 5) บันทึกทั้งหมด (กันค้างด้วย timeout + ปิดกล่องแน่นอน) */
  const onSaveAll = async () => {
    if (saving) return; // กันดับเบิลคลิก
    const gradeCount = itemsForSave.length;

    const confirm = await Swal.fire({
      title: "ยืนยันบันทึกข้อมูล",
      html: `
        <div class="text-start">
          <div>• อัปเดต <b>GPA</b> เป็น: <b>${gpa === "" ? "ไม่ระบุ" : gpa}</b></div>
          <div>• บันทึกเกรดรายวิชา: <b>${gradeCount}</b> รายการ</div>
          <div class="mt-2 small text-muted">ชั้นปีปัจจุบัน: ปี ${yearLevel}</div>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "บันทึก",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#0d6efd"
    });
    if (!confirm.isConfirmed) return;

    setSaving(true);
    try {
      await Swal.fire({
        title: "กำลังบันทึก...",
        html: "โปรดรอสักครู่ ระบบกำลังอัปเดตข้อมูล",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      // (ก) อัปเดตโปรไฟล์
      await withTimeout(updateCompetencyProfile(user.id, {
        manual_gpa: gpa === "" ? null : Number(gpa),
        year_level: Number(yearLevel),
      }), 15000);

      // (ข) เกรดรายวิชา (ถ้ามี)
      if (itemsForSave.length) {
        await withTimeout(saveCourseGrades({ account_id: user.id, items: itemsForSave }), 20000);
      }

      // (ค) sync เกรดล่าสุดเข้าฟอร์ม
      const saved = await withTimeout(getSavedGrades(user.id), 15000);
      setGrades(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(code => {
          if (saved.map?.[code]) next[code] = saved.map[code];
        });
        return next;
      });

      // (ง) คำนวณคะแนนปีปัจจุบัน (ทั้ง 2 เทอม) — ถ้าตัวใด error จะไม่ค้าง
      const [r1, r2] = await Promise.all([
        withTimeout(recalcAcademic(user.id, { year: Number(yearLevel), sem: 1 }), 15000).catch(() => null),
        withTimeout(recalcAcademic(user.id, { year: Number(yearLevel), sem: 2 }), 15000).catch(() => null),
      ]);
      setCalc1(r1);
      setCalc2(r2);

      // ปิด loading (ถ้ายังเปิด) แล้ว Toast สำเร็จ
      if (Swal.isVisible()) await Swal.close();
      await Swal.mixin({ toast: true, position: "top-end", showConfirmButton: false, timer: 2500, timerProgressBar: true })
        .fire({ icon: "success", title: "บันทึกด้านวิชาการสำเร็จ" });

    } catch (e) {
      console.error(e);
      // ปิด loading ให้ชัวร์ก่อนแสดง error
      if (Swal.isVisible()) {
        try { await Swal.close(); } catch {}
      }
      await Swal.fire({
        icon: "error",
        title: "บันทึกไม่สำเร็จ",
        text: e?.message || "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์",
        confirmButtonColor: "#0d6efd",
      });
    } finally {
      setSaving(false);
      // กันหลงเหลือ modal
      if (Swal.isVisible()) {
        try { await Swal.close(); } catch {}
      }
    }
  };

  const renderTable = (list, y, s) => (
    <table className="table align-middle">
      <thead>
        <tr>
          <th style={{width:120}}>รหัส</th>
          <th>ชื่อวิชา</th>
          <th style={{width:90}}>หน่วยกิต</th>
          <th style={{width:160}}>เกรด</th>
        </tr>
      </thead>
      <tbody>
        {(list||[]).map(c=>(
          <tr key={`${y}-${s}-${c.code}`}>
            <td>{c.code}</td>
            <td>{c.name_th}</td>
            <td>{c.credit ?? "-"}</td>
            <td>
              <select
                className="form-select"
                value={grades[c.code] || ""}
                onChange={e=>onChangeGrade(c.code, e.target.value)}
              >
                {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g || "เลือก"}</option>)}
              </select>
            </td>
          </tr>
        ))}
        {!list?.length && (
          <tr><td colSpan={4} className="text-muted">ไม่มีวิชาบังคับ ปี {y} เทอม {s}</td></tr>
        )}
      </tbody>
    </table>
  );

  if (loading) {
    return (
      <div className="text-muted">
        <span className="spinner-border spinner-border-sm me-2" />กำลังโหลดข้อมูลวิชาบังคับ/เกรด…
      </div>
    );
  }

  return (
    <div>
      <div className="row g-3 mb-3">
        <div className="col-12 col-md-2">
          <label className="form-label">ชั้นปี</label>
          <select className="form-select" value={yearLevel} disabled onChange={e=>setYearLevel(+e.target.value)}>
            {[1,2,3,4].map(v=> <option key={v} value={v}>{v}</option>)}
          </select>
          <div className="form-text">ดึงจากโปรไฟล์นิสิต</div>
        </div>
        <div className="col-12 col-md-3">
          <label className="form-label">GPAX</label>
          <input
            className="form-control"
            type="number" step="0.01" min="0" max="4"
            value={gpa} onChange={e=>setGpa(e.target.value)}
          />
        </div>
      </div>

      {Array.from({ length: yearLevel }, (_, i) => i + 1).map(y => (
        <div key={y} className="mb-4">
          <h6 className="mb-2">ปี {y} – เทอม 1</h6>
          {renderTable(reqMap[`${y}-1`] || [], y, 1)}
          <h6 className="mb-2 mt-3">ปี {y} – เทอม 2</h6>
          {renderTable(reqMap[`${y}-2`] || [], y, 2)}
        </div>
      ))}

      <div className="d-flex gap-2 mt-3">
        <button className="btn btn-primary" onClick={onSaveAll} disabled={saving}>
          {saving && <span className="spinner-border spinner-border-sm me-2" />}
          บันทึกทั้งหมด
        </button>
        <span className="text-muted small align-self-center">
          ระบบจะบันทึก GPA + เกรดทุกวิชาที่แสดง และดึงค่าจากฐานข้อมูลมาแสดงทันที
        </span>
      </div>

      {(calc1 || calc2) && (
        <div className="alert alert-success mt-3">
          <div><strong>ผลคำนวณด้านวิชาการ (ชั้นปี {yearLevel})</strong></div>
          {calc1 && (
            <div className="mt-2">
              <u>เทอม 1</u> – GPA ใช้คำนวณ: <b>{calc1?.gpa_used ?? "-"}</b>,
              % ผ่านวิชาบังคับ: <b>{calc1?.core_completion_pct}%</b>,
              คะแนน GPA: <b>{calc1?.score_gpa}/25</b>,
              คะแนนวิชาบังคับ: <b>{calc1?.score_core}/15</b>,
              รวม: <b>{calc1?.score_academic}/40</b>
            </div>
          )}
          {calc2 && (
            <div className="mt-2">
              <u>เทอม 2</u> – GPA ใช้คำนวณ: <b>{calc2?.gpa_used ?? "-"}</b>,
              % ผ่านวิชาบังคับ: <b>{calc2?.core_completion_pct}%</b>,
              คะแนน GPA: <b>{calc2?.score_gpa}/25</b>,
              คะแนนวิชาบังคับ: <b>{calc2?.score_core}/15</b>,
              รวม: <b>{calc2?.score_academic}/40</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
