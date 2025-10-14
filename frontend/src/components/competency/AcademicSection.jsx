// src/components/competency/AcademicSection.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  getCompetencyProfile, updateCompetencyProfile,
  getRequiredCourses, saveCourseGrades, recalcAcademic,
  getSavedGrades
} from "../../services/competencyApi";

const GRADE_OPTIONS = ["","A","B+","B","C+","C","D+","D","F"];

export default function AcademicSection({ user }){
  // ใช้ค่าจากโปรไฟล์ในฐานข้อมูล (ไม่พึ่ง user.major_id จาก Auth)
  const [majorId, setMajorId] = useState(null);
  const [yearLevel, setYearLevel] = useState(4);
  const [gpa, setGpa] = useState("");

  // รายวิชาบังคับ: { "1-1":[],"1-2":[],"2-1":[],... }
  const [reqMap, setReqMap] = useState({});
  // เกรดที่โชว์ในฟอร์ม: { [course_code]: "A"/"B+"... }
  const [grades, setGrades] = useState({});

  const [calc1, setCalc1] = useState(null);
  const [calc2, setCalc2] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  /* 1) โหลดโปรไฟล์ -> เอา major_id + year_level + GPA จากฐานข้อมูล */
  useEffect(()=>{
    if (!user?.id) return;
    (async ()=>{
      setLoading(true);
      try {
        const res = await getCompetencyProfile(user.id);
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

  /* 2) เมื่อรู้ majorId + yearLevel แล้ว: โหลด “วิชาบังคับสะสม” + “เกรดที่เคยบันทึก” แล้ว merge ใส่ฟอร์ม */
  useEffect(()=>{
    if (!user?.id || !majorId || !yearLevel) return;

    (async ()=>{
      setLoading(true);
      try {
        const tasks = [];

        // รายวิชาบังคับสะสมตั้งแต่ปี 1..ชั้นปี
        for (let y = 1; y <= yearLevel; y++){
          for (let s = 1; s <= 2; s++){
            tasks.push(
              getRequiredCourses({ major: majorId, year: y, sem: s })
                .then(r => ({ type: "req", y, s, list: r.required || [] }))
            );
          }
        }

        // เกรดทั้งหมด (ล่าสุดต่อรายวิชา)
        tasks.push(
          getSavedGrades(user.id).then(r => ({ type: "grades", map: r.map || {} }))
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
            saved = it.map; // { code: "A", ... }
          }
        });

        // merge: ถ้าวิชานี้มีเกรดใน DB แล้ว ให้ขึ้นค่านั้นเลย
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

  /* 3) รวมรายการสำหรับบันทึกครั้งเดียว */
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
              year: 2568,  // TODO: ปรับปีการศึกษาให้ตรงระบบ
              semester: s,
            });
          }
        });
      }
    }
    return items;
  },[reqMap, grades, yearLevel]);

  /* 4) เปลี่ยนเกรดในฟอร์ม */
  const onChangeGrade = (code, val) =>
    setGrades(prev => ({ ...prev, [code]: val }));

  /* 5) บันทึกทั้งหมด & รีเฟรชค่าใหม่จาก DB ให้ฟอร์มขึ้นตามนั้นเลย */
  const onSaveAll = async () => {
    setSaving(true);
    try {
      // (ก) อัปเดต GPA + ชั้นปี
      await updateCompetencyProfile(user.id, {
        manual_gpa: gpa === "" ? null : Number(gpa),
        year_level: Number(yearLevel),
      });

      // (ข) บันทึกเกรดทุกวิชาที่กรอก (bulk)
      if (itemsForSave.length) {
        await saveCourseGrades({ account_id: user.id, items: itemsForSave });
      }

      // (ค) ดึงเกรดล่าสุดกลับมาเติมในฟอร์ม (sync กับฐานข้อมูล)
      const saved = await getSavedGrades(user.id);
      setGrades(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(code => {
          if (saved.map?.[code]) next[code] = saved.map[code];
        });
        return next;
      });

      // (ง) คำนวณคะแนนเฉพาะชั้นปีปัจจุบัน (เทอม 1/2)
      const [r1, r2] = await Promise.all([
        recalcAcademic(user.id, { year: Number(yearLevel), sem: 1 }),
        recalcAcademic(user.id, { year: Number(yearLevel), sem: 2 }),
      ]);
      setCalc1(r1);
      setCalc2(r2);

      alert("บันทึกด้านวิชาการ (ทุกปีที่แสดง) สำเร็จ");
    } catch (e) {
      console.error(e);
      alert(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
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
          <label className="form-label">GPA (กรอกเอง)</label>
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
              <u>เทอม 1</u> – GPA ใช้คำนวณ: <b>{calc1.gpa_used ?? "-"}</b>,
              % ผ่านวิชาบังคับ: <b>{calc1.core_completion_pct}%</b>,
              คะแนน GPA: <b>{calc1.score_gpa}/25</b>,
              คะแนนวิชาบังคับ: <b>{calc1.score_core}/15</b>,
              รวม: <b>{calc1.score_academic}/40</b>
            </div>
          )}
          {calc2 && (
            <div className="mt-2">
              <u>เทอม 2</u> – GPA ใช้คำนวณ: <b>{calc2.gpa_used ?? "-"}</b>,
              % ผ่านวิชาบังคับ: <b>{calc2.core_completion_pct}%</b>,
              คะแนน GPA: <b>{calc2.score_gpa}/25</b>,
              คะแนนวิชาบังคับ: <b>{calc2.score_core}/15</b>,
              รวม: <b>{calc2.score_academic}/40</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
