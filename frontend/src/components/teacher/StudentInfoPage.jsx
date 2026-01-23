// src/components/StudentInfoPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { getUsers, listMajors } from "../../services/api";
import {
  getCompetencyProfile,
  getLatestLanguagesAll,
  listTrainings,
  listActivities,            // ใช้เฉพาะ social
  recalcAcademic,
  getRequiredCourses,
  getSavedGrades as listCourseGrades,
  peer, // ใช้สรุปผลประเมินเพื่อน/ตนเอง
} from "../../services/competencyApi";
import Radar5 from "../profile/Radar5";
import {
  scoreLang,
  scoreTech,
  calcAllCompetencies,
  scoreAcademic,
  scoreSocialActivities,
  scoreCollaboration,
  normalizePeerScore,
  toArray,
} from "../../utils/scoring";

const API_BASE = (import.meta.env?.VITE_API_BASE || "http://localhost:3000").replace(/\/+$/, "");
const DEFAULT_AVATAR = "/src/assets/csit.jpg";
const absUrl = (u) => {
  if (!u) return DEFAULT_AVATAR;
  if (/^https?:\/\//i.test(u)) return u;
  const path = u.startsWith("/") ? u : `/${u}`;
  return `${API_BASE}${path}`;
};

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

/* ================= Helpers (grades) ================= */
const normalizeGrade = (g) => {
  if (g == null) return null;
  const s = String(g).trim().toUpperCase();
  const m = /^([ABCDF](\+)?|S|U)$/.exec(s);
  return m ? m[1] : null;
};

const isPassedLetter = (letterRaw) => {
  const letter = normalizeGrade(letterRaw);
  if (!letter) return null;
  if (letter === "S") return true;
  if (letter === "U") return false;
  const L = ["A", "B+", "B", "C+", "C", "D+", "D", "F"];
  if (!L.includes(letter)) return null;
  return letter !== "F";
};

// หาเกรดใน map โดยลองหลายรูปแบบรหัสวิชา
const pickGradeByCode = (gmap, rawCode) => {
  if (!gmap || !rawCode) return null;
  const code = String(rawCode).trim();
  const variants = new Set([
    code,
    code.replace(/[-/].*$/, ""), // 254171-1 -> 254171
    code.replace(/[-\s]/g, ""),  // 254 171 -> 254171
  ]);
  const keys = Object.keys(gmap || {});
  const hit =
    keys.find((k) => variants.has(String(k).trim())) ||
    keys.find((k) => variants.has(String(k).trim().toUpperCase())) ||
    keys.find((k) => variants.has(String(k).trim().toLowerCase()));
  return hit ? gmap[hit] : null;
};

/* ============== Helper (peer/self) ============== */
/** เฉลี่ยจาก object แยกหัวข้อ (communication/teamwork/...) สเกล 1..5 */
const avgFromTopicObject = (obj) => {
  if (!obj || typeof obj !== "object") return null;
  const keys = ["communication", "teamwork", "responsibility", "cooperation", "adaptability"];
  const vals = keys.map(k => Number(obj[k])).filter(v => Number.isFinite(v) && v >= 0);
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length; // 1..5
};

/* ===== Helper: แปลงผลจาก /peer/received → peerAvg(0..100), peerCount ===== */
function extractPeerSummary(rec) {
  const peerCount = Number(rec?.summary?.count ?? rec?.count ?? 0) || 0;

  // 1) ถ้ามีค่าเฉลี่ยแบบตัวเลขมาแล้ว (ส่วนใหญ่เป็น 0..100) — ใช้ก่อนเลย
  const direct = Number(
    rec?.avg ??
    rec?.summary?.peer_avg ??
    rec?.avg15 ??
    rec?.summary?.avg_all ??
    rec?.summary?.avg_all_15 ??
    0
  );
  if (Number.isFinite(direct) && direct >= 0) {
    // ถ้าเป็น 1..5 แปลงเป็น 0..100, ถ้าเป็น % แล้วจะ clamp ให้อยู่ในช่วง 0..100
    return { peerAvg: normalizePeerScore(direct), peerCount };
  }

  // 2) ถ้าได้แบบแยกหัวข้อ (communication/teamwork/...) → หา mean แล้วค่อย normalize
  if (rec?.summary?.avg && typeof rec.summary.avg === "object") {
    const mean = avgFromTopicObject(rec.summary.avg); // ค่า 1..5
    if (mean != null) {
      return { peerAvg: normalizePeerScore(mean, true), peerCount }; // true = สเกล 1-5
    }
  }

  // 3) ไม่พบข้อมูลที่ใช้ได้
  return { peerAvg: 0, peerCount };
}
/* ======================================================= */

export default function StudentInfoPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (user.role !== "teacher") navigate("/home");
  }, [user, navigate]);

  // ช่วง/รหัสรอบประเมิน (ม.ค.–พ.ค. = 1, มิ.ย.–ธ.ค. = 2)
  const periodKey = useMemo(() => {
    const d = new Date(); const y = d.getFullYear(); const m = d.getMonth() + 1;
    const sem = m <= 5 ? 1 : 2;
    return `${y}-${sem}`;
  }, []);

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

  // โหลดรายชื่อ + enrich
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

        // enrich profile เบื้องต้น
        const ids = all.map((u) => u.id);
        const CHUNK = 25;
        const baseMap = {};
        for (let i = 0; i < ids.length; i += CHUNK) {
          const chunk = ids.slice(i, i + CHUNK);
          const results = await Promise.allSettled(chunk.map((id) => getCompetencyProfile(id)));
          results.forEach((r, idx) => {
            const id = chunk[idx];
            if (r.status === "fulfilled" && r.value?.account) {
              const acct = r.value.account;
              baseMap[id] = {
                manual_gpa: acct.manual_gpa ?? null,
                year_level: acct.year_level ?? null,
                computed_gpa: r.value.computed_gpa ?? null,
                core_completion_pct: r.value.core_completion_pct ?? null,
                score_academic: r.value.score_academic ?? null,
                email: acct.email ?? "",
                phone: acct.phone ?? "",
                line_id: acct.line_id ?? "",
                facebook: acct.facebook ?? "",
                github: acct.github ?? "",
                avatar_url: acct.avatar_url ?? "",
                total_competency: null,
                comp_each: null,
                collab: null, // เก็บ Collaboration (peer/self)
              };
            } else {
              baseMap[id] = {
                manual_gpa: null, year_level: null, computed_gpa: null,
                core_completion_pct: null, score_academic: null,
                email: "", phone: "", line_id: "", facebook: "", github: "",
                avatar_url: "",
                total_competency: null,
                comp_each: null,
                collab: null,
              };
            }
          });
        }
        setEnrich(baseMap);

        // คำนวณคะแนนรวม 5 ด้าน
        const CH2 = 8;
        for (let i = 0; i < all.length; i += CH2) {
          const chunk = all.slice(i, i + CH2).map(u => u.id);
          const enriched = await Promise.allSettled(
            chunk.map(async (id) => {
              const prof = await getCompetencyProfile(id);
              const yMax = prof?.account?.year_level || 4;
              const jobs = [];
              for (let y = 1; y <= yMax; y++) {
                for (let s = 1; s <= 2; s++) jobs.push(recalcAcademic(id, { year: y, sem: s }).catch(() => null));
              }
              const allTerms = (await Promise.all(jobs)).filter(Boolean);

              let sumGpa25 = 0, sumCore15 = 0, n = 0;
              for (const r of allTerms) {
                const g = Number(r?.score_gpa ?? 0);
                const c = Number(r?.score_core ?? 0);
                if (Number.isFinite(g) || Number.isFinite(c)) {
                  sumGpa25 += g;
                  sumCore15 += c;
                  n++;
                }
              }
              const avgGpa25 = n ? +(sumGpa25 / n).toFixed(2) : 0;
              const avgCore15 = n ? +(sumCore15 / n).toFixed(2) : 0;

              // 1. Academic (0-100%)
              const acadObj = scoreAcademic({
                manualGpa: prof?.account?.manual_gpa,
                scoreGpa25: avgGpa25,
                scoreCore15: avgCore15,
              });
              const pAcad = acadObj.percent;

              // 2. Language (0-100%)
              const langs = await getLatestLanguagesAll(id).catch(() => ({}));
              const cept = langs?.CEPT ?? null;
              const langObj = scoreLang(cept?.level);
              const pLang = langObj.percent;

              // 3. Technology (0-100%)
              const trainingsResp = await listTrainings(id).catch(() => ({ items: [] }));
              const ictPct = Number(langs?.ICT?.score_raw ?? 0);
              const itpePct = Number(langs?.ITPE?.score_raw ?? 0);
              const trainingsArr = toArray(trainingsResp?.items || trainingsResp);
              const techObj = scoreTech(trainingsArr.length, ictPct, itpePct, cept);
              const pTech = techObj.percent;

              // 4. Social Activities (0-100%) - ใช้ฟังก์ชันใหม่ที่แยกตามประเภทกิจกรรม
              const socialResp = await listActivities(id, "social").catch(() => ({ items: [] }));
              const socialActs = toArray(socialResp?.items || socialResp);
              const socialResult = scoreSocialActivities(socialActs);
              const pSoc = socialResult.totalPercent;

              // ===== Collaboration (peer + self) =====
              let peerAvg = 0, selfAvg = 0, peerCount = 0;
              try {
                // ดึงตามรอบ
                let rec = await peer.received(id, periodKey);
                let sum = extractPeerSummary(rec);
                peerAvg = sum.peerAvg;
                peerCount = sum.peerCount;

                // ✅ ตรวจสอบว่าข้อมูลที่ได้ตรงรอบหรือไม่ ถ้า periodKey mismatch ให้ fallback
                if ((!peerCount || peerAvg === 0) && rec?.period_key !== periodKey) {
                  rec = await peer.received(id, null);
                  sum = extractPeerSummary(rec);
                  peerAvg = sum.peerAvg;
                  peerCount = sum.peerCount;
                }

                // DEBUG ชั่วคราว
                console.log("peer", id, { periodKey, got: rec?.period_key, peerAvg, peerCount });
              } catch { }
              try {
                // backend บางที่อาจไม่มี self() → fallback เป็น given()
                let self = await (peer.self ? peer.self(id, periodKey) : peer.given(id, periodKey));
                let s = Number(self?.avg ?? self?.summary?.self_avg ?? 0) || 0;
                let isScale15 = false;
                if (!Number.isFinite(s) && self?.summary?.avg) {
                  const m15 = avgFromTopicObject(self.summary.avg);
                  if (m15 != null) { s = m15; isScale15 = true; } // 1..5
                }
                selfAvg = normalizePeerScore(s, isScale15 ? true : null);
                // Fallback: ถ้ายัง 0 ลองไม่ระบุ period
                if (selfAvg === 0) {
                  self = await (peer.self ? peer.self(id, null) : peer.given(id, null));
                  let s2 = Number(self?.avg ?? self?.summary?.self_avg ?? 0) || 0;
                  let isScale152 = false;
                  if (!Number.isFinite(s2) && self?.summary?.avg) {
                    const m152 = avgFromTopicObject(self.summary.avg);
                    if (m152 != null) { s2 = m152; isScale152 = true; }
                  }
                  selfAvg = normalizePeerScore(s2, isScale152 ? true : null);
                }
              } catch { }

              const collabResult = scoreCollaboration({ self: selfAvg, peerAvg }); // ✅ 0..100
              const collabScore = collabResult.score;

              // รวม 5 ด้านแบบถ่วงเท่ากัน
              const each = { acad: pAcad, lang: pLang, tech: pTech, social: pSoc, collab: collabScore };
              const totalEqual = Math.round((each.acad + each.lang + each.tech + each.social + each.collab) / 5);

              return {
                id,
                total_competency: totalEqual,
                comp_each: each,
                collab: { peerAvg, selfAvg, peerCount, periodKey },
              };
            })
          );

          setEnrich((prev) => {
            const nn = { ...prev };
            enriched.forEach((r) => {
              if (r.status === "fulfilled" && r.value) {
                const { id, total_competency, comp_each, collab } = r.value;
                nn[id] = { ...(nn[id] || {}), total_competency, comp_each, collab };
              }
            });
            return nn;
          });
        }
      } catch (e) {
        console.error(e);
        setError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user?.role, periodKey]);

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

  /* ===== เรียงคะแนนจากมากไปน้อย (ไม่มีคะแนนจะไปท้ายสุด) ===== */
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const sa = Number(enrich[a.id]?.total_competency);
      const sb = Number(enrich[b.id]?.total_competency);
      const va = Number.isFinite(sa) ? sa : Number.NEGATIVE_INFINITY; // ไม่มีคะแนน → ดันท้าย
      const vb = Number.isFinite(sb) ? sb : Number.NEGATIVE_INFINITY;
      return vb - va; // มาก → น้อย
    });
    return arr;
  }, [filtered, enrich]);

  /* ===== สรุปคะแนนตามตัวกรอง + แยกตามสาขา/ชั้นปี (แสดงทุกสาขา/ชั้นปี) ===== */
  const stats = useMemo(() => {
    let count = 0, sum = 0, min = Infinity, max = -Infinity;
    const groups = {};

    // สร้าง placeholder สำหรับทุกสาขา/ชั้นปี
    const allDepts = ["วิทยาการคอมพิวเตอร์", "เทคโนโลยีสารสนเทศ"];
    const allYears = [1, 2, 3, 4];
    allDepts.forEach((dep) => {
      allYears.forEach((year) => {
        const key = `${dep}::${year}`;
        groups[key] = { dep, year, count: 0, sum: 0, hasData: false };
      });
    });

    // รวมคะแนนตามกลุ่ม
    sorted.forEach((acc) => {
      const score = Number(enrich[acc.id]?.total_competency);
      if (!Number.isFinite(score)) return;
      count++; sum += score;
      if (score < min) min = score;
      if (score > max) max = score;

      const dep = majorNameById[acc.major_id] || "";
      const year = enrich[acc.id]?.year_level ?? acc.year_level ?? 0;
      if (!allDepts.includes(dep) || !allYears.includes(year)) return;

      const key = `${dep}::${year}`;
      groups[key].count += 1;
      groups[key].sum += score;
      groups[key].hasData = true;
    });

    const avg = count ? +(sum / count).toFixed(2) : 0;
    const groupRows = Object.values(groups)
      .map((g) => ({
        ...g,
        avg: g.count ? +(g.sum / g.count).toFixed(2) : null,
      }))
      .sort((a, b) => a.dep.localeCompare(b.dep, "th") || a.year - b.year);

    return { count, sum: Math.round(sum), min: count ? min : 0, max: count ? max : 0, avg, groups: groupRows };
  }, [sorted, enrich, majorNameById]);

  /* ======================= Modal ======================= */
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAccount, setDetailAccount] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState({
    profile: null,
    languages: null,
    trainings: [],
    activities: { social: [] },
    radar: null,
    calc: null,
    requiredAll: [],
    collab: null,
  });
  const modalRef = useRef(null);

  const buildCalc = ({ profile, languages, trainings, activities, avgGpa25, avgCore15, collab }) => {
    // 1. Academic (0-100%)
    const acadObj = scoreAcademic({
      manualGpa: profile?.account?.manual_gpa,
      scoreGpa25: avgGpa25 ?? 0,
      scoreCore15: avgCore15 ?? 0,
    });
    const pAcad = acadObj.percent;

    // 2. Language (0-100%)
    const cept = languages?.CEPT ?? null;
    const langObj = scoreLang(cept?.level);
    const pLang = langObj.percent;

    // 3. Technology (0-100%)
    const ictPct = Number(languages?.ICT?.score_raw ?? 0);
    const itpePct = Number(languages?.ITPE?.score_raw ?? 0);
    const trainingsArr = toArray(trainings?.items || trainings);
    const techObj = scoreTech(trainingsArr.length, ictPct, itpePct, cept);
    const pTech = techObj.percent;

    // 4. Social Activities (0-100%)
    const socialActs = toArray(activities?.social);
    const socialResult = scoreSocialActivities(socialActs);
    const pSoc = socialResult.totalPercent;

    // 5. Collaboration (Peer 80% + Self 20%)
    const collabResult = scoreCollaboration({ self: collab?.selfAvg || 0, peerAvg: collab?.peerAvg || 0 });
    const collabScore = collabResult.score;

    const each = { acad: pAcad, lang: pLang, tech: pTech, social: pSoc, collab: collabScore };
    const total = Math.round((each.acad + each.lang + each.tech + each.social + each.collab) / 5);

    const explain = [
      `วิชาการ ${Math.round(each.acad)}/100`,
      `ภาษา ${Math.round(each.lang)}/100`,
      `เทคโนโลยี ${Math.round(each.tech)}/100`,
      `สังคม ${Math.round(each.social)}/100`,
      `ทำงานร่วมกับผู้อื่น ${Math.round(each.collab)}/100`,
    ];
    return {
      radar: {
        labels: ["วิชาการ", "ภาษา", "เทคโนโลยี", "สังคม", "ทำงานร่วมกับผู้อื่น"],
        values: [each.acad, each.lang, each.tech, each.social, each.collab],
        maxValues: [100, 100, 100, 100, 100],
      },
      calc: { total, explain, acadObj, each, socialBreakdown: socialResult.breakdown },
    };
  };

  const openDetail = async (acc) => {
    setDetailAccount(acc);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const [profileRaw, languages, trainings, social] = await Promise.all([
        getCompetencyProfile(acc.id),
        getLatestLanguagesAll(acc.id).catch(() => ({})),
        listTrainings(acc.id).catch(() => ({ items: [] })),
        listActivities(acc.id, "social").catch(() => ({ items: [] })),
      ]);

      // รวมผลวิชาการทุกเทอม
      const yMax = profileRaw?.account?.year_level || 4;
      const tasks = [];
      for (let y = 1; y <= yMax; y++) {
        for (let s = 1; s <= 2; s++) tasks.push(recalcAcademic(acc.id, { year: y, sem: s }).catch(() => null));
      }
      const allTerms = (await Promise.all(tasks)).filter(Boolean);
      let sumGpa25 = 0, sumCore15 = 0, n = 0;
      for (const r of allTerms) {
        sumGpa25 += Number(r?.score_gpa || 0);
        sumCore15 += Number(r?.score_core || 0);
        n++;
      }
      const avgGpa25 = n ? +(sumGpa25 / n).toFixed(2) : 0;
      const avgCore15 = n ? +(sumCore15 / n).toFixed(2) : 0;

      // เกรดทั้งหมด (ไม่ส่ง year/sem)
      const allGradesResp = await listCourseGrades(acc.id).catch(() => null);
      let gmapAll = {};
      if (allGradesResp?.map && typeof allGradesResp.map === "object") gmapAll = allGradesResp.map;
      else if (allGradesResp?.grades && typeof allGradesResp.grades === "object") gmapAll = allGradesResp.grades;
      else if (Array.isArray(allGradesResp?.items)) {
        for (const it of allGradesResp.items) {
          const k = it.course_code || it.code;
          if (k) gmapAll[String(k).trim()] = it.letter || it.grade || it.grade_letter || it.result || null;
        }
      }

      // วิชาบังคับทั้งหมด + จับคู่เกรดจาก gmapAll
      const requiredRows = [];
      for (let y = 1; y <= yMax; y++) {
        for (let s = 1; s <= 2; s++) {
          const req = await getRequiredCourses(profileRaw?.account?.major_id, y, s).catch(() => null);
          const list = req?.required || req?.items || [];
          list.forEach((c) => {
            const gradeRaw = pickGradeByCode(gmapAll, c.code);
            const grade = normalizeGrade(gradeRaw);
            requiredRows.push({
              year: y, sem: s, code: c.code,
              name_th: c.name_th || c.name_en || "-",
              credit: c.credit ?? "-",
              grade,
              passed: isPassedLetter(grade),
            });
          });
        }
      }

      // Collaboration summary (modal) + fallback
      let peerAvg = 0, selfAvg = 0, peerCount = 0;
      try {
        let rec = await peer.received(acc.id, periodKey);
        let sum = extractPeerSummary(rec);
        peerAvg = sum.peerAvg;
        peerCount = sum.peerCount;
        if (!peerCount) {
          rec = await peer.received(acc.id, null);
          sum = extractPeerSummary(rec);
          peerAvg = sum.peerAvg;
          peerCount = sum.peerCount;
        }
      } catch { }
      try {
        let self = await (peer.self ? peer.self(acc.id, periodKey) : peer.given(acc.id, periodKey));
        let s = Number(self?.avg ?? self?.summary?.self_avg ?? 0) || 0;
        let isScale15 = false;
        if (!Number.isFinite(s) && self?.summary?.avg) {
          const m15 = avgFromTopicObject(self.summary.avg);
          if (m15 != null) { s = m15; isScale15 = true; }
        }
        selfAvg = normalizePeerScore(s, isScale15 ? true : null);
        if (selfAvg === 0) {
          self = await (peer.self ? peer.self(acc.id, null) : peer.given(acc.id, null));
          let s2 = Number(self?.avg ?? self?.summary?.self_avg ?? 0) || 0;
          let isScale152 = false;
          if (!Number.isFinite(s2) && self?.summary?.avg) {
            const m152 = avgFromTopicObject(self.summary.avg);
            if (m152 != null) { s2 = m152; isScale152 = true; }
          }
          selfAvg = normalizePeerScore(s2, isScale152 ? true : null);
        }
      } catch { }
      const collabSummary = { peerAvg, selfAvg, peerCount, periodKey };

      const profile = { ...profileRaw };
      const { radar, calc } = buildCalc({
        profile, languages, trainings, activities: { social },
        avgGpa25, avgCore15, collab: collabSummary,
      });

      setDetail({
        profile, languages, trainings, activities: { social },
        radar, calc, requiredAll: requiredRows, collab: collabSummary,
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
      {/* Blobs */}
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
                <div className="ms-auto d-flex align-items-center gap-2">
                  {(user?.role === "teacher" || user?.role === "admin") && (
                    <>
                      <button
                        className="btn btn-outline-primary rounded-pill ripple"
                        onClick={() => navigate("/teacher-announcements")}
                        title="จัดการประกาศ"
                        aria-label="จัดการประกาศ"
                      >
                        <i className="bi bi-megaphone me-1" /> จัดการประกาศ
                      </button>
                      <button
                        className="btn btn-outline-primary rounded-pill ripple"
                        onClick={() => navigate("/create-announcement")}
                        title="เพิ่มประกาศ"
                        aria-label="เพิ่มประกาศ"
                      >
                        <i className="bi bi-plus-circle me-1" /> เพิ่มประกาศ
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Results header */}
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
              <div className="text-muted small mb-2">พบ {sorted.length.toLocaleString("th-TH")} รายการ</div>
            )}

            {/* ===== Summary after filters ===== */}
            {!loading && !error && (
              <div className="card border-0 shadow-sm rounded-4 mb-3 glassy summary-card">
                <div className="card-body">
                  {/* Header สรุปภาพรวม */}
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-3 pb-3 border-bottom">
                    <h6 className="mb-0 me-auto d-flex align-items-center gap-2">
                      <i className="bi bi-bar-chart-fill text-primary" />
                      สรุปคะแนนสมรรถนะ
                    </h6>
                  </div>

                  {/* Stats Cards */}
                  <div className="row g-2 mb-3">
                    <div className="col-6 col-md-4 col-lg">
                      <div className="stat-box bg-primary-subtle">
                        <div className="stat-label">จำนวนนิสิต</div>
                        <div className="stat-value text-primary">{stats.count.toLocaleString("th-TH")}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-4 col-lg">
                      <div className="stat-box bg-success-subtle">
                        <div className="stat-label">คะแนนเฉลี่ย</div>
                        <div className="stat-value text-success">{stats.avg || "—"}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-4 col-lg">
                      <div className="stat-box bg-info-subtle">
                        <div className="stat-label">ผลรวมคะแนน</div>
                        <div className="stat-value text-info">{stats.sum.toLocaleString("th-TH")}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-6 col-lg">
                      <div className="stat-box bg-warning-subtle">
                        <div className="stat-label">ต่ำสุด</div>
                        <div className="stat-value text-warning">{stats.count ? stats.min : "—"}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-6 col-lg">
                      <div className="stat-box bg-danger-subtle">
                        <div className="stat-label">สูงสุด</div>
                        <div className="stat-value text-danger">{stats.count ? stats.max : "—"}</div>
                      </div>
                    </div>
                  </div>

                  {/* ตารางสรุปตามสาขา/ชั้นปี */}
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 summary-table">
                      <thead>
                        <tr>
                          <th>สาขา</th>
                          <th className="text-center" style={{ width: 90 }}>ชั้นปี</th>
                          <th className="text-end" style={{ width: 100 }}>จำนวน</th>
                          <th className="text-end" style={{ width: 120 }}>ผลรวม</th>
                          <th className="text-end" style={{ width: 110 }}>เฉลี่ย</th>
                          <th className="text-center" style={{ width: 100 }}>สถานะ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.groups.map((g) => (
                          <tr key={`${g.dep}-${g.year}`} className={!g.hasData ? "table-light" : ""}>
                            <td>
                              <span className={`dept-badge ${g.dep === "วิทยาการคอมพิวเตอร์" ? "dept-cs" : "dept-it"}`}>
                                {g.dep === "วิทยาการคอมพิวเตอร์" ? "CS" : "IT"}
                              </span>
                              <span className="ms-2">{g.dep}</span>
                            </td>
                            <td className="text-center">
                              <span className="badge bg-secondary rounded-pill">ปี {g.year}</span>
                            </td>
                            <td className="text-end fw-medium">{g.hasData ? g.count.toLocaleString("th-TH") : "—"}</td>
                            <td className="text-end">{g.hasData ? g.sum.toLocaleString("th-TH") : "—"}</td>
                            <td className="text-end fw-semibold">{g.hasData && g.avg != null ? g.avg : "—"}</td>
                            <td className="text-center">
                              {g.hasData ? (
                                <span className="badge bg-success-subtle text-success">
                                  <i className="bi bi-check-circle me-1" />มีข้อมูล
                                </span>
                              ) : (
                                <span className="badge bg-warning-subtle text-warning">
                                  <i className="bi bi-hourglass-split me-1" />รอข้อมูล
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Cards */}
            <div className="row g-4">
              {sorted.map((acc) => {
                const depName = majorNameById[acc.major_id] || "";
                const bannerGrad =
                  depName === "วิทยาการคอมพิวเตอร์"
                    ? `linear-gradient(135deg,#ff7300ff, #adb5bd)`
                    : depName === "เทคโนโลยีสารสนเทศ"
                      ? "linear-gradient(135deg, #8a07e2ff, #adb5bd)"
                      : "linear-gradient(135deg, #6c757d, #adb5bd)";
                const manualGpa = enrich[acc.id]?.manual_gpa ?? "—";
                const yearLevel = enrich[acc.id]?.year_level ?? "—";
                const totalComp = enrich[acc.id]?.total_competency;
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
                            onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                            className="rounded-circle"
                            style={{ width: 40, height: 40, objectFit: "cover" }}
                          />
                          <div className="flex-grow-1">
                            <div className="fw-semibold text-truncate" title={acc.full_name}>{acc.full_name}</div>
                            <div className="text-muted small">{acc.username}</div>
                          </div>
                          <div className="ms-auto">
                            <span className="badge text-bg-primary rounded-pill">
                              {Number.isFinite(totalComp) ? `${totalComp}/100` : "กำลังคำนวณ…"}
                            </span>
                          </div>
                        </div>

                        <div className="row small mb-2">
                          <div className="col-6">
                            <div className="text-muted">GPAX</div>
                            <div className="fw-medium">{manualGpa}</div>
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
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content rounded-4 overflow-hidden border-0 shadow-lg">
              <div className="modal-header border-0 text-white" style={{ background: 'linear-gradient(135deg, #6f42c1 0%, #8b5cf6 50%, #a78bfa 100%)' }}>
                <div className="d-flex align-items-center gap-3">
                  <img
                    src={absUrl(detailAccount?.avatar_url)}
                    alt=""
                    className="rounded-circle border border-3 border-white shadow"
                    style={{ width: 50, height: 50, objectFit: 'cover' }}
                    onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                  />
                  <div>
                    <h5 className="modal-title mb-0 fw-bold">{detailAccount?.full_name}</h5>
                    <small className="opacity-75">{detailAccount?.username} • ชั้นปี {detailAccount?.year_level || '-'}</small>
                  </div>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setDetailOpen(false)} />
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
                        onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
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
                        <div className="card border-0 shadow-sm rounded-4 h-100" style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)' }}>
                          <div className="card-body text-center">
                            <div style={{ fontSize: '2rem' }}>📊</div>
                            <div className="text-muted small">GPA (กรอกเอง)</div>
                            <div className="fs-3 fw-bold" style={{ color: '#db2777' }}>{detail?.profile?.account?.manual_gpa ?? "—"}</div>
                          </div>
                        </div>
                      </div>

                      <div className="col-6 col-lg-3">
                        <div className="card border-0 shadow-sm rounded-4 h-100" style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)' }}>
                          <div className="card-body text-center">
                            <div style={{ fontSize: '2rem' }}>📚</div>
                            <div className="text-muted small">ชั้นปี</div>
                            <div className="fs-3 fw-bold text-primary">{detail?.profile?.account?.year_level ?? "—"}</div>
                          </div>
                        </div>
                      </div>
                      <div className="col-6 col-lg-3">
                        <div className="card border-0 shadow-sm rounded-4 h-100" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%)' }}>
                          <div className="card-body text-center">
                            <div style={{ fontSize: '2rem' }}>🏆</div>
                            <div className="text-muted small">คะแนนรวม</div>
                            <div className="fs-3 fw-bold text-success">
                              {detail?.calc?.total != null ? detail.calc.total : "—"}<small className="fs-6 text-muted">/100</small>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* สรุปทำงานร่วมกับผู้อื่น */}
                      <div className="col-12 col-lg-3">
                        <div className="card border-0 shadow-sm rounded-4 h-100" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' }}>
                          <div className="card-body">
                            <div className="d-flex align-items-center gap-2 mb-2">
                              <span style={{ fontSize: '1.5rem' }}>🤝</span>
                              <span className="fw-semibold">ทำงานร่วมกับผู้อื่น</span>
                            </div>
                            <div className="small text-muted mb-1">รอบ {detail?.collab?.periodKey || periodKey}</div>
                            <div className="d-flex justify-content-between small">
                              <span>Peer: <b className="text-primary">{(detail?.collab?.peerAvg ?? 0).toFixed(1)}</b></span>
                              <span>Self: <b className="text-success">{(detail?.collab?.selfAvg ?? 0).toFixed(1)}</b></span>
                            </div>
                            <div className="text-muted small mt-1">👥 {detail?.collab?.peerCount ?? 0} คนประเมิน</div>
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
                          <Radar5 labels={detail.radar.labels} values={detail.radar.values} maxValues={detail.radar.maxValues} />
                          <div className="mt-3 small">{detail.calc.explain.join(" · ")}</div>
                        </div>
                      </div>
                    )}

                    {/* ภาษา / เทคโนโลยี / กิจกรรม */}
                    <div className="row g-3">
                      {/* ภาษา */}
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

                      {/* เทคโนโลยี & อบรม */}
                      <div className="col-12 col-xl-6">
                        <div className="card border-0 shadow-sm rounded-4 h-100">
                          <div className="card-body">
                            <div className="fw-semibold mb-2">เทคโนโลยี & อบรม</div>
                            {toArray(detail.trainings?.items || detail.trainings).length ? (
                              <ul className="list-group list-group-flush">
                                {toArray(detail.trainings?.items || detail.trainings).map((t) => (
                                  <li key={t.id ?? `${t.title}-${t.hours ?? "0"}`} className="list-group-item px-0">
                                    {t.title} {t.hours ? `(${t.hours} ชม.)` : ""}
                                  </li>
                                ))}
                              </ul>
                            ) : <div className="text-muted small">ยังไม่มีข้อมูลการอบรม</div>}
                          </div>
                        </div>
                      </div>

                      {/* สังคม (Social) - แบ่งหมวดหมู่ */}
                      <div className="col-12">
                        <div className="card border-0 shadow-sm rounded-4 h-100" style={{ background: 'linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%)' }}>
                          <div className="card-body">
                            <div className="d-flex align-items-center gap-2 mb-3">
                              <span style={{ fontSize: '1.5rem' }}>🎯</span>
                              <h6 className="fw-bold mb-0">กิจกรรมสังคม</h6>
                              <span className="badge bg-primary rounded-pill ms-auto">
                                {toArray(detail.activities?.social).length} กิจกรรม
                              </span>
                            </div>

                            {(() => {
                              const allActs = toArray(detail.activities?.social);
                              if (!allActs.length) return <div className="text-muted small">ยังไม่มีกิจกรรมสังคม</div>;

                              // แบ่งกิจกรรมตามหมวดหมู่
                              const categorize = (a) => {
                                const cat = String(a?.category || a?.type || '').toLowerCase();
                                if (cat.includes('central') || cat.includes('กลาง') || cat === 'university') return 'central';
                                if (cat.includes('faculty') || cat.includes('คณะ') || cat === 'department') return 'faculty';
                                return 'elective';
                              };

                              const central = allActs.filter(a => categorize(a) === 'central');
                              const faculty = allActs.filter(a => categorize(a) === 'faculty');
                              const elective = allActs.filter(a => categorize(a) === 'elective');

                              const renderCategory = (label, icon, color, items, target) => (
                                <div className="mb-3">
                                  <div className="d-flex align-items-center gap-2 mb-2">
                                    <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                                    <span className="fw-semibold" style={{ color }}>{label}</span>
                                    <span className="badge rounded-pill" style={{ background: color, color: '#fff' }}>
                                      {items.length} / {target}
                                    </span>
                                    <div className="progress flex-grow-1 ms-2" style={{ height: 6 }}>
                                      <div className="progress-bar" style={{ width: `${Math.min(100, (items.length / target) * 100)}%`, background: color }}></div>
                                    </div>
                                  </div>
                                  {items.length > 0 ? (
                                    <div className="d-flex flex-wrap gap-2">
                                      {items.map((a, i) => (
                                        <div key={a.id || i} className="badge bg-white text-dark border shadow-sm px-3 py-2" style={{ fontSize: '0.8rem' }}>
                                          {a.title} {a.hours ? `(${a.hours}ชม.)` : ''} {a.role ? <span className="text-muted">• {a.role}</span> : ''}
                                        </div>
                                      ))}
                                    </div>
                                  ) : <div className="text-muted small fst-italic">ยังไม่มีกิจกรรมในหมวดนี้</div>}
                                </div>
                              );

                              return (
                                <>
                                  {renderCategory('กิจกรรมกลาง (มหาวิทยาลัย)', '🏛️', '#6f42c1', central, 6)}
                                  {renderCategory('กิจกรรมคณะ', '🎓', '#0d6efd', faculty, 8)}
                                  {renderCategory('กิจกรรมเสรี', '✨', '#20c997', elective, 4)}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* วิชาบังคับทั้งหมด */}
                      <div className="col-12">
                        <div className="card border-0 shadow-sm rounded-4 h-100">
                          <div className="card-body">
                            <div className="fw-semibold mb-2">วิชาบังคับทั้งหมด (ทุกปี/ทุกเทอม)</div>
                            {detail.requiredAll?.length ? (
                              <div className="table-responsive">
                                <table className="table table-sm align-middle">
                                  <thead>
                                    <tr>
                                      <th style={{ width: 80 }}>ปี</th>
                                      <th style={{ width: 80 }}>เทอม</th>
                                      <th style={{ width: 120 }}>รหัส</th>
                                      <th>ชื่อรายวิชา</th>
                                      <th style={{ width: 80 }}>หน่วยกิต</th>
                                      <th style={{ width: 80 }}>เกรด</th>
                                      <th style={{ width: 120 }}>สถานะ</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detail.requiredAll
                                      .sort((a, b) => (a.year - b.year) || (a.sem - b.sem) || String(a.code).localeCompare(String(b.code)))
                                      .map((row) => (
                                        <tr key={`${row.year}-${row.sem}-${row.code}`}>
                                          <td>{row.year}</td>
                                          <td>{row.sem}</td>
                                          <td className="font-monospace">{row.code}</td>
                                          <td>{row.name_th}</td>
                                          <td>{row.credit}</td>
                                          <td>{normalizeGrade(row.grade) ?? "—"}</td>
                                          <td>
                                            {row.passed === null ? <span className="badge text-bg-secondary">รอผล</span>
                                              : row.passed ? <span className="badge text-bg-success">ผ่าน</span>
                                                : <span className="badge text-bg-danger">ไม่ผ่าน</span>}
                                          </td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-muted small">ยังไม่มีข้อมูลวิชาบังคับ</div>
                            )}
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

      {/* local styles */}
      <style>{`
        
        .glassy{backdrop-filter:blur(8px);} 
        .topbar{position:sticky;top:0;left:0;width:100%;background:linear-gradient(90deg, rgba(111,66,193,.9), rgba(142,92,255,.9));box-shadow:0 4px 16px rgba(111,66,193,.22);z-index:1040;border-bottom:1px solid rgba(255,255,255,.12);} 
        .glass-card { backdrop-filter: blur(6px); transition: transform .15s ease, box-shadow .15s ease; }
        .glass-card:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(28,39,49,.12)!important; }
        .ratio-21x9 { aspect-ratio: 21/9; width: 100%; background: #e9ecef; }
        .year-pill { font-weight: 700; }
        .form-control:focus { box-shadow: 0 0 0 .2rem rgba(111,66,193,.12); border-color: #8e5cff; }
        .bg-blob { position: absolute; filter: blur(60px); opacity: .55; z-index: 0; pointer-events: none; overflow: hidden; max-width: 100vw; will-change: transform; }
        .bg-blob-1{width:420px;height:420px;left:-120px;top:-80px;background:#d7c6ff;animation:drift1 18s ease-in-out infinite;} 
        .bg-blob-2{width:360px;height:360px;right:-120px;top:120px;background:#c6ddff;animation:drift2 22s ease-in-out infinite;} 
        .bg-blob-3{width:300px;height:300px;left:15%;bottom:-120px;background:#ffd9ec;animation:drift3 20s ease-in-out infinite;} 
        @keyframes drift1{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,10px)}} 
        @keyframes drift2{0%,100%{transform:translate(0,0)}50%{transform:translate(-16px,8px)}} 
        @keyframes drift3{0%,100%{transform:translate(0,0)}50%{transform:translate(12px,-12px)}} 
        .ripple{position:relative;overflow:hidden;} 
        .ripple:after{content:"";position:absolute;inset:0;border-radius:inherit;opacity:0;background:radial-gradient(circle at var(--x,50%) var(--y,50%), rgba(255,255,255,.45), transparent 40%);transform:scale(.2);transition:transform .3s, opacity .45s;pointer-events:none;} 
        .ripple:active:after{opacity:1;transform:scale(1);transition:0s;} 
        .ripple{--x:50%;--y:50%;} 
        .ripple:focus-visible{outline:3px solid rgba(142,92,255,.45);outline-offset:2px;}
        /* Summary Card Styles */
        .summary-card { background: linear-gradient(135deg, rgba(255,255,255,.95), rgba(248,250,252,.9)); }
        .stat-box { padding: 12px 16px; border-radius: 12px; text-align: center; transition: transform .15s ease; }
        .stat-box:hover { transform: translateY(-2px); }
        .stat-label { font-size: 0.75rem; color: #6c757d; margin-bottom: 4px; font-weight: 500; }
        .stat-value { font-size: 1.25rem; font-weight: 700; }
        .dept-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; }
        .dept-cs { background: linear-gradient(135deg, #ff7300, #ff9a44); color: white; }
        .dept-it { background: linear-gradient(135deg, #8a07e2, #a855f7); color: white; }
        .summary-table thead th { background: #f8f9fa; font-weight: 600; font-size: 0.85rem; border-bottom: 2px solid #dee2e6; }
        .summary-table tbody tr:hover { background: rgba(111,66,193,.05); }
        .summary-table td { vertical-align: middle; padding: 10px 8px; }
      `}</style>

      {/* ripple position helper */}
      <script dangerouslySetInnerHTML={{
        __html: `
          document.addEventListener('pointerdown', (e) => {
            const el = e.target.closest('.ripple');
            if (!el) return;
            const rect = el.getBoundingClientRect();
            el.style.setProperty('--x', ((e.clientX - rect.left) / rect.width * 100).toFixed(2) + '%');
            el.style.setProperty('--y', ((e.clientY - rect.top) / rect.height * 100).toFixed(2) + '%');
          }, { passive: true });
        `
      }} />
    </div>
  );
}
