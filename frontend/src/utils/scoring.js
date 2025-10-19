
/* ============================================================================
 * 1) Language (ภาษา)
 * ==========================================================================*/
export const CEPT_LEVEL_TO_PCT = { A1: 30, A2: 45, B1: 60, B2: 75, C1: 90, C2: 100 };

export function scoreLang(level) {
  const map = { A1: 4, A2: 8, B1: 12, B2: 16, C1: 18, C2: 20 }; // legacy /20
  const score = map[level] ?? 0;
  const percent = Math.round(((score / 20) || 0) * 100);
  return { score, percent };
}

/* ============================================================================
 * 2) Technology (เทคโนโลยี)
 * - ใช้ % ที่ดีที่สุดของ CEPT/ICT/ITPE → 0..19 + โบนัสผ่านรวมสูงสุด +1
 * ==========================================================================*/
export function scoreTech(trainCount, ictPct, itpePct, ceptObj) {
  let ceptPct = 0;
  if (ceptObj?.score_raw != null) {
    const raw = Math.max(0, Math.min(50, Number(ceptObj.score_raw)));
    ceptPct = (raw / 50) * 100;
  } else if (ceptObj?.level) ceptPct = CEPT_LEVEL_TO_PCT[ceptObj.level] || 0;

  const ict = Math.max(0, Math.min(100, Number(ictPct ?? 0)));
  const itpe = Math.max(0, Math.min(100, Number(itpePct ?? 0)));
  const bestPct = Math.max(ict, itpe, ceptPct);

  const examPts = (bestPct / 100) * 19;
  let passBonus = 0;
  if (ict >= 50) passBonus += 0.5;
  if (itpe >= 60) passBonus += 0.5;
  else if (itpe >= 55) passBonus += 0.25;
  if (passBonus > 1) passBonus = 1;

  const trainingBonus = Math.min(0.5, (Number(trainCount) || 0) * 0.1);
  const total = Math.min(20, examPts + passBonus + trainingBonus); // legacy /20
  const percent = Math.round((total / 20) * 100);
  return { score: total, percent };
}

/* ============================================================================
 * 3) Academic (วิชาการ/GPA)
 *  - GPA manual (รวมทุกวิชา) → /40
 *  - GPA เฉพาะวิชาบังคับ → /40
 *  - รวมเป็นค่าเฉลี่ยถ่วงน้ำหนัก (ดีฟอลต์ 40:60) ใช้เป็น "acadScore" ในกราฟ
 * ==========================================================================*/
export const GRADE_OPTIONS = ["", "A", "B+", "B", "C+", "C", "D+", "D", "F", "S", "U"]; // "" = ยังไม่ออก
export const GRADE_POINTS = { A: 4.0, "B+": 3.3, B: 3.0, "C+": 2.3, C: 2.0, "D+": 1.3, D: 1.0, F: 0.0 };

/** น้ำหนักค่าเริ่มต้นของด้านวิชาการ: GPA รวม 40% + วิชาบังคับ 60% */
export const ACADEMIC_DEFAULT_WEIGHTS = { wManual: 0.4, wRequired: 0.6 };

export function computeGPA(courses = []) {
  let sumPts = 0, sumCr = 0;
  for (const c of courses) {
    const pts = GRADE_POINTS[c.grade]; // ข้าม "" / S / U
    const cr  = Number(c.credits || 0);
    if (pts == null || !cr) continue;
    sumPts += pts * cr;
    sumCr  += cr;
  }
  const gpa = sumCr ? sumPts / sumCr : 0;
  return { gpa, totalCredits: sumCr };
}

/** GPA ที่ผู้ใช้กรอกเอง → /40 และ % (ไม่รวมรายวิชา) */
export function acadFromManualGPA(gpaInput) {
  const gpa = Math.max(0, Math.min(4, Number(gpaInput || 0)));
  const score = Math.round(gpa * 10 * 100) / 100; // 4.00 → 40.00
  const percent = toPercent(score, 40);
  return { gpa, score, percent, source: "manual" };
}

/** GPA จาก "เฉพาะวิชาบังคับ" → /40 และ % (คำนวณจากรายวิชา) */
export function acadScoreFromCourses(courses = []) {
  const { gpa } = computeGPA(courses);
  const score = Math.round(gpa * 10 * 100) / 100; // 0–40
  const percent = toPercent(score, 40);
  return { gpa, score, percent, source: "required" };
}

/**
 * รวมสองแหล่งเป็น "ด้านวิชาการ" เดียว (ค่าเฉลี่ยถ่วงน้ำหนัก)
 */
export function acadCombined(manualGpa, courses = [], weights = ACADEMIC_DEFAULT_WEIGHTS) {
  const wm = Number.isFinite(weights?.wManual)   ? Math.max(0, weights.wManual)   : ACADEMIC_DEFAULT_WEIGHTS.wManual;
  const wr = Number.isFinite(weights?.wRequired) ? Math.max(0, weights.wRequired) : ACADEMIC_DEFAULT_WEIGHTS.wRequired;
  const wSum = (wm + wr) || 1;

  const m = (manualGpa != null && manualGpa !== "" && Number.isFinite(Number(manualGpa)))
    ? acadFromManualGPA(Number(manualGpa))
    : null;

  const r = Array.isArray(courses) && courses.length
    ? acadScoreFromCourses(courses)
    : null;

  if (m && !r) return { score: m.score, percent: m.percent, parts: { manual: m, required: null }, weights: { wManual: 1, wRequired: 0 } };
  if (!m && r) return { score: r.score, percent: r.percent, parts: { manual: null, required: r }, weights: { wManual: 0, wRequired: 1 } };
  if (!m && !r) return { score: 0, percent: 0, parts: { manual: null, required: null }, weights: { wManual: 0, wRequired: 0 } };

  const score = Math.round(((m.score * wm + r.score * wr) / wSum) * 100) / 100; // /40
  const percent = toPercent(score, 40);

  return {
    score, percent,
    parts: { manual: m, required: r },
    weights: { wManual: wm, wRequired: wr },
  };
}

/**
 * 🧮 ใช้ข้อมูลจาก backend (ไม่มีตารางรายวิชา) → รวมเป็น /40 ด้วยน้ำหนัก 40:60
 */
export function scoreAcademic({ manualGpa, scoreGpa25, scoreCore15, weights = ACADEMIC_DEFAULT_WEIGHTS } = {}) {
  const wm = Number.isFinite(weights?.wManual)   ? Math.max(0, weights.wManual)   : ACADEMIC_DEFAULT_WEIGHTS.wManual;
  const wr = Number.isFinite(weights?.wRequired) ? Math.max(0, weights.wRequired) : ACADEMIC_DEFAULT_WEIGHTS.wRequired;

  const manualScore40 = Number.isFinite(Number(manualGpa))
    ? Math.max(0, Math.min(4, Number(manualGpa))) * 10
    : null;
  const backendGpa40 = Number(scoreGpa25 ?? 0) * (40 / 25);
  const gpa40 = manualScore40 ?? backendGpa40;

  const core40 = Number(scoreCore15 ?? 0) * (40 / 15);

  const score = Math.round(((gpa40 * wm) + (core40 * wr)) * 100) / 100; // /40
  const percent = toPercent(score, 40);

  return { score, percent, parts: { gpa40, core40 }, weights: { wManual: wm, wRequired: wr } };
}

/* ============================================================================
 * 4) Activities (สังคม/สื่อสาร)
 *   🔧 ปรับให้เหลือแค่ 2 บทบาท: ผู้เข้าร่วม, สตาฟ (ป้องกัน error ชนชื่อซ้ำ)
 * ==========================================================================*/
export const ROLE_MULTIPLIERS = {
  participant: 1.0, // ผู้เข้าร่วม
  staff: 1.5,       // สตาฟ/ผู้ช่วยงาน
};

export function getRoleMultiplier(role = "", table = ROLE_MULTIPLIERS) {
  const r = String(role).toLowerCase();
  if (/(staff|เจ้าหน้าที่|สตาฟ)/.test(r))  return table.staff ?? 1.5;
  if (/(participant|ผู้เข้าร่วม)/.test(r)) return table.participant ?? 1.0;
  return 1.0;
}

export function activityPointsPerHour(
  activities = [],
  { perHour = 1, defaultHours = 2, roleMultipliers = ROLE_MULTIPLIERS, capPoints = Infinity } = {}
) {
  let total = 0;
  for (const a of activities) {
    const hrs = Number(a?.hours ?? 0) || defaultHours;
    const mul = getRoleMultiplier(a?.role, roleMultipliers);
    total += hrs * perHour * mul;
  }
  return Math.min(total, capPoints);
}

export function pointsToPercent(points, targetPoints = 40) {
  const p = Math.max(0, Number(points || 0));
  const t = Math.max(1, Number(targetPoints || 1));
  return Math.round(Math.min(1, p / t) * 100);
}

/* ============================================================================
 * 5) Utilities
 * ==========================================================================*/
export const toArray = (v) => (Array.isArray(v) ? v : v?.items ?? []);

export function toPercent(value, max) {
  const v = Math.max(0, Math.min(Number(value || 0), Number(max || 0)));
  return Math.round((v / (max || 1)) * 100);
}

export function equalWeightedTotal(pcts) {
  if (!Array.isArray(pcts) || !pcts.length) return 0;
  const sum = pcts.reduce((s, x) => s + (Number.isFinite(x) ? x : 0), 0);
  return Math.round(sum / pcts.length); // 0..100
}

export function scoreFromHours(h, cap = 10) {
  const x = Number(h || 0);
  if (!x) return 0;
  return Math.round(Math.min(1, x / 20) * cap * 100) / 100;
}

/* ============================================================================
 * 6) รวม 5 มิติให้เป็น 0–100 ต่อแกน + คะแนนรวมเท่ากัน
 * ==========================================================================*/
export function calcAllCompetencies({
  acadScore = 0,          // /40
  langScore = 0,          // /20
  techScore = 0,          // /20
  socialActs = [],
  commActs = [],
  targetPointsSocial = 40,
  targetPointsComm = 40,
} = {}) {
  const pAcad = toPercent(acadScore, 40);
  const pLang = toPercent(langScore, 20);
  const pTech = toPercent(techScore, 20);

  const socialPts = activityPointsPerHour(socialActs);
  const commPts   = activityPointsPerHour(commActs);
  const pSoc  = pointsToPercent(socialPts, targetPointsSocial);
  const pComm = pointsToPercent(commPts, targetPointsComm);

  const totalEqual = equalWeightedTotal([pAcad, pLang, pTech, pSoc, pComm]);

  return {
    each: { acad: pAcad, lang: pLang, tech: pTech, social: pSoc, comm: pComm }, // 0–100 ต่อแกน
    raw:  { acadScore, langScore, techScore, socialPts, commPts },
    totalEqual, // คะแนนรวมถ่วงเท่ากัน 0–100
  };
}

/* ============================================================================
 * 7) Helper (คงไว้ให้ส่วนอื่นใช้ได้ แต่ไม่ประกาศ constant ซ้ำ)
 * ==========================================================================*/
export function calcSocialPoints(acts = [], { perHourPoint = 1 } = {}) {
  let hours = 0;
  let points = 0;
  for (const a of (Array.isArray(acts) ? acts : acts?.items || [])) {
    const h = Math.max(0, Number(a?.hours ?? 0));
    const role = String(a?.role || "participant").toLowerCase();
    const mult = ROLE_MULTIPLIERS[role] ?? 1.0;
    hours += h;
    points += h * perHourPoint * mult;
  }
  return { hours, points: Math.round(points * 100) / 100 };
}

export function scoreSocial100(acts = [], { targetPoints = 40, perHourPoint = 1 } = {}) {
  const { points } = calcSocialPoints(acts, { perHourPoint });
  if (targetPoints <= 0) return 0;
  const pct = Math.min(100, (points / targetPoints) * 100);
  return Math.round(pct);
}
