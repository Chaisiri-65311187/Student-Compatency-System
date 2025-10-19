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
  peer, // ✅ ใช้ดึงคะแนนประเมินเพื่อน/ตนเอง
} from "../services/competencyApi";
import { getAccountById, updateAccount, uploadAvatar } from "../services/api";
import Radar5 from "../components/profile/Radar5";

// สูตรคำนวณรวมศูนย์
import {
  scoreAcademic,       // รวม GPA + Core → /40
  scoreLang,           // CEPT level → /20
  scoreTech,           // Tech → /20
  calcAllCompetencies, // คืน each.{acad,lang,tech,social,comm} และ totalEqual (ยังใช้ social อย่างเดียวในที่นี้)
  toArray,
} from "../utils/scoring";

/* ===== Helper: URL รูปจาก backend ===== */
const API_BASE = (import.meta.env?.VITE_API_BASE || "http://localhost:3000").replace(/\/+$/, "");
function resolveAvatarUrl(u) {
  if (!u) return "/src/assets/csit.jpg";
  if (/^(data:|https?:\/\/)/i.test(u)) return u;
  if (u.startsWith("/uploads")) return `${API_BASE}${u}`;
  return u;
}

export default function StudentProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // 🔄 กำหนด periodKey ปัจจุบัน เช่น 2025-1
  const periodKey = useMemo(() => {
    const d = new Date(); const y = d.getFullYear(); const m = d.getMonth() + 1;
    const sem = m <= 5 ? 1 : 2;
    return `${y}-${sem}`;
  }, []);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [academic, setAcademic] = useState(null); // ค่าเฉลี่ยทุกปีทุกเทอม (gpa25/core15)
  const [langLatest, setLangLatest] = useState(null);
  const [langAll, setLangAll] = useState({ CEPT: null, ICT: null, ITPE: null });
  const [trains, setTrains] = useState([]);
  const [socialActs, setSocialActs] = useState([]);

  // 🆕 ค่าทำงานร่วมกับผู้อื่น
  const [collab, setCollab] = useState({ peerAvg: 0, selfAvg: 0, peerCount: 0 });

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

        // ✅ รวมทุกปีทุกเทอม → เฉลี่ยคะแนนวิชาการ
        const yMax = prof?.account?.year_level || 4;
        const jobs = [];
        for (let y = 1; y <= yMax; y++) {
          for (let s = 1; s <= 2; s++) jobs.push(recalcAcademic(user.id, { year: y, sem: s }).catch(() => null));
        }
        const all = (await Promise.all(jobs)).filter(Boolean);

        let sumScore = 0, sumGpa = 0, sumCore = 0, n = 0;
        for (const r of all) {
          if (typeof r?.score_academic === "number") {
            sumScore += r.score_academic;
            sumGpa += (r.score_gpa ?? 0);
            sumCore += (r.score_core ?? 0);
            n++;
          }
        }
        const agg = n
          ? {
              score_academic: Number((sumScore / n).toFixed(2)),
              score_gpa: Number((sumGpa / n).toFixed(2)),   // /25
              score_core: Number((sumCore / n).toFixed(2)), // /15
              gpa_used: all.at(-1)?.gpa_used ?? null,
              core_completion_pct: all.at(-1)?.core_completion_pct ?? null,
            }
          : null;
        setAcademic(agg);

        const [lang, allLang] = await Promise.all([
          getLatestLanguage(user.id),
          getLatestLanguagesAll(user.id),
        ]);
        setLangLatest(lang?.latest || null);
        setLangAll(allLang || { CEPT: null, ICT: null, ITPE: null });

        const [t, s] = await Promise.all([
          listTrainings(user.id),
          listActivities(user.id, "social"),
        ]);
        setTrains(toArray(t));
        setSocialActs(toArray(s));

        // 🆕 ดึงผลประเมินเพื่อน/ตนเอง (ถ้ามี endpoint)
        try {
          const rec = await peer.received(user.id, periodKey);
          const peerAvg = Number(rec?.avg ?? rec?.summary?.peer_avg ?? 0) || 0;
          const peerCount = Number(rec?.count ?? rec?.summary?.peer_count ?? 0) || 0;

          let selfAvg = 0;
          try {
            const self = await (peer.self ? peer.self(user.id, periodKey) : peer.given(user.id, periodKey));
            selfAvg = Number(self?.avg ?? self?.summary?.self_avg ?? 0) || 0;
          } catch { /* ignore */ }

          setCollab({ peerAvg, selfAvg, peerCount });
        } catch {
          setCollab({ peerAvg: 0, selfAvg: 0, peerCount: 0 });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, periodKey]);

  // เคลียร์ blob URL เวลาเปลี่ยนไฟล์/ปิดโมดัล
  useEffect(() => () => {
    if (preview && preview.startsWith("blob:")) {
      try { URL.revokeObjectURL(preview); } catch { }
    }
  }, [preview]);

  // ===== รวมคะแนน (ปรับแกนที่ 5 เป็น Collaboration: Peer 80% + Self 20%) =====
  const calc = useMemo(() => {
    // Academic
    const acadObj = scoreAcademic({
      manualGpa: Number(acct?.manual_gpa),
      scoreGpa25: Number(academic?.score_gpa ?? 0),   // /25
      scoreCore15: Number(academic?.score_core ?? 0), // /15
    });
    const acadScore = acadObj.score; // /40

    // Language & Technology
    const langScore = scoreLang(langLatest?.level)?.score ?? 0; // /20
    const ictPct = Number(langAll?.ICT?.score_raw ?? 0);
    const itpePct = Number(langAll?.ITPE?.score_raw ?? 0);
    const ceptObj = langAll?.CEPT ?? null;
    const techScore = scoreTech(trains.length, ictPct, itpePct, ceptObj)?.score ?? 0; // /20

    // เอา social เข้า calc เดิม (จะได้ pAcad/pLang/pTech/pSocial)
    const base = calcAllCompetencies({
      acadScore, langScore, techScore,
      socialActs,
      commActs: [], // ไม่ใช้ communication แล้ว
    });

    const pAcad = base.each.acad ?? 0;
    const pLang = base.each.lang ?? 0;
    const pTech = base.each.tech ?? 0;
    const pSoc  = base.each.social ?? 0;

    // 🧩 Collaboration % (peer 80% + self 20%)
    const collabPct = Math.round(0.8 * (collab.peerAvg || 0) + 0.2 * (collab.selfAvg || 0));

    // รวมคะแนนถ่วงเท่ากัน 5 แกน
    const total5 = Math.round((pAcad + pLang + pTech + pSoc + collabPct) / 5);

    return {
      each: { acad: pAcad, lang: pLang, tech: pTech, social: pSoc, collab: collabPct },
      total: total5,
    };
  }, [academic, langLatest, langAll, trains.length, socialActs, acct?.manual_gpa, collab.peerAvg, collab.selfAvg]);

  /* ===== ฟังก์ชันแก้ไขโปรไฟล์ (ปุ่ม/โมดัล) ===== */
  const openEdit = async () => {
    setEditErr(""); setFile(null);
    if (preview && preview.startsWith("blob:")) { try { URL.revokeObjectURL(preview); } catch { } setPreview(""); }
    try {
      const acc = await getAccountById(user.id);
      const first_name = acc?.first_name || "";
      const last_name = acc?.last_name || "";
      const full_name = acc?.full_name || `${first_name} ${last_name}`.trim();
      const form = {
        first_name, last_name, full_name,
        email: acc?.email || "", phone: acc?.phone || "",
        line_id: acc?.line_id || "", facebook: acc?.facebook || "",
        github: acc?.github || "", avatar_url: acc?.avatar_url || "",
      };
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
    if (preview && preview.startsWith("blob:")) { try { URL.revokeObjectURL(preview); } catch { } }
    setPreview(URL.createObjectURL(f));
    setEditOpen(true);
  };

  const onSaveEdit = async (e) => {
    e.preventDefault();
    setEditSaving(true); setEditErr("");
    try {
      let avatarUrl = editForm.avatar_url || "";
      if (file) {
        const up = await uploadAvatar(user.id, file); // backend -> { url: "/uploads/xxx.jpg" }
        if (up?.url) avatarUrl = up.url;
      }
      const payload = {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        full_name: (editForm.full_name ?? "").trim() || `${editForm.first_name} ${editForm.last_name}`.trim(),
        email: editForm.email,
        phone: editForm.phone,
        line_id: editForm.line_id,
        facebook: editForm.facebook,
        github: editForm.github,
        avatar_url: avatarUrl,
      };
      await updateAccount(user.id, payload);
      // อัปเดตหน้าทันที
      setProfile((p) => ({
        ...p,
        account: {
          ...(p?.account || {}),
          ...payload,
          username: p?.account?.username,
          year_level: p?.account?.year_level,
          manual_gpa: p?.account?.manual_gpa,
          major_id: p?.account?.major_id,
        },
      }));
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
        {/* Toolbar */}
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
            {/* ซ้าย: โปรไฟล์ + สรุป */}
            <div className="col-12 col-lg-5">
              <div className="card shadow-sm border-0 rounded-4 glassy">
                <div className="card-body">
                  <div className="d-flex align-items-start gap-3">
                    <div className="position-relative">
                      <img
                        src={avatar}
                        alt="avatar"
                        className="rounded-4 shadow-sm"
                        style={{ width: 84, height: 84, objectFit: "cover" }}
                        onError={(e) => (e.currentTarget.src = "/src/assets/csit.jpg")}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-light rounded-circle position-absolute bottom-0 end-0 ripple"
                        title="เปลี่ยนรูป"
                        onClick={() => document.getElementById('avatarInput')?.click()}
                      >
                        <i className="bi bi-camera" />
                      </button>
                      <input id="avatarInput" type="file" accept="image/*" hidden onChange={onPickFile} />
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

                  {/* 🆕 บล็อกสรุป Collaboration */}
                  <div className="mt-3 small">
                    <div className="text-muted">ทำงานร่วมกับผู้อื่น (รอบ {periodKey})</div>
                    <div>Peer Avg: <b>{Math.round(collab.peerAvg)}</b> / 100 {collab.peerCount ? `(${collab.peerCount} คนประเมิน)` : ""}</div>
                    <div>Self Avg: <b>{Math.round(collab.selfAvg)}</b> / 100</div>
                  </div>

                  <div className="mt-2 small text-muted">กิจกรรมสังคม {socialActs.length} รายการ</div>
                </div>
              </div>
            </div>

            {/* ขวา: Radar */}
            <div className="col-12 col-lg-7">
              <div className="card shadow-sm border-0 rounded-4 h-100 glassy">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h5 className="mb-0">เรดาร์สมรรถนะ 5 ด้าน</h5>
                    <div className="badge text-bg-primary rounded-pill">
                      คะแนนรวม : {calc?.total ?? 0}/100
                    </div>
                  </div>

                  <Radar5
                    labels={["วิชาการ", "ภาษา", "เทคโนโลยี", "สังคม", "ทำงานร่วมกับผู้อื่น"]}
                    values={[
                      calc?.each?.acad ?? 0,
                      calc?.each?.lang ?? 0,
                      calc?.each?.tech ?? 0,
                      calc?.each?.social ?? 0,
                      calc?.each?.collab ?? 0
                    ]}
                    maxValues={[100, 100, 100, 100, 100]}
                    baseColor="#6f42c1"
                    theme="light"
                    height={440}
                  />

                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <span className="badge rounded-pill bg-light text-dark">วิชาการ {calc?.each?.acad ?? 0}/100</span>
                    <span className="badge rounded-pill bg-light text-dark">ภาษา {calc?.each?.lang ?? 0}/100</span>
                    <span className="badge rounded-pill bg-light text-dark">เทคโนโลยี {calc?.each?.tech ?? 0}/100</span>
                    <span className="badge rounded-pill bg-light text-dark">สังคม {calc?.each?.social ?? 0}/100</span>
                    <span className="badge rounded-pill bg-light text-dark">ทำงานร่วมกับผู้อื่น {calc?.each?.collab ?? 0}/100</span>
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
                <button type="button" className="btn-close" onClick={() => setEditOpen(false)} />
              </div>

              <form onSubmit={onSaveEdit}>
                <div className="modal-body">
                  {editErr && <div className="alert alert-danger">{editErr}</div>}

                  <div className="row g-3">
                    <div className="col-12 col-md-4">
                      <div className="rounded-4 border" style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", background: "#f8f9fa" }}>
                        {preview ? (
                          <img
                            src={preview}
                            alt="avatar"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e) => (e.currentTarget.src = "/src/assets/csit.jpg")}
                          />
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
                            <input
                              className="form-control rounded-3"
                              id="full"
                              placeholder="ชื่อ–นามสกุล (แสดงผล)"
                              value={editForm.full_name}
                              onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                            />
                            <label htmlFor="full">ชื่อ–นามสกุล (แสดงผล)</label>
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className="form-floating">
                            <input
                              type="email"
                              className="form-control rounded-3"
                              id="email"
                              placeholder="อีเมล"
                              value={editForm.email}
                              onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                            />
                            <label htmlFor="email">อีเมล</label>
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className="form-floating">
                            <input
                              className="form-control rounded-3"
                              id="phone"
                              placeholder="เบอร์โทร"
                              value={editForm.phone}
                              onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                            />
                            <label htmlFor="phone">เบอร์โทร</label>
                          </div>
                        </div>

                        <div className="col-md-4">
                          <div className="form-floating">
                            <input
                              className="form-control rounded-3"
                              id="line"
                              placeholder="Line ID"
                              value={editForm.line_id}
                              onChange={(e) => setEditForm((p) => ({ ...p, line_id: e.target.value }))}
                            />
                            <label htmlFor="line">Line ID</label>
                          </div>
                        </div>

                        <div className="col-md-4">
                          <div className="form-floating">
                            <input
                              className="form-control rounded-3"
                              id="fb"
                              placeholder="Facebook"
                              value={editForm.facebook}
                              onChange={(e) => setEditForm((p) => ({ ...p, facebook: e.target.value }))}
                            />
                            <label htmlFor="fb">Facebook</label>
                          </div>
                        </div>

                        <div className="col-md-4">
                          <div className="form-floating">
                            <input
                              className="form-control rounded-3"
                              id="gh"
                              placeholder="GitHub"
                              value={editForm.github}
                              onChange={(e) => setEditForm((p) => ({ ...p, github: e.target.value }))}
                            />
                            <label htmlFor="gh">GitHub</label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-0">
                  <button type="button" className="btn btn-outline-secondary rounded-pill ripple" onClick={() => setEditOpen(false)}>
                    ยกเลิก
                  </button>
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
        .bg-animated{background:radial-gradient(1200px 600px at 10% -10%, #efe7ff 15%, transparent 60%),radial-gradient(1000px 500px at 110% 10%, #e6f0ff 10%, transparent 55%),linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%);} 
        .glassy{backdrop-filter:blur(8px);} 
        .topbar{position:sticky;top:0;left:0;width:100%;background:linear-gradient(90deg, rgba(111,66,193,.9), rgba(142,92,255,.9));box-shadow:0 4px 16px rgba(111,66,193,.22);z-index:1040;border-bottom:1px solid rgba(255,255,255,.12);} 
        .card-float{animation:floatY 6s ease-in-out infinite;} 
        @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        .ripple{position:relative;overflow:hidden;} 
        .ripple:after{content:"";position:absolute;inset:0;border-radius:inherit;opacity:0;background:radial-gradient(circle at var(--x,50%) var(--y,50%), rgba(255,255,255,.45), transparent 40%);transform:scale(.2);transition:transform .3s, opacity .45s;pointer-events:none;} 
        .ripple:active:after{opacity:1;transform:scale(1);transition:0s;} 
        .ripple{--x:50%;--y:50%;} 
        .ripple:focus-visible{outline:3px solid rgba(142,92,255,.45);outline-offset:2px;} 
        .bg-blob{position:absolute;filter:blur(60px);opacity:.55;z-index:0;} 
        .bg-blob-1{width:420px;height:420px;left:-120px;top:-80px;background:#d7c6ff;animation:drift1 18s ease-in-out infinite;} 
        .bg-blob-2{width:360px;height:360px;right:-120px;top:120px;background:#c6ddff;animation:drift2 22s ease-in-out infinite;} 
        .bg-blob-3{width:300px;height:300px;left:15%;bottom:-120px;background:#ffd9ec;animation:drift3 20s ease-in-out infinite;} 
        @keyframes drift1{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,10px)}} 
        @keyframes drift2{0%,100%{transform:translate(0,0)}50%{transform:translate(-16px,8px)}} 
        @keyframes drift3{0%,100%{transform:translate(0,0)}50%{transform:translate(12px,-12px)}} 
        .wave{position:fixed;left:0;right:0;bottom:-1px;width:100%;height:120px;}
        .form-control:focus,.form-select:focus{box-shadow:0 0 0 .2rem rgba(111,66,193,.12);border-color:#8e5cff;}
      `}</style>

      {/* ripple position */}
      <script dangerouslySetInnerHTML={{
        __html: `
        document.addEventListener('pointerdown', (e) => {
          const el = e.target.closest('.ripple');
          if (!el) return;
          const rect = el.getBoundingClientRect();
          el.style.setProperty('--x', ((e.clientX - rect.left) / rect.width) * 100 + '%');
          el.style.setProperty('--y', ((e.clientY - rect.top) / rect.height) * 100 + '%');
        }, { passive: true });
      `}} />
    </div>
  );
}
