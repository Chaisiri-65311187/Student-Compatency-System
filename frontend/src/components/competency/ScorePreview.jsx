import React, { useEffect, useState } from "react";
import {
  listActivities, listTechCerts, listTrainings,
  getCompetencyProfile, recalcAcademic
} from "../../services/competencyApi";

export default function ScorePreview({ user }){
  const [acad, setAcad] = useState(null);
  const [counts, setCounts] = useState({ social:0, comm:0, cert:0, train:0 });

  const refresh = async ()=>{
    const [soc, com, cert, trn, prof] = await Promise.all([
      listActivities(user.id, "social"),
      listActivities(user.id, "communication"),
      listTechCerts(user.id),
      listTrainings(user.id),
      getCompetencyProfile(user.id),
    ]);
    setCounts({
      social: (soc.items||[]).length,
      comm:   (com.items||[]).length,
      cert:   (cert.items||[]).length,
      train:  (trn.items||[]).length,
    });
    const y = prof.account?.year_level || 1;
    const r = await recalcAcademic(user.id, { year: y, sem: 1 });
    setAcad(r);
  };

  useEffect(()=>{ refresh(); },[]); // eslint-disable-line

  return (
    <div className="card border-0 shadow-sm" style={{minWidth: 320}}>
      <div className="card-body p-3">
        <div className="fw-bold mb-2">พรีวิวคะแนน</div>
        <div className="small text-muted">* ตอนนี้รวม “ด้านวิชาการ” แล้ว ด้านอื่นจะต่อยอดภายหลัง</div>
        <ul className="list-unstyled mt-2 mb-0">
          <li>วิชาการ: <b>{acad ? `${acad.score_academic}/40` : "-"}</b></li>
          <li>ภาษา: <span className="text-muted">ดูที่แท็บภาษา</span></li>
          <li>ทักษะเทคโนโลยี: ใบรับรอง <b>{counts.cert}</b> · อบรม <b>{counts.train}</b></li>
          <li>สังคม: <b>{counts.social}</b> รายการ</li>
          <li>การสื่อสาร: <b>{counts.comm}</b> รายการ</li>
        </ul>
      </div>
    </div>
  );
}
