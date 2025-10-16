// src/components/StudentInfoPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { getUsers, listMajors } from "../services/api";
import {
  getCompetencyProfile,
  getLatestLanguagesAll,
  listTrainings,
  listActivities,
  recalcAcademic,
} from "../services/competencyApi";
import Radar5 from "../components/profile/Radar5";

const PURPLE = "#6f42c1";

/* ===== Scoring helpers ===== */
const scoreLang = (lvl) => ({ A1: 4, A2: 8, B1: 12, B2: 16, C1: 18, C2: 20 }[lvl] ?? 0);
const CEPT_LEVEL_TO_PCT = { A1: 30, A2: 45, B1: 60, B2: 75, C1: 90, C2: 100 };
const scoreTech = (trainCount, ictPct, itpePct, ceptObj) => {
  let ceptPct = 0;
  if (ceptObj?.score_raw != null) {
    const raw = Math.max(0, Math.min(50, Number(ceptObj.score_raw)));
    ceptPct = (raw / 50) * 100;
  } else if (ceptObj?.level) ceptPct = CEPT_LEVEL_TO_PCT[ceptObj.level] || 0;
  const ict = Number.isFinite(ictPct) ? Math.max(0, Math.min(100, ictPct)) : 0;
  const itpe = Number.isFinite(itpePct) ? Math.max(0, Math.min(100, itpePct)) : 0;
  const bestPct = Math.max(ict, itpe, ceptPct);
  const examPts = (bestPct / 100) * 19;
  let passBonus = 0;
  if (ict >= 50) passBonus += 0.5;
  if (itpe >= 60) passBonus += 0.5;
  else if (itpe >= 55) passBonus += 0.25;
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
const toArray = (v) => (Array.isArray(v) ? v : v?.items ?? []);

/* ====== URL helper & default avatar ====== */
const API_BASE = (import.meta.env?.VITE_API_BASE || "http://localhost:3000").replace(/\/+$/, "");
const DEFAULT_AVATAR = "/src/assets/csit.jpg";
const absUrl = (u) => {
  if (!u) return DEFAULT_AVATAR;
  if (/^https?:\/\//i.test(u)) return u;
  const path = u.startsWith("/") ? u : `/${u}`;
  return `${API_BASE}${path}`;
};

/* ปุ่มชิป */
const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`btn btn-sm me-2 mb-2 ${active ? "btn-primary" : "btn-outline-secondary"} ripple`}
    style={{ borderRadius: 999 }}
  >
    {children}
  </button>
);

export default function StudentInfoPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (user.role !== "teacher") navigate("/home");
  }, [user, navigate]);

  const [loading, setLoading] = useState(true);
  const [majors, setMajors] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [enrich, setEnrich] = useState({});
  const [error, setError] = useState("");
  const [filterDept, setFilterDept] = useState({ cs: false, it: false });
  const [filterYear, setFilterYear] = useState({ year1: false, year2: false, year3: false, year4: false });
  const [search, setSearch] = useState("");

  const toggleDept = (k) => setFilterDept((p) => ({ ...p, [k]: !p[k] }));
  const toggleYear = (k) => setFilterYear((p) => ({ ...p, [k]: !p[k] }));

  // โหลดรายชื่อ + enrich สรุป
  useEffect(() => {
    const run = async () => {
      if (!user?.role || user.role !== "teacher") return;
      setLoading(true);
      setError("");
      try {
        const m = await listMajors();
        setMajors(m || []);
        // students (paginate)
        const LIMIT = 50;
        let page = 1;
        let all = [];
        while (true) {
          const res = await getUsers({ role: "student", page, limit: LIMIT });
          const rows = res?.rows || [];
          all = all.concat(rows);
          const total = res?.total || 0;
          const totalPages = Math.max(1, Math.ceil(total / LIMIT));
          if (page >= totalPages || rows.length === 0) break;
          page += 1;
        }
        setAccounts(all);

        // enrich: ดึงโปรไฟล์มาเก็บทั้งคะแนน + ช่องทางติดต่อ + avatar_url
        const ids = all.map((u) => u.id);
        const CHUNK = 25;
        const map = {};
        for (let i = 0; i < ids.length; i += CHUNK) {
          const chunk = ids.slice(i, i + CHUNK);
          const results = await Promise.allSettled(chunk.map((id) => getCompetencyProfile(id)));
          results.forEach((r, idx) => {
            const id = chunk[idx];
            if (r.status === "fulfilled" && r.value?.account) {
              const acct = r.value.account;
              map[id] = {
                manual_gpa: acct.manual_gpa ?? null,
                year_level: acct.year_level ?? null,
                computed_gpa: r.value.computed_gpa ?? null,
                core_completion_pct: r.value.core_completion_pct ?? null,
                score_academic: r.value.score_academic ?? null,
                // ช่องทางติดต่อ + avatar
                email: acct.email ?? "",
                phone: acct.phone ?? "",
                line_id: acct.line_id ?? "",
                facebook: acct.facebook ?? "",
                github: acct.github ?? "",
                avatar_url: acct.avatar_url ?? "",
              };
            } else {
              map[id] = {
                manual_gpa: null, year_level: null, computed_gpa: null,
                core_completion_pct: null, score_academic: null,
                email: "", phone: "", line_id: "", facebook: "", github: "",
                avatar_url: "",
              };
            }
          });
        }
        setEnrich(map);
      } catch (e) {
        console.error(e);
        setError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user?.role]);

  const majorNameById = useMemo(() => {
    const m = {};
    (majors || []).forEach((x) => (m[x.id] = x.name || x.name_th || x.name_en || ""));
    return m;
  }, [majors]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return (accounts || []).filter((acc) => {
      const depName = majorNameById[acc.major_id] || "";
      const depOK =
        (!filterDept.cs && !filterDept.it) ||
        (filterDept.cs && depName === "วิทยาการคอมพิวเตอร์") ||
        (filterDept.it && depName === "เทคโนโลยีสารสนเทศ");
      const yearValue = enrich[acc.id]?.year_level ?? acc.year_level;
      const yearOK =
        (!filterYear.year1 && !filterYear.year2 && !filterYear.year3 && !filterYear.year4) ||
        (filterYear.year1 && yearValue === 1) ||
        (filterYear.year2 && yearValue === 2) ||
        (filterYear.year3 && yearValue === 3) ||
        (filterYear.year4 && yearValue === 4);
      const kwOK =
        !kw ||
        String(acc.username || "").toLowerCase().includes(kw) ||
        String(acc.full_name || "").toLowerCase().includes(kw);
      return depOK && yearOK && kwOK;
    });
  }, [accounts, majorNameById, filterDept, filterYear, search, enrich]);

  /* ======================= Modal ======================= */
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAccount, setDetailAccount] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState({
    profile: null,
    languages: null,
    trainings: [],
    activities: { social: [], communication: [] },
    radar: null,
    calc: null,
  });
  const modalRef = useRef(null);

  const buildCalc = ({ profile, languages, trainings, activities }) => {
    const acad = profile?.score_academic ?? 0;
    const cept = languages?.CEPT ?? null;
    const lang = scoreLang(cept?.level);
    const trainsArr = toArray(trainings);
    const ictPct = Number(languages?.ICT?.score_raw ?? 0);
    const itpePct = Number(languages?.ITPE?.score_raw ?? 0);
    const tech = scoreTech(trainsArr.length, ictPct, itpePct, cept);
    const socialArr = toArray(activities?.social);
    const commArr = toArray(activities?.communication);
    const socialH = socialArr.reduce((s, a) => s + (Number(a.hours) || 0), 0);
    const commH = commArr.reduce((s, a) => s + (Number(a.hours) || 0), 0);
    const social = socialH ? scoreFromHours(socialH, 10) : scoreFromHours(socialArr.length, 10);
    const comm = commH ? scoreFromHours(commH, 10) : scoreFromHours(commArr.length, 10);
    const raw = { acad, lang, tech, social, comm };
    const total = Math.round((acad + lang + tech + social + comm) * 100) / 100;
    const toPct = (v, max) => Math.round((Math.max(0, Math.min(v, max)) / max) * 100);
    const radar = {
      labels: ["วิชาการ", "ภาษา", "เทคโนโลยี", "สังคม", "สื่อสาร"],
      values: [toPct(acad, 40), toPct(lang, 20), toPct(tech, 20), toPct(social, 10), toPct(comm, 10)],
      raw,
    };
    const explain = [
      `วิชาการ ${acad}/40`,
      `ภาษา ${lang}/20`,
      `เทคโนโลยี ${tech}/20`,
      `สังคม ${social}/10`,
      `สื่อสาร ${comm}/10`,
    ];
    return { radar, calc: { raw, total, explain } };
  };

  const openDetail = async (acc) => {
    setDetailAccount(acc);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const [profileRaw, languages, trainings, social, comm] = await Promise.all([
        getCompetencyProfile(acc.id),
        getLatestLanguagesAll(acc.id).catch(() => ({})),
        listTrainings(acc.id).catch(() => ({ items: [] })),
        listActivities(acc.id, "social").catch(() => ({ items: [] })),
        listActivities(acc.id, "communication").catch(() => ({ items: [] })),
      ]);
      const y = profileRaw?.account?.year_level || 4;
      const [a1, a2] = await Promise.all([
        recalcAcademic(acc.id, { year: y, sem: 1 }).catch(() => null),
        recalcAcademic(acc.id, { year: y, sem: 2 }).catch(() => null),
      ]);
      const bestAcad =
        a1 && a2
          ? (Number(a2?.score_academic || 0) >= Number(a1?.score_academic || 0) ? a2 : a1)
          : (a2 || a1 || null);

      const profile = {
        ...profileRaw,
        score_academic: bestAcad?.score_academic ?? profileRaw?.score_academic ?? 0,
        core_completion_pct: bestAcad?.core_completion_pct ?? profileRaw?.core_completion_pct ?? null,
        gpa_used: bestAcad?.gpa_used ?? profileRaw?.gpa_used ?? null,
      };

      const { radar, calc } = buildCalc({
        profile,
        languages,
        trainings,
        activities: { social, communication: comm },
      });

      setDetail({
        profile,
        languages,
        trainings,
        activities: { social, communication: comm },
        radar,
        calc,
      });
    } catch (e) {
      console.error(e);
      setDetail((d) => ({ ...d, radar: null, calc: null }));
    } finally {
      setDetailLoading(false);
      setTimeout(() => modalRef.current?.querySelector?.("button.btn-close")?.focus?.(), 50);
    }
  };

  if (!user || user.role !== "teacher") return null;

  return (
    <div className="min-vh-100 position-relative bg-animated">
      {/* Blobs background */}
      <div className="bg-blob bg-blob-1" aria-hidden="true" />
      <div className="bg-blob bg-blob-2" aria-hidden="true" />
      <div className="bg-blob bg-blob-3" aria-hidden="true" />

      {/* Top Bar */}
      <div className="hero-bar topbar glassy" style={{ height: 72 }}>
        <div className="container-xxl d-flex align-items-center h-100">
        <div className="d-flex align-items-center">
            <img src="/src/assets/csit.jpg" alt="Logo" className="rounded-3 shadow-sm" style={{ height: 40, width: 40, objectFit: "cover" }} />
            <div className="ms-3 text-white fw-semibold">CSIT Competency System</div>
          </div>
        <div className="ms-auto d-flex align-items-center">
          <span className="text-white-50 me-3">{user?.full_name || user?.username}</span>
          <button className="btn btn-light btn-sm rounded-pill ripple" onClick={() => { logout?.(); navigate("/login"); }}>
            ออกจากระบบ
          </button>
        </div>
      </div>
      </div>

      <div className="container-xxl py-4 position-relative" style={{ zIndex: 1 }}>
        <div className="row g-4">
          {/* Sidebar Filters */}
          <div className="col-12 col-xl-3">
            <div className="card border-0 shadow-sm rounded-4 glassy" style={{ position: "sticky", top: 96 }}>
              <div className="card-body">
                <div className="small text-uppercase text-muted fw-semibold mb-2">ตัวกรอง</div>
                <div className="mb-3">
                  <div className="small text-muted mb-1">ชั้นปี</div>
                  <Chip active={filterYear.year1} onClick={() => toggleYear("year1")}>ปี 1</Chip>
                  <Chip active={filterYear.year2} onClick={() => toggleYear("year2")}>ปี 2</Chip>
                  <Chip active={filterYear.year3} onClick={() => toggleYear("year3")}>ปี 3</Chip>
                  <Chip active={filterYear.year4} onClick={() => toggleYear("year4")}>ปี 4</Chip>
                </div>
                <div className="mb-2">
                  <div className="small text-muted mb-1">สาขา</div>
                  <Chip active={filterDept.cs} onClick={() => toggleDept("cs")}>วิทยาการคอมพิวเตอร์</Chip>
                  <Chip active={filterDept.it} onClick={() => toggleDept("it")}>เทคโนโลยีสารสนเทศ</Chip>
                </div>
                <div className="mt-2 small text-muted">ไม่เลือก = แสดงทั้งหมด</div>
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="col-12 col-xl-9">
            {/* Toolbar */}
            <div className="card border-0 shadow-sm rounded-4 mb-3 glassy">
              <div className="card-body d-flex flex-wrap gap-2 align-items-center">
                <h4 className="mb-0 me-auto">ข้อมูลสมรรถนะนิสิต</h4>
                <button className="btn btn-outline-primary rounded-pill ripple" onClick={() => navigate("/create-announcement")}> 
                  <i className="bi bi-megaphone-fill me-1" /> เพิ่มประกาศ
                </button>
                <button className="btn btn-outline-secondary rounded-pill ripple" onClick={() => navigate("/teacher-announcements")}>
                  <i className="bi bi-gear-fill me-1" /> จัดการประกาศ
                </button>
                <div className="position-relative ms-auto flex-grow-1 flex-md-grow-0" style={{ minWidth: 260 }}>
                  <i className="bi bi-search position-absolute" style={{ left: 12, top: 10, opacity: 0.5 }} />
                  <input
                    type="text"
                    className="form-control ps-5 rounded-pill"
                    placeholder="ค้นหา รหัสนิสิต / ชื่อ"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Results */}
            {loading ? (
              <div className="row g-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="col-md-6 col-lg-4">
                    <div className="card shadow-sm border-0 rounded-4 overflow-hidden glass-card">
                      <div className="ratio-21x9 placeholder-wave" />
                      <div className="card-body">
                        <div className="placeholder col-8 mb-2"></div>
                        <div className="placeholder col-5"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="alert alert-danger">{error}</div>
            ) : (
              <div className="text-muted small mb-2">พบ {filtered.length.toLocaleString("th-TH")} รายการ</div>
            )}

            {/* Cards */}
            <div className="row g-4">
              {filtered.map((acc) => {
                const depName = majorNameById[acc.major_id] || "";
                const bannerGrad =
                  depName === "วิทยาการคอมพิวเตอร์"
                    ? `linear-gradient(135deg,#ff7300ff, #adb5bd)`
                    : depName === "เทคโนโลยีสารสนเทศ"
                      ? "linear-gradient(135deg, #8a07e2ff, #adb5bd)"
                      : "linear-gradient(135deg, #6c757d, #adb5bd)";
                const manualGpa = enrich[acc.id]?.manual_gpa ?? "—";
                const yearLevel = enrich[acc.id]?.year_level ?? "—";
                const computedGpa = enrich[acc.id]?.computed_gpa ?? "—";
                const avatar = absUrl(enrich[acc.id]?.avatar_url);

                return (
                  <div key={acc.id} className="col-md-6 col-lg-4">
                    <div className="card shadow-sm border-0 rounded-4 overflow-hidden glass-card h-100">
                      <div className="ratio-21x9" style={{ background: bannerGrad, position: "relative" }}>
                        <span className="badge bg-light text-dark position-absolute bottom-0 start-0 m-2 year-pill">ชั้นปี {yearLevel}</span>
                        <span className="badge bg-dark-subtle text-dark position-absolute top-0 end-0 m-2">
                          {depName || "—"}
                        </span>
                      </div>
                      <div className="card-body d-flex flex-column">
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <img
                            src={avatar}
                            alt="avatar"
                            onError={(e)=>{e.currentTarget.src = DEFAULT_AVATAR;}}
                            className="rounded-circle"
                            style={{ width: 40, height: 40, objectFit: "cover" }}
                          />
                          <div>
                            <div className="fw-semibold text-truncate" title={acc.full_name}>{acc.full_name}</div>
                            <div className="text-muted small">{acc.username}</div>
                          </div>
                        </div>

                        <div className="row small mb-2">
                          <div className="col-6">
                            <div className="text-muted">GPA (กรอกเอง)</div>
                            <div className="fw-medium">{manualGpa}</div>
                          </div>
                          <div className="col-6">
                            <div className="text-muted">GPA (คำนวณ)</div>
                            <div className="fw-medium">{computedGpa}</div>
                          </div>
                        </div>

                        <div className="mt-auto">
                          <button className="btn btn-outline-primary w-100 rounded-pill ripple" onClick={() => openDetail(acc)}>
                            ดูรายละเอียด
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>

      {/* ============ Modal รายละเอียดนิสิต ============ */}
      {detailOpen && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.5)" }} role="dialog" aria-modal="true" ref={modalRef}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content rounded-4">
              <div className="modal-header border-0">
                <h5 className="modal-title">
                  รายละเอียดสมรรถนะ — {detailAccount?.full_name} ({detailAccount?.username})
                </h5>
                <button type="button" className="btn-close" onClick={() => setDetailOpen(false)} />
              </div>

              <div className="modal-body">
                {detailLoading ? (
                  <div className="text-muted small">
                    <span className="spinner-border spinner-border-sm me-2" />
                    กำลังโหลดรายละเอียด…
                  </div>
                ) : (
                  <>
                    {/* Header: Avatar + ช่องทางติดต่อ */}
                    <div className="d-flex align-items-start gap-3 mb-3">
                      <img
                        src={absUrl(detail?.profile?.account?.avatar_url)}
                        alt="avatar"
                        onError={(e)=>{e.currentTarget.src = DEFAULT_AVATAR;}}
                        className="rounded-4"
                        style={{ width: 80, height: 80, objectFit: "cover" }}
                      />
                      <div className="small">
                        {detail?.profile?.account?.email && <div>📧 {detail.profile.account.email}</div>}
                        {detail?.profile?.account?.phone && <div>📞 {detail.profile.account.phone}</div>}
                        {detail?.profile?.account?.line_id && <div>💬 Line: {detail.profile.account.line_id}</div>}
                        {detail?.profile?.account?.facebook && <div>📘 Facebook: {detail.profile.account.facebook}</div>}
                        {detail?.profile?.account?.github && <div>🐙 GitHub: {detail.profile.account.github}</div>}
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="row g-3 mb-3">
                      <div className="col-6 col-lg-3">
                        <div className="card border-0 shadow-sm rounded-4 h-100">
                          <div className="card-body">
                            <div className="text-muted small">GPA (กรอกเอง)</div>
                            <div className="fs-5 fw-semibold">{detail?.profile?.account?.manual_gpa ?? "—"}</div>
                          </div>
                        </div>
                      </div>
                      <div className="col-6 col-lg-3">
                        <div className="card border-0 shadow-sm rounded-4 h-100">
                          <div className="card-body">
                            <div className="text-muted small">GPA (คำนวณ)</div>
                            <div className="fs-5 fw-semibold">{detail?.profile?.computed_gpa ?? "—"}</div>
                          </div>
                        </div>
                      </div>
                      <div className="col-6 col-lg-3">
                        <div className="card border-0 shadow-sm rounded-4 h-100">
                          <div className="card-body">
                            <div className="text-muted small">ชั้นปี</div>
                            <div className="fs-5 fw-semibold">{detail?.profile?.account?.year_level ?? "—"}</div>
                          </div>
                        </div>
                      </div>
                      <div className="col-6 col-lg-3">
                        <div className="card border-0 shadow-sm rounded-4 h-100">
                          <div className="card-body">
                            <div className="text-muted small">วิชาบังคับสำเร็จ</div>
                            <div className="fs-5 fw-semibold">
                              {detail?.profile?.core_completion_pct != null
                                ? `${Number(detail.profile.core_completion_pct).toFixed(0)}%`
                                : "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Radar + ผลคำนวณ */}
                    {detail?.radar && detail?.calc && (
                      <div className="card border-0 shadow-sm rounded-4 mb-4">
                        <div className="card-body">
                          <div className="d-flex flex-wrap justify-content-between align-items-center">
                            <h6 className="fw-semibold mb-2">เรดาร์สมรรถนะ 5 ด้าน</h6>
                            <div className="badge text-bg-primary rounded-pill">คะแนนรวม: {detail.calc.total}/100</div>
                          </div>
                          <Radar5 labels={detail.radar.labels} values={detail.radar.values} maxValues={[100, 100, 100, 100, 100]} />
                          <div className="mt-3 small">{detail.calc.explain.join(" · ")}</div>
                        </div>
                      </div>
                    )}

                    {/* ภาษา / เทคโนโลยี / กิจกรรม */}
                    <div className="row g-3">
                      <div className="col-12 col-xl-6">
                        <div className="card border-0 shadow-sm rounded-4 h-100">
                          <div className="card-body">
                            <div className="fw-semibold mb-2">ภาษา</div>
                            {Array.isArray(detail.languages) ? (
                              detail.languages.length ? (
                                <ul className="list-group list-group-flush">
                                  {detail.languages.map((x, i) => (
                                    <li key={i} className="list-group-item px-0 d-flex justify-content-between">
                                      <span>{x.framework} — {x.level || x.score_raw || "—"}</span>
                                      <span className="text-muted small">{x.taken_at || ""}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : <div className="text-muted small">ยังไม่มีข้อมูลภาษา</div>
                            ) : (
                              <div className="text-muted small">
                                CEPT: {detail.languages?.CEPT?.level || detail.languages?.CEPT?.score_raw || "—"} {detail.languages?.CEPT?.taken_at ? `(${detail.languages.CEPT.taken_at})` : ""} ·{" "}
                                ICT: {detail.languages?.ICT?.score_raw || "—"} {detail.languages?.ICT?.taken_at ? `(${detail.languages.ICT.taken_at})` : ""} ·{" "}
                                ITPE: {detail.languages?.ITPE?.score_raw || "—"} {detail.languages?.ITPE?.taken_at ? `(${detail.languages.ITPE.taken_at})` : ""}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="col-12 col-xl-6">
                        <div className="card border-0 shadow-sm rounded-4 h-100">
                          <div className="card-body">
                            <div className="fw-semibold mb-2">เทคโนโลยี & อบรม</div>
                            {toArray(detail.trainings).length ? (
                              <ul className="list-group list-group-flush">
                                {toArray(detail.trainings).map((t) => (
                                  <li key={t.id} className="list-group-item px-0">
                                    {t.title} {t.hours ? `(${t.hours} ชม.)` : ""}
                                  </li>
                                ))}
                              </ul>
                            ) : <div className="text-muted small">ยังไม่มีข้อมูลการอบรม</div>}
                          </div>
                        </div>
                      </div>

                      <div className="col-12">
                        <div className="card border-0 shadow-sm rounded-4">
                          <div className="card-body">
                            <div className="fw-semibold mb-2">กิจกรรม</div>
                            <div className="row">
                              <div className="col-12 col-md-6">
                                <div className="text-muted small mb-1">สังคม (Social)</div>
                                {toArray(detail.activities.social).length ? (
                                  <ul className="list-group list-group-flush">
                                    {toArray(detail.activities.social).map((a) => (
                                      <li key={a.id} className="list-group-item px-0">
                                        {a.title} {a.hours ? `— ${a.hours} ชม.` : ""} {a.role ? `(${a.role})` : ""}
                                      </li>
                                    ))}
                                  </ul>
                                ) : <div className="text-muted small">ยังไม่มีกิจกรรมสังคม</div>}
                              </div>
                              <div className="col-12 col-md-6">
                                <div className="text-muted small mb-1">การสื่อสาร (Communication)</div>
                                {toArray(detail.activities.communication).length ? (
                                  <ul className="list-group list-group-flush">
                                    {toArray(detail.activities.communication).map((a) => (
                                      <li key={a.id} className="list-group-item px-0">
                                        {a.title} {a.hours ? `— ${a.hours} ชม.` : ""} {a.role ? `(${a.role})` : ""}
                                      </li>
                                    ))}
                                  </ul>
                                ) : <div className="text-muted small">ยังไม่มีกิจกรรมการสื่อสาร</div>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer border-0">
                <button className="btn btn-secondary rounded-pill ripple" onClick={() => setDetailOpen(false)}>ปิด</button>
              </div>
            </div>
          </div>
        </div>
      )}

    

      {/* style */}
      <style>{`
        /* Animated background & blobs */
        .bg-animated{background:radial-gradient(1200px 600px at 10% -10%, #efe7ff 15%, transparent 60%),radial-gradient(1000px 500px at 110% 10%, #e6f0ff 10%, transparent 55%),linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%);} 
        .glassy{backdrop-filter:blur(8px);} 
        .topbar{position:sticky;top:0;left:0;width:100%;background:linear-gradient(90deg, rgba(111,66,193,.9), rgba(142,92,255,.9));box-shadow:0 4px 16px rgba(111,66,193,.22);z-index:1040;border-bottom:1px solid rgba(255,255,255,.12);} 

        /* Floating motion */
        .card-float{animation:floatY 6s ease-in-out infinite;} 
        @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}

        .glass-card { backdrop-filter: blur(6px); transition: transform .15s ease, box-shadow .15s ease; }
        .glass-card:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(28,39,49,.12)!important; }
        .ratio-21x9 { aspect-ratio: 21/9; width: 100%; background: #e9ecef; }
        .year-pill { font-weight: 700; }
        .form-control:focus { box-shadow: 0 0 0 .2rem rgba(111,66,193,.12); border-color: #8e5cff; }
        .wave{position:fixed;left:0;right:0;bottom:-1px;width:100%;height:120px;}

        /* Ripple */
        .ripple{position:relative;overflow:hidden;} 
        .ripple:after{content:"";position:absolute;inset:0;border-radius:inherit;opacity:0;background:radial-gradient(circle at var(--x,50%) var(--y,50%), rgba(255,255,255,.45), transparent 40%);transform:scale(.2);transition:transform .3s, opacity .45s;pointer-events:none;} 
        .ripple:active:after{opacity:1;transform:scale(1);transition:0s;} 
        .ripple{--x:50%;--y:50%;} 
        .ripple:focus-visible{outline:3px solid rgba(142,92,255,.45);outline-offset:2px;}

        /* Blobs */
        html, body {
  overflow-x: hidden;
}

/* ป้องกัน blob ล้นจอ */
.bg-blob {
  position: absolute;
  filter: blur(60px);
  opacity: .55;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  max-width: 100vw;
  will-change: transform;
}

/* ให้ container หลักไม่ล้น */
.bg-animated {
  overflow-x: hidden;
  width: 100%;
  max-width: 100vw;
}
        .bg-blob-1{width:420px;height:420px;left:-120px;top:-80px;background:#d7c6ff;animation:drift1 18s ease-in-out infinite;} 
        .bg-blob-2{width:360px;height:360px;right:-120px;top:120px;background:#c6ddff;animation:drift2 22s ease-in-out infinite;} 
        .bg-blob-3{width:300px;height:300px;left:15%;bottom:-120px;background:#ffd9ec;animation:drift3 20s ease-in-out infinite;} 
        @keyframes drift1{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,10px)}} 
        @keyframes drift2{0%,100%{transform:translate(0,0)}50%{transform:translate(-16px,8px)}} 
        @keyframes drift3{0%,100%{transform:translate(0,0)}50%{transform:translate(12px,-12px)}} 
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
