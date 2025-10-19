// src/pages/CompetencyFormPage.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
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

  // ===== UI enhance =====
  const tabsRef = useRef(null);

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
      { key: "academic", label: "1) วิชาการ", icon: "bi-journal-text" },
      { key: "language", label: "2) ภาษา (CEPT)", icon: "bi-translate" },
      { key: "tech", label: "3) ทักษะเทคโนโลยี", icon: "bi-cpu" },
      { key: "social", label: "4) กิจกรรมทางสังคม", icon: "bi-people" },
      { key: "comm", label: "5) การสื่อสาร", icon: "bi-megaphone" },
    ],
    []
  );

  // Hotkeys: Ctrl/Cmd + ArrowLeft/Right เปลี่ยนแท็บ, `/` โฟกัสค้นหา (เผื่ออนาคต)
  useEffect(() => {
    const handler = (e) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const mod = (isMac && e.metaKey) || (!isMac && e.ctrlKey);
      if (!mod) return;
      if (e.key === "ArrowRight" || e.key === "]") {
        e.preventDefault();
        const idx = TABS.findIndex((t) => t.key === active);
        const next = TABS[(idx + 1) % TABS.length];
        setActive(next.key);
        tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (e.key === "ArrowLeft" || e.key === "[") {
        e.preventDefault();
        const idx = TABS.findIndex((t) => t.key === active);
        const prev = TABS[(idx - 1 + TABS.length) % TABS.length];
        setActive(prev.key);
        tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, TABS]);

  // progress (คร่าว ๆ): นับแท็บที่มีข้อมูลเบื้องต้น
  const progress = useMemo(() => {
    let p = 0;
    if (Object.keys(academicData.reqMap || {}).length) p += 1;
    if (languageData || (langAll && (langAll.ICT || langAll.ITPE))) p += 1;
    if ((techData.certs || []).length || (techData.trainings || []).length) p += 1;
    if ((activityData.social || []).length) p += 1;
    if ((activityData.communication || []).length) p += 1;
    return Math.round((p / 5) * 100);
  }, [academicData, languageData, langAll, techData, activityData]);

  if (!ready) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-animated text-muted">
        <div className="card border-0 shadow-sm rounded-4 glassy p-4">
          <div className="d-flex align-items-center gap-3">
            <div className="spinner-border" role="status" aria-hidden="true"></div>
            <div>
              <div className="fw-semibold">กำลังโหลดข้อมูลทั้งหมด…</div>
              <div className="small">โปรดรอสักครู่</div>
            </div>
          </div>
        </div>
        <style>{`.bg-animated{background:radial-gradient(1200px 600px at 10% -10%, #efe7ff 15%, transparent 60%),radial-gradient(1000px 500px at 110% 10%, #e6f0ff 10%, transparent 55%),linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%);} .glassy{backdrop-filter:blur(8px);}`}</style>
      </div>
    );
  }

  return (
    <div className="min-vh-100 position-relative overflow-hidden bg-animated">
      {/* Decorative background blobs */}
      <div className="bg-blob bg-blob-1" aria-hidden="true" />
      <div className="bg-blob bg-blob-2" aria-hidden="true" />
      <div className="bg-blob bg-blob-3" aria-hidden="true" />

      {/* Top Bar */}
      <div className="d-flex align-items-center px-3 topbar glassy" style={{ height: 72 }}>
        <img src="/src/assets/csit.jpg" alt="Logo" className="rounded-3 me-3 shadow-sm" style={{ width: 40, height: 40, objectFit: "cover" }} />
        <div className="text-white fw-semibold">CSIT Competency System</div>
        <div className="ms-auto text-white-50 d-none d-md-block">
          {authUser ? `${authUser.username} ${authUser.full_name || ""}` : "Guest"}
        </div>
      </div>

      <div className="container-xxl py-4 position-relative" style={{ zIndex: 1 }}>
        {/* Toolbar */}
        <div className="card border-0 shadow-sm rounded-4 mb-3 card-float glassy">
          <div className="card-body d-flex flex-wrap gap-3 align-items-center">
            <button className="btn btn-outline-secondary rounded-pill ripple" onClick={() => navigate(-1)}>← ย้อนกลับ</button>
            <h4 className="mb-0 ms-1">ฟอร์มสมรรถนะ 5 ด้าน</h4>
            <div className="ms-auto d-flex align-items-center gap-3">
              <div className="small text-muted d-none d-md-block">ความคืบหน้า</div>
              <div className="progress" style={{ width: 160, height: 8 }} aria-label="progress">
                <div className="progress-bar" role="progressbar" style={{ width: `${progress}%` }} aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"></div>
              </div>
              <div id="scorePreviewAnchor"><ScorePreview user={user} /></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div ref={tabsRef} className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body py-2">
            <div className="d-flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  className={`btn tab-pill ${active === t.key ? "btn-primary" : "btn-outline-secondary"} ripple`}
                  onClick={() => setActive(t.key)}
                  title={t.label}
                >
                  <i className={`bi ${t.icon} me-2`} aria-hidden="true"></i>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content (ส่ง preloaded props ให้ทุกแท็บ) */}
        <div className="card shadow-lg border-0 rounded-4 glassy">
          <div className="card-body">
            {active === "academic" && <AcademicSection user={user} preloaded={academicData} />}
            {active === "language" && <LanguageSection user={user} preloaded={languageData} />}
            {active === "tech" && <TechSection user={user} preloaded={techData} langAll={langAll} />}
            {active === "social" && <ActivitiesSection user={user} category="social" preloaded={activityData.social} />}
            {active === "comm" && <ActivitiesSection user={user} category="communication" preloaded={activityData.communication} />}
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <svg className="wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,64L80,90.7C160,117,320,171,480,176C640,181,800,139,960,128C1120,117,1280,139,1360,149.3L1440,160L1440,0L1360,0C1280,0,1120,0,960,0C800,0,640,0,480,0C320,0,160,0,80,0L0,0Z" fill="#ffffff" fillOpacity="0.85"></path>
      </svg>

      {/* Local styles */}
      <style>{`
        /* Animated background & blobs (match whole app) */
        .bg-animated { background: radial-gradient(1200px 600px at 10% -10%, #efe7ff 15%, transparent 60%), radial-gradient(1000px 500px at 110% 10%, #e6f0ff 10%, transparent 55%), linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%); }
        .glassy { backdrop-filter: blur(8px); }
        .topbar { position: sticky; top: 0; left: 0; width: 100%; background: linear-gradient(90deg, rgba(111,66,193,.9), rgba(142,92,255,.9)); box-shadow: 0 4px 16px rgba(111,66,193,.22); z-index: 1040; border-bottom: 1px solid rgba(255,255,255,.12); }

        /* Floating toolbar subtle motion */
        .card-float { animation: floatY 6s ease-in-out infinite; }
        @keyframes floatY { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-6px) } }

        .tab-pill{ border-radius:9999px; padding:.48rem 1rem; }
        .form-control:focus,.form-select:focus{ box-shadow:0 0 0 .2rem rgba(111,66,193,.12); border-color:#8e5cff; }

        /* Ripple */
        .ripple { position: relative; overflow: hidden; }
        .ripple:after { content: ""; position: absolute; inset: 0; border-radius: inherit; opacity: 0; background: radial-gradient(circle at var(--x,50%) var(--y,50%), rgba(255,255,255,.45), transparent 40%); transform: scale(0.2); transition: transform .3s, opacity .45s; pointer-events: none; }
        .ripple:active:after { opacity: 1; transform: scale(1); transition: 0s; }
        .ripple { --x: 50%; --y: 50%; }
        .ripple:focus-visible { outline: 3px solid rgba(142,92,255,.45); outline-offset: 2px; }

        /* Blobs */
        .bg-blob { position: absolute; filter: blur(60px); opacity: .55; z-index: 0; }
        .bg-blob-1 { width: 420px; height: 420px; left: -120px; top: -80px; background: #d7c6ff; animation: drift1 18s ease-in-out infinite; }
        .bg-blob-2 { width: 360px; height: 360px; right: -120px; top: 120px; background: #c6ddff; animation: drift2 22s ease-in-out infinite; }
        .bg-blob-3 { width: 300px; height: 300px; left: 15%; bottom: -120px; background: #ffd9ec; animation: drift3 20s ease-in-out infinite; }
        @keyframes drift1 { 0%,100%{ transform: translate(0,0) } 50%{ transform: translate(20px,10px) } }
        @keyframes drift2 { 0%,100%{ transform: translate(0,0) } 50%{ transform: translate(-16px,8px) } }
        @keyframes drift3 { 0%,100%{ transform: translate(0,0) } 50%{ transform: translate(12px,-12px) } }

        /* Wave */
        .wave { position: fixed; left: 0; right: 0; bottom: -1px; width: 100%; height: 120px; }
      `}</style>

      {/* ripple positioning script */}
      <script dangerouslySetInnerHTML={{ __html: `
        document.addEventListener('pointerdown', (e) => {
          const el = e.target.closest('.ripple');
          if (!el) return;
          const rect = el.getBoundingClientRect();
          el.style.setProperty('--x', ((e.clientX - rect.left) / rect.width * 100).toFixed(2) + '%');
          el.style.setProperty('--y', ((e.clientY - rect.top) / rect.height * 100).toFixed(2) + '%');
        }, { passive: true });
      `}} />
    </div>
  );
}
