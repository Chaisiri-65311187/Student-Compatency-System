// src/components/StudentProfilePage.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  getCompetencyProfile,
  recalcAcademic,
  getLatestLanguage,
  getLatestLanguagesAll,
  listTrainings,
  listActivities,
} from "../services/competencyApi";
import { getAccountById, updateAccount, uploadAvatar } from "../services/api";
import Radar5 from "../components/profile/Radar5";

/* ===== Helper: ประกอบ URL รูปจาก backend ===== */
const API_BASE = (import.meta.env?.VITE_API_BASE || "http://localhost:3000").replace(/\/+$/, "");
function resolveAvatarUrl(u) {
  if (!u) return "/src/assets/csit.jpg";
  if (/^(data:|https?:\/\/)/i.test(u)) return u; // absolute / data URL
  if (u.startsWith("/uploads")) return `${API_BASE}${u}`; // backend static
  return u; // อื่น ๆ (เช่นไฟล์ใน public)
}

/* ===== FE scoring (ชั่วคราว) ===== */
const scoreLang = (lvl) => ({ A1: 4, A2: 8, B1: 12, B2: 16, C1: 18, C2: 20 }[lvl] ?? 0);
const CEPT_LEVEL_TO_PCT = { A1: 30, A2: 45, B1: 60, B2: 75, C1: 90, C2: 100 };

/**
 * เทคโนโลยี (เต็ม 20)
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
    Number.isFinite(ictPct) ? Math.max(0, Math.min(100, ictPct)) : 0,
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

  // ====== Edit Profile (Modal) ======
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    full_name: "",
    email: "",
    phone: "",
    line_id: "",
    facebook: "",
    github: "",
    avatar_url: "",
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const fileRef = useRef(null);

  const acct = profile?.account;

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
        setAcademic(a2 && (a2.score_academic ?? 0) > (a1?.score_academic ?? 0) ? a2 : a1);

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

  // เคลียร์ blob URL เวลาเปลี่ยนไฟล์/ปิดโมดัล
  useEffect(() => () => {
    if (preview && preview.startsWith("blob:")) {
      try { URL.revokeObjectURL(preview); } catch {}
    }
  }, [preview]);

  // ===== ค่าคะแนน "ดิบ" (สำหรับ chip ใต้กราฟ) =====
  const raw = useMemo(() => {
    const acad = academic?.score_academic ?? 0; // /40
    const lang = scoreLang(langLatest?.level); // /20
    const ictPct = Number(langAll?.ICT?.score_raw ?? 0); // %
    const itpePct = Number(langAll?.ITPE?.score_raw ?? 0); // %
    const ceptObj = langAll?.CEPT ?? null; // raw 0..50 หรือ level
    const tech = scoreTech(trains.length, ictPct, itpePct, ceptObj); // /20

    const socH = socialActs.reduce((s, a) => s + (Number(a.hours) || 0), 0);
    const comH = commActs.reduce((s, a) => s + (Number(a.hours) || 0), 0);
    const social = socH ? scoreFromHours(socH, 10) : scoreFromHours(socialActs.length, 10); // /10
    const comm = comH ? scoreFromHours(comH, 10) : scoreFromHours(commActs.length, 10); // /10

    return { acad, lang, tech, social, comm };
  }, [academic, langLatest, langAll, trains.length, socialActs, commActs]);

  // ===== ค่า % สำหรับเรดาร์ =====
  const radarDisp = useMemo(() => {
    const asPct = (val, max) => Math.round((Math.max(0, Math.min(val, max)) / max) * 100);
    const valuesPct = [asPct(raw.acad, 40), asPct(raw.lang, 20), asPct(raw.tech, 20), asPct(raw.social, 10), asPct(raw.comm, 10)];
    return { labels: ["วิชาการ", "ภาษา", "เทคโนโลยี", "สังคม", "สื่อสาร"], values: valuesPct, max: [100, 100, 100, 100, 100] };
  }, [raw]);

  // ===== เปิด Modal แก้ไขโปรไฟล์ =====
  const openEdit = async () => {
    setEditErr(""); setFile(null); setPreview("");
    try {
      const acc = await getAccountById(user.id);
      const first_name = acc?.first_name || "";
      const last_name = acc?.last_name || "";
      const full_name = acc?.full_name || `${first_name} ${last_name}`.trim();
      const form = { first_name, last_name, full_name, email: acc?.email || "", phone: acc?.phone || "", line_id: acc?.line_id || "", facebook: acc?.facebook || "", github: acc?.github || "", avatar_url: acc?.avatar_url || "" };
      setEditForm(form);
      setPreview(resolveAvatarUrl(form.avatar_url || ""));
      setEditOpen(true);
    } catch (e) {
      setEditErr(e?.message || "โหลดโปรไฟล์ไม่สำเร็จ");
      setEditOpen(true);
    }
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const onSaveEdit = async (e) => {
    e.preventDefault();
    setEditSaving(true); setEditErr("");
    try {
      let avatarUrl = editForm.avatar_url || "";
      if (file) {
        const up = await uploadAvatar(user.id, file); // backend ควรคืน {url:"/uploads/xxx.jpg"}
        if (up?.url) avatarUrl = up.url;
      }
      const payload = {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        full_name: editForm.full_name?.trim() || `${editForm.first_name} ${editForm.last_name}`.trim(),
        email: editForm.email,
        phone: editForm.phone,
        line_id: editForm.line_id,
        facebook: editForm.facebook,
        github: editForm.github,
        avatar_url: avatarUrl,
      };
      await updateAccount(user.id, payload);

      // อัปเดตหน้าให้เห็นผลทันที
      setProfile((p) => ({ ...p, account: { ...(p?.account || {}), ...payload, username: p?.account?.username, year_level: p?.account?.year_level, manual_gpa: p?.account?.manual_gpa, major_id: p?.account?.major_id } }));

      setPreview(resolveAvatarUrl(avatarUrl));
      alert("บันทึกโปรไฟล์สำเร็จ");
      setEditOpen(false);
    } catch (e2) {
      setEditErr(e2?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setEditSaving(false);
    }
  };

  const avatar = resolveAvatarUrl(acct?.avatar_url);

  return (
    <div className="min-vh-100 position-relative overflow-hidden bg-animated">
      {/* Decorative background blobs */}
      <div className="bg-blob bg-blob-1" aria-hidden="true" />
      <div className="bg-blob bg-blob-2" aria-hidden="true" />
      <div className="bg-blob bg-blob-3" aria-hidden="true" />

      {/* Top Bar — glassy */}
      <div className="d-flex align-items-center px-3 topbar glassy" style={{ height: 72 }}>
        <img src="/src/assets/csit.jpg" alt="Logo" className="rounded-3 me-3 shadow-sm" style={{ width: 40, height: 40, objectFit: "cover" }} />
        <div className="text-white fw-semibold">CSIT Competency System</div>
        <div className="ms-auto d-flex align-items-center gap-2">
          <span className="text-white-50 d-none d-md-inline">{user?.username} {user?.full_name || user?.fullName || ""}</span>
          <button className="btn btn-light btn-sm rounded-pill ripple" onClick={() => navigate("/login")}>ออกจากระบบ</button>
        </div>
      </div>

      <div className="container-xxl py-4 position-relative" style={{ zIndex: 1 }}>
        {/* Toolbar ใต้หัวเรื่อง */}
        <div className="card border-0 shadow-sm rounded-4 mb-3 card-float glassy">
          <div className="card-body d-flex flex-wrap gap-2 align-items-center">
            <button className="btn btn-outline-secondary rounded-pill ripple" onClick={() => navigate(-1)}>← ย้อนกลับ</button>
            <h4 className="mb-0 ms-1">ข้อมูลสมรรถนะ / โปรไฟล์</h4>
            <div className="ms-auto">
              <button className="btn btn-primary rounded-pill ripple" onClick={openEdit}>แก้ไขโปรไฟล์</button>
            </div>
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
              <div className="card shadow-sm border-0 rounded-4 glassy">
                <div className="card-body">
                  <div className="d-flex align-items-start gap-3">
                    <div className="position-relative">
                      <img src={avatar} alt="avatar" className="rounded-4 shadow-sm" style={{ width: 84, height: 84, objectFit: "cover" }} onError={(e) => (e.currentTarget.src = "/src/assets/csit.jpg")} />
                      <button type="button" className="btn btn-sm btn-light rounded-circle position-absolute bottom-0 end-0 ripple" title="เปลี่ยนรูป" onClick={() => document.getElementById('avatarInput')?.click()}>
                        <i className="bi bi-camera" />
                      </button>
                      <input id="avatarInput" type="file" accept="image/*" hidden onChange={(e) => { const f=e.target.files?.[0]; if(!f) return; setFile(f); setPreview(URL.createObjectURL(f)); setEditOpen(true); }} />
                    </div>
                    <div>
                      <div className="h5 mb-1">{acct?.full_name || "-"}</div>
                      <div className="text-muted small">{acct?.username}</div>
                      <div className="text-muted small">ชั้นปี: <b>{acct?.year_level ?? "-"}</b></div>
                      {(acct?.email || acct?.phone || acct?.line_id || acct?.facebook || acct?.github) && (
                        <div className="mt-2 small">
                          {acct?.email && <div>📧 {acct.email}</div>}
                          {acct?.phone && <div>📞 {acct.phone}</div>}
                          {acct?.line_id && <div>💬 Line: {acct.line_id}</div>}
                          {acct?.facebook && <div>📘 Facebook: {acct.facebook}</div>}
                          {acct?.github && <div>🐙 GitHub: {acct.github}</div>}
                        </div>
                      )}
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
                      <div className="d-flex flex-column gap-1">
                        <div>CEPT: <b>{langAll.CEPT?.score_raw != null ? `${langAll.CEPT.score_raw}/50` : langAll.CEPT?.level ?? "-"}</b>{langAll.CEPT?.taken_at ? ` (${langAll.CEPT.taken_at})` : ""}</div>
                        <div>ICT : <b>{langAll.ICT?.score_raw ?? "-"}</b>{langAll.ICT?.taken_at ? ` (${langAll.ICT.taken_at})` : ""}</div>
                        <div>ITPE: <b>{langAll.ITPE?.score_raw ?? "-"}</b>{langAll.ITPE?.taken_at ? ` (${langAll.ITPE.taken_at})` : ""}</div>
                      </div>
                    </div>
                    <div className="col-12 mt-2">
                      <div className="small text-muted">เทคโนโลยี</div>
                      <div className="fs-6">อบรม/เวิร์กช็อป {trains.length}</div>
                    </div>
                  </div>

                  <div className="mt-2 small text-muted">กิจกรรม: สังคม {socialActs.length} รายการ · สื่อสาร {commActs.length} รายการ</div>
                </div>
              </div>

              {academic && (
                <div className="card shadow-sm border-0 rounded-4 mt-3 glassy">
                  <div className="card-body">
                    <div className="fw-semibold mb-1">สรุปด้านวิชาการ (เทอมที่คะแนนดีกว่า)</div>
                    <div className="small text-muted">GPA ใช้คำนวณ: <b>{academic.gpa_used ?? "-"}</b> · ผ่านวิชาบังคับ: <b>{academic.core_completion_pct}%</b></div>
                    <div className="mt-1">คะแนน GPA <b>{academic.score_gpa}/25</b> + วิชาบังคับ <b>{academic.score_core}/15</b> = <b>{academic.score_academic}/40</b></div>
                  </div>
                </div>
              )}
            </div>

            {/* ขวา: Radar */}
            <div className="col-12 col-lg-7">
              <div className="card shadow-sm border-0 rounded-4 h-100 glassy">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h5 className="mb-0">เรดาร์สมรรถนะ 5 ด้าน (ปรับเป็น % ต่อแกน)</h5>
                    <div className="text-muted small">0–100% ต่อแกน เพื่อความสมดุลในการมองเห็น</div>
                  </div>

                  <Radar5 labels={radarDisp.labels} values={radarDisp.values} maxValues={radarDisp.max} />

                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <span className="badge rounded-pill bg-light text-dark">วิชาการ {raw.acad}/40</span>
                    <span className="badge rounded-pill bg-light text-dark">ภาษา {raw.lang}/20</span>
                    <span className="badge rounded-pill bg-light text-dark">เทคโนโลยี {raw.tech}/20</span>
                    <span className="badge rounded-pill bg-light text-dark">สังคม {raw.social}/10</span>
                    <span className="badge rounded-pill bg-light text-dark">สื่อสาร {raw.comm}/10</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== Modal: แก้ไขโปรไฟล์ ===== */}
      {editOpen && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content rounded-4">
              <div className="modal-header border-0">
                <h5 className="modal-title">แก้ไขโปรไฟล์</h5>
                <button type="button" className="btn-close" onClick={() => setEditOpen(false)}></button>
              </div>
              <form onSubmit={onSaveEdit}>
                <div className="modal-body">
                  {editErr && <div className="alert alert-danger">{editErr}</div>}
                  <div className="row g-3">
                    <div className="col-12 col-md-4">
                      <div className="rounded-4 border" style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", background: "#f8f9fa" }}>
                        {preview ? (
                          <img src={preview} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => (e.currentTarget.src = "/src/assets/csit.jpg")} />
                        ) : (
                          <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted small">ไม่มีรูป</div>
                        )}
                      </div>
                      <label className="btn btn-outline-primary w-100 mt-2 rounded-pill ripple">
                        อัปโหลดรูป…
                        <input type="file" accept="image/*" hidden onChange={onPickFile} />
                      </label>
                    </div>
                    <div className="col-12 col-md-8">
                      <div className="row g-2">
                        <div className="col-12">
                          <div className="form-floating">
                            <input className="form-control rounded-3" id="full" placeholder="ชื่อ–นามสกุล (แสดงผล)" value={editForm.full_name} onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))} />
                            <label htmlFor="full">ชื่อ–นามสกุล (แสดงผล)</label>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-floating">
                            <input type="email" className="form-control rounded-3" id="email" placeholder="อีเมล" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} />
                            <label htmlFor="email">อีเมล</label>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-floating">
                            <input className="form-control rounded-3" id="phone" placeholder="เบอร์โทร" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} />
                            <label htmlFor="phone">เบอร์โทร</label>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="form-floating">
                            <input className="form-control rounded-3" id="line" placeholder="Line ID" value={editForm.line_id} onChange={(e) => setEditForm((p) => ({ ...p, line_id: e.target.value }))} />
                            <label htmlFor="line">Line ID</label>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="form-floating">
                            <input className="form-control rounded-3" id="fb" placeholder="Facebook" value={editForm.facebook} onChange={(e) => setEditForm((p) => ({ ...p, facebook: e.target.value }))} />
                            <label htmlFor="fb">Facebook</label>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="form-floating">
                            <input className="form-control rounded-3" id="gh" placeholder="GitHub" value={editForm.github} onChange={(e) => setEditForm((p) => ({ ...p, github: e.target.value }))} />
                            <label htmlFor="gh">GitHub</label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0">
                  <button type="button" className="btn btn-outline-secondary rounded-pill ripple" onClick={() => setEditOpen(false)}>ยกเลิก</button>
                  <button className="btn btn-primary rounded-pill ripple" type="submit" disabled={editSaving}>
                    {editSaving ? (<><span className="spinner-border spinner-border-sm me-2" />กำลังบันทึก…</>) : ("บันทึก")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bottom wave */}
      <svg className="wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,64L80,90.7C160,117,320,171,480,176C640,181,800,139,960,128C1120,117,1280,139,1360,149.3L1440,160L1440,0L1360,0C1280,0,1120,0,960,0C800,0,640,0,480,0C320,0,160,0,80,0L0,0Z" fill="#ffffff" fillOpacity="0.85"></path>
      </svg>

      {/* Local styles */}
      <style>{`
        /* Animated background & blobs */
        .bg-animated{background:radial-gradient(1200px 600px at 10% -10%, #efe7ff 15%, transparent 60%),radial-gradient(1000px 500px at 110% 10%, #e6f0ff 10%, transparent 55%),linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%);} 
        .glassy{backdrop-filter:blur(8px);} 
        .topbar{position:sticky;top:0;left:0;width:100%;background:linear-gradient(90deg, rgba(111,66,193,.9), rgba(142,92,255,.9));box-shadow:0 4px 16px rgba(111,66,193,.22);z-index:1040;border-bottom:1px solid rgba(255,255,255,.12);} 

        /* Floating card subtle motion */
        .card-float{animation:floatY 6s ease-in-out infinite;} 
        @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}

        /* Ripple */
        .ripple{position:relative;overflow:hidden;} 
        .ripple:after{content:"";position:absolute;inset:0;border-radius:inherit;opacity:0;background:radial-gradient(circle at var(--x,50%) var(--y,50%), rgba(255,255,255,.45), transparent 40%);transform:scale(.2);transition:transform .3s, opacity .45s;pointer-events:none;} 
        .ripple:active:after{opacity:1;transform:scale(1);transition:0s;} 
        .ripple{--x:50%;--y:50%;} 
        .ripple:focus-visible{outline:3px solid rgba(142,92,255,.45);outline-offset:2px;} 

        /* Background blobs */
        .bg-blob{position:absolute;filter:blur(60px);opacity:.55;z-index:0;} 
        .bg-blob-1{width:420px;height:420px;left:-120px;top:-80px;background:#d7c6ff;animation:drift1 18s ease-in-out infinite;} 
        .bg-blob-2{width:360px;height:360px;right:-120px;top:120px;background:#c6ddff;animation:drift2 22s ease-in-out infinite;} 
        .bg-blob-3{width:300px;height:300px;left:15%;bottom:-120px;background:#ffd9ec;animation:drift3 20s ease-in-out infinite;} 
        @keyframes drift1{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,10px)}} 
        @keyframes drift2{0%,100%{transform:translate(0,0)}50%{transform:translate(-16px,8px)}} 
        @keyframes drift3{0%,100%{transform:translate(0,0)}50%{transform:translate(12px,-12px)}} 

        /* Wave */
        .wave{position:fixed;left:0;right:0;bottom:-1px;width:100%;height:120px;}

        .form-control:focus,.form-select:focus{box-shadow:0 0 0 .2rem rgba(111,66,193,.12);border-color:#8e5cff;}
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
