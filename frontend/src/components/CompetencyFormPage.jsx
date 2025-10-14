// src/pages/CompetencyFormPage.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// sections
import AcademicSection from "../components/competency/AcademicSection";
import LanguageSection from "../components/competency/LanguageSection";
import TechSection from "../components/competency/TechSection";
import ActivitiesSection from "../components/competency/ActivitiesSection";
import ScorePreview from "../components/competency/ScorePreview";

// apis
import {
  getCompetencyProfile,
  getRequiredCourses,
  getSavedGrades,
  getLatestLanguage,
  getLatestLanguagesAll,
  listTechCerts,
  listTrainings,
  listActivities,
} from "../services/competencyApi";

export default function CompetencyFormPage() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  // fallback ช่วง dev
  const user = authUser ?? { id: 1, major_id: 2, year_level: 4 };

  const [active, setActive] = useState("academic");
  const [ready, setReady] = useState(false);

  // สโตร์ข้อมูลที่ preload
  const [profile, setProfile] = useState(null);
  const [academicData, setAcademicData] = useState({ reqMap: {}, grades: {} });
  const [languageData, setLanguageData] = useState(null);
  const [langAll, setLangAll] = useState(null);
  const [techData, setTechData] = useState({ certs: [], trainings: [] });
  const [activityData, setActivityData] = useState({ social: [], communication: [] });

  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      try {
        // 1) โปรไฟล์
        const prof = await getCompetencyProfile(user.id);
        setProfile(prof);

        // ระบุ major/year ที่จะใช้ preload
        const majorId = prof?.account?.major_id ?? user.major_id;
        const yearLevel = Number(prof?.account?.year_level ?? user.year_level ?? 4) || 4;

        // 2) วิชาบังคับ+เกรด (สะสมตั้งแต่ปี 1 ถึงปีปัจจุบัน)
        const reqTasks = [];
        if (!majorId) {
          console.warn("preload: missing major_id -> ข้ามการดึงรายวิชาบังคับ");
        } else {
          for (let y = 1; y <= yearLevel; y++) {
            for (let s = 1; s <= 2; s++) {
              reqTasks.push(
                getRequiredCourses({ major: majorId, year: y, sem: s })
                  .then((r) => ({ key: `${y}-${s}`, list: r?.required || [] }))
                  .catch(() => ({ key: `${y}-${s}`, list: [] })) // กัน request ใดๆ fail
              );
            }
          }
        }

        const reqResults = reqTasks.length ? await Promise.all(reqTasks) : [];
        const reqMap = {};
        reqResults.forEach((r) => {
          reqMap[r.key] = Array.isArray(r.list) ? r.list : [];
        });

        // เกรดที่เคยบันทึกไว้ ใช้เติมใน select
        let savedGrades = { map: {} };
        try {
          savedGrades = await getSavedGrades(user.id);
        } catch (_) {
          savedGrades = { map: {} };
        }
        const grades = {};
        // ❗️สำคัญ: อย่า .flat() ตรงนี้ — ต้องวนทีละ “รายการวิชาในแต่ละเทอม”
        Object.values(reqMap).forEach((list) => {
          (list || []).forEach((c) => {
            grades[c.code] = savedGrades.map?.[c.code] || "";
          });
        });
        setAcademicData({ reqMap, grades });

        // 3) ภาษา (CEPT) + รวม (ICT/ITPE)
        const lang = await getLatestLanguage(user.id).catch(() => ({ latest: null }));
        setLanguageData(lang.latest || null);
        const allLang = await getLatestLanguagesAll(user.id).catch(() => ({}));
        setLangAll(allLang || {});

        // 4) เทคโนโลยี (cert/trainings)
        const [certs, trainings] = await Promise.all([
          listTechCerts(user.id).catch(() => ({ items: [] })),
          listTrainings(user.id).catch(() => ({ items: [] })),
        ]);
        setTechData({ certs: certs.items || [], trainings: trainings.items || [] });

        // 5) กิจกรรม (สังคม/สื่อสาร)
        const [social, comm] = await Promise.all([
          listActivities(user.id, "social").catch(() => ({ items: [] })),
          listActivities(user.id, "communication").catch(() => ({ items: [] })),
        ]);
        setActivityData({
          social: social.items || [],
          communication: comm.items || [],
        });

        setReady(true);
      } catch (e) {
        console.error("preload error:", e);
        alert(e?.message || "โหลดข้อมูลไม่สำเร็จ");
      }
    })();
  }, [user?.id]);

  const TABS = useMemo(
    () => [
      { key: "academic", label: "1) วิชาการ" },
      { key: "language", label: "2) ภาษา (CEPT)" },
      { key: "tech", label: "3) ทักษะเทคโนโลยี" },
      { key: "social", label: "4) สังคม" },
      { key: "comm", label: "5) การสื่อสาร" },
    ],
    []
  );

  if (!ready) return <div className="p-4 text-muted">กำลังโหลดข้อมูลทั้งหมด…</div>;

  return (
    <div className="min-vh-100" style={{ background: "linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%)" }}>
      {/* Top Bar */}
      <div
        className="d-flex align-items-center px-3"
        style={{
          height: 72,
          background: "linear-gradient(90deg,#6f42c1,#8e5cff)",
          boxShadow: "0 4px 14px rgba(111,66,193,.22)",
          position: "sticky",
          top: 0,
          zIndex: 1040,
        }}
      >
        <img src="/src/assets/csit.jpg" alt="Logo" className="rounded-3 me-3" style={{ width: 40, height: 40, objectFit: "cover" }} />
        <div className="text-white fw-semibold">CSIT Competency System</div>
        <div className="ms-auto text-white-50 d-none d-md-block">
          {authUser ? `${authUser.username} ${authUser.full_name || ""}` : "Guest"}
        </div>
      </div>

      <div className="container-xxl py-4">
        {/* Toolbar */}
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body d-flex flex-wrap gap-2 align-items-center">
            <button className="btn btn-outline-secondary rounded-pill" onClick={() => navigate(-1)}>
              ← ย้อนกลับ
            </button>
            <h4 className="mb-0 ms-1">ฟอร์มสมรรถนะ 5 ด้าน</h4>
            <div className="ms-auto">
              <ScorePreview user={user} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body py-2">
            <div className="d-flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  className={`btn tab-pill ${active === t.key ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setActive(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content (ส่ง preloaded props ให้ทุกแท็บ) */}
        <div className="card shadow-sm border-0 rounded-4">
          <div className="card-body">
            {active === "academic" && <AcademicSection user={user} preloaded={academicData} />}
            {active === "language" && <LanguageSection user={user} preloaded={languageData} />}
            {active === "tech" && <TechSection user={user} preloaded={techData} langAll={langAll} />}
            {active === "social" && <ActivitiesSection user={user} category="social" preloaded={activityData.social} />}
            {active === "comm" && <ActivitiesSection user={user} category="communication" preloaded={activityData.communication} />}
          </div>
        </div>
      </div>

      <style>{`
        .tab-pill{ border-radius:9999px; padding:.48rem 1rem; }
        .form-control:focus,.form-select:focus{
          box-shadow:0 0 0 .2rem rgba(111,66,193,.12);
          border-color:#8e5cff;
        }
      `}</style>
    </div>
  );
}
