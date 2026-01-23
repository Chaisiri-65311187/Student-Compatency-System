// src/components/StudentProfilePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  getCompetencyProfile,
  recalcAcademic,
  getLatestLanguage,
  getLatestLanguagesAll,
  listTrainings,
  listActivities,
  peer,
} from "../services/competencyApi";
import { getAccountById, updateAccount, uploadAvatar } from "../services/api";
import Radar5 from "../components/profile/Radar5";
import {
  scoreAcademic,
  scoreLang,
  scoreTech,
  calcAllCompetencies,
  toArray,
} from "../utils/scoring";

/* =========================================
   1. UTILITIES & CONFIG
   ========================================= */
const API_BASE = (import.meta.env?.VITE_API_BASE || "http://localhost:3000").replace(/\/+$/, "");

function resolveAvatarUrl(u) {
  if (!u) return "/src/assets/csit.jpg";
  if (/^(data:|https?:\/\/)/i.test(u)) return u;
  if (u.startsWith("/uploads")) return `${API_BASE}${u}`;
  return u;
}

/* =========================================
   2. CUSTOM HOOKS (LOGIC)
   ========================================= */

/** Hook: จัดการดึงข้อมูลทั้งหมด */
function useStudentData(userId) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    profile: null,
    academic: null,
    langLatest: null,
    langAll: { CEPT: null, ICT: null, ITPE: null },
    trains: [],
    socialActs: [],
    collab: { peerAvg: 0, selfAvg: 0, peerCount: 0 },
  });

  // Period ปัจจุบัน (เช่น 2025-1)
  const periodKey = useMemo(() => {
    const d = new Date();
    const sem = (d.getMonth() + 1) <= 5 ? 1 : 2;
    return `${d.getFullYear()}-${sem}`;
  }, []);

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const prof = await getCompetencyProfile(userId);
      
      // ดึง Academic (ทุกปีทุกเทอม)
      const yMax = prof?.account?.year_level || 4;
      const acadJobs = [];
      for (let y = 1; y <= yMax; y++) {
        for (let s = 1; s <= 2; s++) {
          acadJobs.push(recalcAcademic(userId, { year: y, sem: s }).catch(() => null));
        }
      }
      const allAcad = (await Promise.all(acadJobs)).filter(Boolean);
      
      // คำนวณค่าเฉลี่ย Academic
      let sumScore = 0, sumGpa = 0, sumCore = 0, n = 0;
      allAcad.forEach(r => {
        if (typeof r?.score_academic === "number") {
          sumScore += r.score_academic;
          sumGpa += (r.score_gpa ?? 0);
          sumCore += (r.score_core ?? 0);
          n++;
        }
      });
      const academicAgg = n ? {
        score_academic: Number((sumScore / n).toFixed(2)),
        score_gpa: Number((sumGpa / n).toFixed(2)),
        score_core: Number((sumCore / n).toFixed(2)),
        gpa_used: allAcad.at(-1)?.gpa_used ?? null,
        core_completion_pct: allAcad.at(-1)?.core_completion_pct ?? null,
      } : null;

      // ดึงข้อมูลด้านอื่นๆ พร้อมกัน (Parallel)
      const [langRes, langAllRes, trainRes, socialRes] = await Promise.all([
        getLatestLanguage(userId),
        getLatestLanguagesAll(userId),
        listTrainings(userId),
        listActivities(userId, "social"),
      ]);

      // ดึง Collaboration (Peer/Self)
      let collabData = { peerAvg: 0, selfAvg: 0, peerCount: 0 };
      try {
        const rec = await peer.received(userId, periodKey);
        const peerAvg = Number(rec?.avg ?? rec?.summary?.peer_avg ?? 0) || 0;
        const peerCount = Number(rec?.count ?? rec?.summary?.peer_count ?? 0) || 0;
        
        let selfAvg = 0;
        try {
          const self = await (peer.self ? peer.self(userId, periodKey) : peer.given(userId, periodKey));
          selfAvg = Number(self?.avg ?? self?.summary?.self_avg ?? 0) || 0;
        } catch { /* ignore self error */ }
        
        collabData = { peerAvg, selfAvg, peerCount };
      } catch { /* ignore peer error */ }

      setData({
        profile: prof,
        academic: academicAgg,
        langLatest: langRes?.latest || null,
        langAll: langAllRes || { CEPT: null, ICT: null, ITPE: null },
        trains: toArray(trainRes),
        socialActs: toArray(socialRes),
        collab: collabData,
      });

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [userId, periodKey]);

  return { loading, ...data, periodKey, refetch: fetchData };
}

/** Hook: คำนวณคะแนนสมรรถนะ */
function useCompetencyScores(data) {
  return useMemo(() => {
    const { academic, profile, langLatest, langAll, trains, socialActs, collab } = data;
    
    // 1. Academic
    const acadObj = scoreAcademic({
      manualGpa: Number(profile?.account?.manual_gpa),
      scoreGpa25: Number(academic?.score_gpa ?? 0),
      scoreCore15: Number(academic?.score_core ?? 0),
    });
    const acadScore = acadObj.score;

    // 2. Language & Technology
    const langScore = scoreLang(langLatest?.level)?.score ?? 0;
    const techScore = scoreTech(
      trains.length, 
      Number(langAll?.ICT?.score_raw ?? 0), 
      Number(langAll?.ITPE?.score_raw ?? 0), 
      langAll?.CEPT ?? null
    )?.score ?? 0;

    // 3. Base Calculation (Acad, Lang, Tech, Social)
    const base = calcAllCompetencies({
      acadScore, langScore, techScore,
      socialActs,
      commActs: [], 
    });

    // 4. Collaboration (Peer 80% + Self 20%)
    const collabPct = Math.round(0.8 * (collab.peerAvg || 0) + 0.2 * (collab.selfAvg || 0));

    // 5. Total
    const pAcad = base.each.acad ?? 0;
    const pLang = base.each.lang ?? 0;
    const pTech = base.each.tech ?? 0;
    const pSoc = base.each.social ?? 0;
    
    const total5 = Math.round((pAcad + pLang + pTech + pSoc + collabPct) / 5);

    return {
      each: { acad: pAcad, lang: pLang, tech: pTech, social: pSoc, collab: collabPct },
      total: total5,
    };
  }, [data]);
}

/* =========================================
   3. SUB-COMPONENTS
   ========================================= */

const EditProfileModal = ({ isOpen, onClose, userId, onUpdateSuccess }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // State สำหรับฟอร์ม
  const [form, setForm] = useState({
    full_name: "", 
    email: "",     
    phone: "",     
    line_id: "",   
    facebook: "",  
    github: "",    
    avatar_url: "" 
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (isOpen && userId) {
      const loadUser = async () => {
        try {
          const acc = await getAccountById(userId);
          setForm({
            full_name: acc?.full_name || `${acc?.first_name || ""} ${acc?.last_name || ""}`.trim(),
            email: acc?.email || "",
            phone: acc?.phone || "",
            line_id: acc?.line_id || "",
            facebook: acc?.facebook || "",
            github: acc?.github || "",
            avatar_url: acc?.avatar_url || "",
          });
          setPreview(resolveAvatarUrl(acc?.avatar_url || ""));
        } catch (e) { setError(e.message); }
      };
      loadUser();
    } else {
      setFile(null);
      setError("");
    }
  }, [isOpen, userId]);

  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      let avatarUrl = form.avatar_url;
      if (file) {
        const up = await uploadAvatar(userId, file);
        if (up?.url) avatarUrl = up.url;
      }
      const payload = { 
        ...form, 
        full_name: form.full_name?.trim(), 
        avatar_url: avatarUrl 
      };
      
      await updateAccount(userId, payload);
      onUpdateSuccess(payload);
      onClose();
    } catch (err) {
      setError(err.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content rounded-4">
          <div className="modal-header border-0">
            <h5 className="modal-title">แก้ไขโปรไฟล์</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              
              <div className="row g-3">
                {/* --- ซ้าย: รูปโปรไฟล์ --- */}
                <div className="col-12 col-md-4 text-center">
                  <div className="rounded-4 border mx-auto overflow-hidden bg-light position-relative" style={{ width: "100%", aspectRatio: "1/1" }}>
                    <img 
                      src={preview || "/src/assets/csit.jpg"} 
                      alt="avatar" 
                      className="w-100 h-100 object-fit-cover" 
                      onError={(e) => (e.currentTarget.src = "/src/assets/csit.jpg")}
                    />
                  </div>
                  <label className="btn btn-outline-primary w-100 mt-3 rounded-pill ripple">
                    อัปโหลดรูป...
                    <input type="file" accept="image/*" hidden onChange={handleFileChange} />
                  </label>
                </div>

                {/* --- ขวา: ฟอร์มข้อมูล --- */}
                <div className="col-12 col-md-8">
                  <div className="row g-2">
                    
                    {/* ชื่อ-นามสกุล */}
                    <div className="col-12">
                       <div className="form-floating">
                         <input 
                            className="form-control rounded-3" 
                            id="full_name"
                            value={form.full_name} 
                            onChange={e => setForm({...form, full_name: e.target.value})} 
                            placeholder="ชื่อ–นามสกุล" 
                         />
                         <label htmlFor="full_name">ชื่อ–นามสกุล (แสดงผล)</label>
                       </div>
                    </div>

                    {/* อีเมล & เบอร์โทร */}
                    <div className="col-md-6">
                        <div className="form-floating">
                          <input 
                            className="form-control rounded-3" 
                            id="email"
                            value={form.email} 
                            onChange={e => setForm({...form, email: e.target.value})} 
                            placeholder="อีเมล"
                          />
                          <label htmlFor="email">อีเมล</label>
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="form-floating">
                          <input 
                            className="form-control rounded-3" 
                            id="phone"
                            value={form.phone} 
                            onChange={e => setForm({...form, phone: e.target.value})} 
                            placeholder="เบอร์โทร"
                          />
                          <label htmlFor="phone">เบอร์โทร</label>
                        </div>
                    </div>

                    {/* Socials */}
                    <div className="col-md-4">
                        <div className="form-floating">
                          <input 
                            className="form-control rounded-3" 
                            id="line_id"
                            value={form.line_id} 
                            onChange={e => setForm({...form, line_id: e.target.value})} 
                            placeholder="Line ID"
                          />
                          <label htmlFor="line_id">Line ID</label>
                        </div>
                    </div>
                    <div className="col-md-4">
                        <div className="form-floating">
                          <input 
                            className="form-control rounded-3" 
                            id="facebook"
                            value={form.facebook} 
                            onChange={e => setForm({...form, facebook: e.target.value})} 
                            placeholder="Facebook"
                          />
                          <label htmlFor="facebook">Facebook</label>
                        </div>
                    </div>
                    <div className="col-md-4">
                        <div className="form-floating">
                          <input 
                            className="form-control rounded-3" 
                            id="github"
                            value={form.github} 
                            onChange={e => setForm({...form, github: e.target.value})} 
                            placeholder="GitHub"
                          />
                          <label htmlFor="github">GitHub</label>
                        </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer border-0">
              <button type="button" className="btn btn-outline-secondary rounded-pill" onClick={onClose}>ยกเลิก</button>
              <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={saving}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const RadarChartCard = ({ scores }) => {
  // Mapping ให้แสดงเป็นภาษาไทย และเรียงลำดับตามต้องการ
  const categories = [
    { key: 'acad', label: 'วิชาการ' },
    { key: 'lang', label: 'ภาษา' },
    { key: 'tech', label: 'เทคโนโลยี' },
    { key: 'social', label: 'สังคม' },
    { key: 'collab', label: 'ทำงานร่วมกับผู้อื่น' },
  ];

  return (
    <div className="card shadow-sm border-0 rounded-4 h-100 glassy">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h5 className="mb-0">เรดาร์สมรรถนะ 5 ด้าน</h5>
          <div className="badge text-bg-primary rounded-pill">คะแนนรวม : {scores?.total ?? 0}/100 </div>
        </div>
        
        <div style={{ maxHeight: '440px' }}>
          <Radar5
            labels={categories.map(c => c.label)}
            values={categories.map(c => scores?.each?.[c.key] ?? 0)}
            maxValues={[100, 100, 100, 100, 100]}
            baseColor="#6f42c1"
            theme="light"
            height={400}
          />
        </div>

        <div className="d-flex flex-wrap gap-2 mt-3 justify-content-center">
          {categories.map(({ key, label }) => (
              <span key={key} className="badge rounded-pill bg-light text-dark border">
                  {label} {scores?.each?.[key] ?? 0}
              </span>
          ))}
        </div>
      </div>
    </div>
  );
};

/* =========================================
   4. MAIN COMPONENT
   ========================================= */

export default function StudentProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Logic Hooks
  const { 
    loading, profile, academic, langLatest, langAll, trains, socialActs, collab, periodKey, refetch 
  } = useStudentData(user?.id);

  const scores = useCompetencyScores({ 
    academic, profile, langLatest, langAll, trains, socialActs, collab 
  });

  // UI State
  const [editOpen, setEditOpen] = useState(false);

  // Helper for UI
  const acct = profile?.account;
  const avatar = resolveAvatarUrl(acct?.avatar_url);

  const handleUpdateSuccess = (updatedFields) => {
    refetch(); 
    alert("บันทึกโปรไฟล์สำเร็จ");
  };

  return (
    <div className="min-vh-100 position-relative overflow-hidden bg-animated">
      <BackgroundEffects />

      {/* Top Bar */}
      <div className="d-flex align-items-center px-3 topbar glassy">
        <img src="/src/assets/csit.jpg" alt="Logo" className="rounded-3 me-3 shadow-sm" style={{ width: 40, height: 40, objectFit: "cover" }} />
        <div className="text-white fw-semibold">CSIT Competency System</div>
        <div className="ms-auto d-flex align-items-center gap-2">
          <span className="text-white-50 d-none d-md-inline">{user?.username} {user?.full_name}</span>
          <button className="btn btn-light btn-sm rounded-pill ripple" onClick={() => navigate("/login")}>ออกจากระบบ</button>
        </div>
      </div>

      <div className="container-xxl py-4 position-relative" style={{ zIndex: 1 }}>
        {/* Toolbar */}
        <div className="card border-0 shadow-sm rounded-4 mb-3 card-float glassy">
          <div className="card-body d-flex flex-wrap gap-2 align-items-center">
            <button className="btn btn-outline-secondary rounded-pill ripple" onClick={() => navigate(-1)}>← ย้อนกลับ</button>
            <h4 className="mb-0 ms-1">ข้อมูลสมรรถนะ / โปรไฟล์</h4>
            <div className="ms-auto">
              <button className="btn btn-primary rounded-pill ripple" onClick={() => setEditOpen(true)}>แก้ไขโปรไฟล์</button>
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="row g-4">
            {/* Left Column: Profile Info */}
            <div className="col-12 col-lg-5">
              <ProfileInfoCard 
                acct={acct} 
                avatar={avatar} 
                langAll={langAll} 
                trainsCount={trains.length} 
                socialCount={socialActs.length}
                collab={collab}
                periodKey={periodKey}
                onAvatarClick={() => setEditOpen(true)}
              />
            </div>

            {/* Right Column: Radar Chart */}
            <div className="col-12 col-lg-7">
              <RadarChartCard scores={scores} />
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <EditProfileModal 
        isOpen={editOpen} 
        onClose={() => setEditOpen(false)} 
        userId={user?.id} 
        onUpdateSuccess={handleUpdateSuccess} 
      />

      <GlobalStyles />
    </div>
  );
}

/* =========================================
   5. PRESENTATIONAL COMPONENTS
   ========================================= */

const ProfileInfoCard = ({ acct, avatar, langAll, trainsCount, socialCount, collab, periodKey, onAvatarClick }) => (
  <div className="card shadow-sm border-0 rounded-4 glassy h-100">
    <div className="card-body">
      <div className="d-flex align-items-start gap-3">
        <div className="position-relative pointer" onClick={onAvatarClick} style={{ cursor: "pointer" }}>
          <img src={avatar} alt="avatar" className="rounded-4 shadow-sm object-fit-cover" style={{ width: 84, height: 84 }} />
          <div className="btn btn-sm btn-light rounded-circle position-absolute bottom-0 end-0 shadow-sm">
            <i className="bi bi-pencil-fill small" />
          </div>
        </div>
        <div>
          <div className="h5 mb-1">{acct?.full_name || "-"}</div>
          <div className="text-muted small">{acct?.username}</div>
          <div className="text-muted small">ชั้นปี: <b>{acct?.year_level ?? "-"}</b></div>
          <ContactInfo acct={acct} />
        </div>
      </div>

      <hr />

      <div className="row g-2">
        <div className="col-6">
          <div className="small text-muted">GPAX</div>
          <div className="fs-5">{acct?.manual_gpa ?? "-"}</div>
        </div>
        <div className="col-12 mt-2">
          <div className="small text-muted mb-1">ภาษา / ข้อสอบล่าสุด</div>
          <div className="d-flex flex-column gap-1 small">
            <div>CEPT: <b>{langAll.CEPT?.score_raw != null ? `${langAll.CEPT.score_raw}/50` : langAll.CEPT?.level ?? "-"}</b></div>
            <div>ICT: <b>{langAll.ICT?.score_raw ?? "-"}</b></div>
            <div>ITPE: <b>{langAll.ITPE?.score_raw ?? "-"}</b></div>
          </div>
        </div>
        <div className="col-12 mt-2">
          <div className="small text-muted">เทคโนโลยี</div>
          <div className="fs-6">อบรม/เวิร์กช็อป {trainsCount}</div>
        </div>
      </div>

      <div className="mt-3 small bg-white bg-opacity-50 p-2 rounded-3">
        <div className="text-muted fw-bold">ทำงานร่วมกับผู้อื่น (รอบ {periodKey})</div>
        <div className="d-flex justify-content-between">
            <span>Peer Avg: <b>{Math.round(collab.peerAvg)}</b></span>
            <span>Self Avg: <b>{Math.round(collab.selfAvg)}</b></span>
        </div>
        <div className="text-muted fst-italic mt-1" style={{fontSize: '0.8rem'}}>({collab.peerCount} คนประเมิน)</div>
      </div>
      
      <div className="mt-2 small text-muted text-end">กิจกรรมสังคม {socialCount} รายการ</div>
    </div>
  </div>
);

const ContactInfo = ({ acct }) => (
  <div className="mt-2 small">
    {acct?.email && <div>📧 {acct.email}</div>}
    {acct?.line_id && <div>💬 Line: {acct.line_id}</div>}
  </div>
);

const LoadingSpinner = () => (
  <div className="card border-0 shadow-sm rounded-4">
    <div className="card-body py-5 text-center">
      <div className="spinner-border text-primary" role="status" aria-hidden="true" />
      <div className="text-muted mt-2">กำลังโหลดข้อมูล...</div>
    </div>
  </div>
);

const BackgroundEffects = () => (
  <>
    <div className="bg-blob bg-blob-1" aria-hidden="true" />
    <div className="bg-blob bg-blob-2" aria-hidden="true" />
    <div className="bg-blob bg-blob-3" aria-hidden="true" />
    <svg className="wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0,64L80,90.7C160,117,320,171,480,176C640,181,800,139,960,128C1120,117,1280,139,1360,149.3L1440,160L1440,0L1360,0C1280,0,1120,0,960,0C800,0,640,0,480,0C320,0,160,0,80,0L0,0Z" fill="#ffffff" fillOpacity="0.85" />
    </svg>
  </>
);

const GlobalStyles = () => (
  <>
    <style>{`
      .bg-animated { background: radial-gradient(1200px 600px at 10% -10%, #efe7ff 15%, transparent 60%), radial-gradient(1000px 500px at 110% 10%, #e6f0ff 10%, transparent 55%), linear-gradient(180deg, #f7f7fb 0%, #eef1f7 100%); }
      .glassy { backdrop-filter: blur(8px); background: rgba(255, 255, 255, 0.7); }
      .topbar { position: sticky; top: 0; left: 0; width: 100%; height: 72px; background: linear-gradient(90deg, rgba(111, 66, 193, 0.9), rgba(142, 92, 255, 0.9)); box-shadow: 0 4px 16px rgba(111, 66, 193, 0.22); z-index: 1040; border-bottom: 1px solid rgba(255, 255, 255, 0.12); }
      .card-float { animation: floatY 6s ease-in-out infinite; }
      @keyframes floatY { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
      .ripple { position: relative; overflow: hidden; }
      .ripple:after { content: ""; position: absolute; inset: 0; border-radius: inherit; opacity: 0; background: radial-gradient(circle at var(--x, 50%) var(--y, 50%), rgba(255, 255, 255, 0.45), transparent 40%); transform: scale(0.2); transition: transform 0.3s, opacity 0.45s; pointer-events: none; }
      .ripple:active:after { opacity: 1; transform: scale(1); transition: 0s; }
      .bg-blob { position: absolute; filter: blur(60px); opacity: 0.55; z-index: 0; }
      .bg-blob-1 { width: 420px; height: 420px; left: -120px; top: -80px; background: #d7c6ff; animation: drift1 18s ease-in-out infinite; }
      .bg-blob-2 { width: 360px; height: 360px; right: -120px; top: 120px; background: #c6ddff; animation: drift2 22s ease-in-out infinite; }
      .bg-blob-3 { width: 300px; height: 300px; left: 15%; bottom: -120px; background: #ffd9ec; animation: drift3 20s ease-in-out infinite; }
      @keyframes drift1 { 0%, 100% { transform: translate(0, 0) } 50% { transform: translate(20px, 10px) } }
      @keyframes drift2 { 0%, 100% { transform: translate(0, 0) } 50% { transform: translate(-16px, 8px) } }
      @keyframes drift3 { 0%, 100% { transform: translate(0, 0) } 50% { transform: translate(12px, -12px) } }
      .wave { position: fixed; left: 0; right: 0; bottom: -1px; width: 100%; height: 120px; z-index: 0; pointer-events: none; }
      .object-fit-cover { object-fit: cover; }
    `}</style>
    {/* Ripple Effect Handler */}
    <script dangerouslySetInnerHTML={{
      __html: `
        document.addEventListener('pointerdown', (e) => {
          const el = e.target.closest('.ripple');
          if (!el) return;
          const rect = el.getBoundingClientRect();
          el.style.setProperty('--x', ((e.clientX - rect.left) / rect.width) * 100 + '%');
          el.style.setProperty('--y', ((e.clientY - rect.top) / rect.height) * 100 + '%');
        }, { passive: true });
      `
    }} />
  </>
);