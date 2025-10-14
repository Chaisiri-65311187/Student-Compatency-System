// src/components/StudentProfilePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  getCompetencyProfile, recalcAcademic,
  getLatestLanguage, getLatestLanguagesAll,
  listTrainings, listActivities
} from "../services/competencyApi";
import Radar5 from "../components/profile/Radar5";

/* ===== FE scoring (ชั่วคราว) ===== */
const scoreLang = (lvl) => ({ A1:4, A2:8, B1:12, B2:16, C1:18, C2:20 }[lvl] ?? 0);

// ใช้เมื่่อ CEPT ไม่ได้ส่ง score_raw 0..50 แต่ส่ง level แทน
const CEPT_LEVEL_TO_PCT = { A1:30, A2:45, B1:60, B2:75, C1:90, C2:100 };

/**
 * เทคโนโลยี (เต็ม 20) — “ให้น้ำหนักข้อสอบมาก”
 * - ส่วนหลักจาก % ที่ดีที่สุดของ CEPT/ICT/ITPE → 0..19
 * - โบนัสผ่านรวมสูงสุด +1 (ICT ≥50% +0.5; ITPE ≥60% +0.5 หรือ 55–59% +0.25)
 * - อบรม น้ำหนักเบา: +0.1/ครั้ง (สูงสุด +0.5)
 */
const scoreTech = (trainCount, ictPct, itpePct, ceptObj) => {
  let ceptPct = 0;
  if (ceptObj?.score_raw != null) {
    const raw = Math.max(0, Math.min(50, Number(ceptObj.score_raw)));
    ceptPct = (raw / 50) * 100;
  } else if (ceptObj?.level) {
    ceptPct = CEPT_LEVEL_TO_PCT[ceptObj.level] || 0;
  }
  const bestPct = Math.max(
    Number.isFinite(ictPct)  ? Math.max(0, Math.min(100, ictPct))  : 0,
    Number.isFinite(itpePct) ? Math.max(0, Math.min(100, itpePct)) : 0,
    ceptPct
  );
  const examPts = (bestPct / 100) * 19;

  let passBonus = 0;
  if (Number.isFinite(ictPct) && ictPct >= 50) passBonus += 0.5;
  if (Number.isFinite(itpePct)) {
    if (itpePct >= 60) passBonus += 0.5;
    else if (itpePct >= 55) passBonus += 0.25;
  }
  if (passBonus > 1) passBonus = 1;

  const trainingBonus = Math.min(0.5, (Number(trainCount) || 0) * 0.1);

  const total = Math.min(20, examPts + passBonus + trainingBonus);
  return Math.round(total * 100) / 100;
};

const scoreFromHours = (h, cap = 10) => {
  const x = Number(h || 0);
  if (!x) return 0;
  return Math.round(Math.min(1, x / 20) * cap * 100) / 100;
};

export default function StudentProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [academic, setAcademic] = useState(null);
  const [langLatest, setLangLatest] = useState(null);
  const [langAll, setLangAll] = useState({ CEPT: null, ICT: null, ITPE: null });
  const [trains, setTrains] = useState([]);
  const [socialActs, setSocialActs] = useState([]);
  const [commActs, setCommActs] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      try {
        const prof = await getCompetencyProfile(user.id);
        setProfile(prof);

        const y = prof?.account?.year_level || 4;
        const [a1, a2] = await Promise.all([
          recalcAcademic(user.id, { year: y, sem: 1 }),
          recalcAcademic(user.id, { year: y, sem: 2 }),
        ]);
        setAcademic((a2 && (a2.score_academic ?? 0) > (a1?.score_academic ?? 0)) ? a2 : a1);

        const [lang, all] = await Promise.all([
          getLatestLanguage(user.id),
          getLatestLanguagesAll(user.id),
        ]);
        setLangLatest(lang?.latest || null);
        setLangAll(all || { CEPT: null, ICT: null, ITPE: null });

        const [t, s, m] = await Promise.all([
          listTrainings(user.id),
          listActivities(user.id, "social"),
          listActivities(user.id, "communication"),
        ]);
        setTrains(t.items || []);
        setSocialActs(s.items || []);
        setCommActs(m.items || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  // ===== ค่าคะแนน "ดิบ" ตามเกณฑ์จริง (ใช้แสดงใน UI) =====
  const raw = useMemo(() => {
    const acad   = academic?.score_academic ?? 0; // /40
    const lang   = scoreLang(langLatest?.level);  // /20
    const ictPct  = Number(langAll?.ICT?.score_raw ?? 0);   // %
    const itpePct = Number(langAll?.ITPE?.score_raw ?? 0);  // %
    const ceptObj = langAll?.CEPT ?? null;                  // raw 0..50 หรือ level
    const tech   = scoreTech(trains.length, ictPct, itpePct, ceptObj); // /20

    const socH = socialActs.reduce((s, a) => s + (Number(a.hours) || 0), 0);
    const comH = commActs.reduce((s, a) => s + (Number(a.hours) || 0), 0);
    const social = socH ? scoreFromHours(socH, 10) : scoreFromHours(socialActs.length, 10); // /10
    const comm   = comH ? scoreFromHours(comH, 10) : scoreFromHours(commActs.length, 10);   // /10

    return { acad, lang, tech, social, comm };
  }, [academic, langLatest, langAll, trains.length, socialActs, commActs]);

  // ===== ค่าที่ส่งเข้าเรดาร์ "ทำ normalization เป็น % ทุกแกน" เพื่อให้สมดุล =====
  const radarDisp = useMemo(() => {
    const asPct = (val, max) => Math.round((Math.max(0, Math.min(val, max)) / max) * 100);
    const valuesPct = [
      asPct(raw.acad,   40), // วิชาการ 0..40 -> %
      asPct(raw.lang,   20), // ภาษา    0..20 -> %
      asPct(raw.tech,   20), // เทคโนฯ  0..20 -> %
      asPct(raw.social, 10), // สังคม    0..10 -> %
      asPct(raw.comm,   10), // สื่อสาร  0..10 -> %
    ];
    return {
      labels: ["วิชาการ", "ภาษา", "เทคโนโลยี", "สังคม", "สื่อสาร"],
      values: valuesPct,           // ทุกแกน 0..100
      max:    [100, 100, 100, 100, 100],
    };
  }, [raw]);

  const acct = profile?.account;

  return (
    <div className="min-vh-100" style={{ background: "linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%)" }}>
      {/* Top Bar — สไตล์เดียวกับหน้า Home */}
      <div
        className="d-flex align-items-center px-3"
        style={{ height: 72, background: "linear-gradient(90deg,#6f42c1,#8e5cff)", boxShadow: "0 4px 14px rgba(111,66,193,.22)" }}
      >
        <img
          src="/src/assets/csit.jpg"
          alt="Logo"
          className="rounded-3 me-3"
          style={{ width: 40, height: 40, objectFit: "cover" }}
        />
        <div className="text-white fw-semibold">CSIT Competency System</div>
        <div className="ms-auto d-flex align-items-center gap-2">
          <span className="text-white-50 d-none d-md-inline">
            {user?.username} {user?.full_name || user?.fullName || ""}
          </span>
          <button className="btn btn-light btn-sm rounded-pill" onClick={() => navigate("/login")}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      <div className="container-xxl py-3">
        {/* Toolbar ใต้หัวเรื่อง + ปุ่มย้อนกลับ (ซ้าย) */}
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body d-flex flex-wrap gap-2 align-items-center">
            <button className="btn btn-outline-secondary rounded-pill" onClick={() => navigate(-1)}>
              ← ย้อนกลับ
            </button>
            <h4 className="mb-0 ms-1">ข้อมูลสมรรถนะ / โปรไฟล์</h4>
          </div>
        </div>

        {/* เนื้อหา */}
        {loading ? (
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body py-5 text-center">
              <div className="spinner-border" role="status" aria-hidden="true" />
              <div className="text-muted mt-2">กำลังโหลดข้อมูล…</div>
            </div>
          </div>
        ) : (
          <div className="row g-4">
            {/* ซ้าย: โปรไฟล์ + วิชาการ */}
            <div className="col-12 col-lg-5">
              <div className="card shadow-sm border-0 rounded-4">
                <div className="card-body">
                  <div className="d-flex align-items-start gap-3">
                    <img
                      src="/src/assets/csit.jpg"
                      alt="avatar"
                      className="rounded-4"
                      style={{ width: 72, height: 72, objectFit: "cover" }}
                    />
                    <div>
                      <h5 className="mb-1">{acct?.full_name || "-"}</h5>
                      <div className="text-muted small">{acct?.username}</div>
                      <div className="text-muted small">
                        ชั้นปี: <b>{acct?.year_level ?? "-"}</b>
                      </div>
                    </div>
                  </div>

                  <hr />

                  <div className="row g-2">
                    <div className="col-6">
                      <div className="small text-muted">GPA (ที่กรอกเอง)</div>
                      <div className="fs-5">{acct?.manual_gpa ?? "-"}</div>
                    </div>
                    <div className="col-6">
                      <div className="small text-muted">GPA (คำนวณ)</div>
                      <div className="fs-5">{(profile?.computed_gpa ?? null) !== null ? profile.computed_gpa : "-"}</div>
                    </div>

                    <div className="col-12 mt-2">
                      <div className="small text-muted mb-1">ภาษา / ข้อสอบล่าสุด</div>
                      <div className="d-flex flex-column gap-1">
                        <div>
                          CEPT:{" "}
                          <b>
                            {langAll.CEPT?.score_raw != null
                              ? `${langAll.CEPT.score_raw}/50`
                              : langAll.CEPT?.level ?? "-"}
                          </b>
                          {langAll.CEPT?.taken_at ? ` (${langAll.CEPT.taken_at})` : ""}
                        </div>
                        <div>
                          ICT : <b>{langAll.ICT?.score_raw ?? "-"}</b>
                          {langAll.ICT?.taken_at ? ` (${langAll.ICT.taken_at})` : ""}
                        </div>
                        <div>
                          ITPE: <b>{langAll.ITPE?.score_raw ?? "-"}</b>
                          {langAll.ITPE?.taken_at ? ` (${langAll.ITPE.taken_at})` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="col-12 mt-2">
                      <div className="small text-muted">เทคโนโลยี</div>
                      <div className="fs-6">อบรม/เวิร์กช็อป {trains.length}</div>
                    </div>
                  </div>

                  <div className="mt-2 small text-muted">
                    กิจกรรม: สังคม {socialActs.length} รายการ · สื่อสาร {commActs.length} รายการ
                  </div>
                </div>
              </div>

              {academic && (
                <div className="card shadow-sm border-0 rounded-4 mt-3">
                  <div className="card-body">
                    <div className="fw-semibold mb-1">สรุปด้านวิชาการ (เทอมที่คะแนนดีกว่า)</div>
                    <div className="small text-muted">
                      GPA ใช้คำนวณ: <b>{academic.gpa_used ?? "-"}</b> · ผ่านวิชาบังคับ: <b>{academic.core_completion_pct}%</b>
                    </div>
                    <div className="mt-1">
                      คะแนน GPA <b>{academic.score_gpa}/25</b> + วิชาบังคับ <b>{academic.score_core}/15</b> =
                      <b> {academic.score_academic}/40</b>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ขวา: Radar (Normalized 0..100 ทุกแกน) */}
            <div className="col-12 col-lg-7">
              <div className="card shadow-sm border-0 rounded-4 h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h5 className="mb-0">เรดาร์สมรรถนะ 5 ด้าน (ปรับสมดุลเป็น %)</h5>
                    <div className="text-muted small">กราฟ 0–100% ต่อแกน เพื่อความสมดุลในการมองเห็น</div>
                  </div>

                  <Radar5 labels={radarDisp.labels} values={radarDisp.values} maxValues={radarDisp.max} />

                  {/* Chips คะแนนดิบใต้กราฟ (อ้างอิงเกณฑ์จริง) */}
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <span className="badge rounded-pill text-bg-secondary">วิชาการ {raw.acad}/40</span>
                    <span className="badge rounded-pill text-bg-secondary">ภาษา {raw.lang}/20</span>
                    <span className="badge rounded-pill text-bg-secondary">เทคโนโลยี {raw.tech}/20</span>
                    <span className="badge rounded-pill text-bg-secondary">สังคม {raw.social}/10</span>
                    <span className="badge rounded-pill text-bg-secondary">สื่อสาร {raw.comm}/10</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* local focus style ให้เข้าชุด */}
      <style>{`
        .form-control:focus,.form-select:focus{
          box-shadow:0 0 0 .2rem rgba(111,66,193,.12);
          border-color:#8e5cff;
        }
      `}</style>
    </div>
  );
}
