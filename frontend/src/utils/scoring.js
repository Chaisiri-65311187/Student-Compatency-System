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
  const total = Math.min(20, examPts + passBonus + trainingBonus);
  const percent = Math.round((total / 20) * 100);
  return { score: total, percent };
}

/* ============================================================================
 * 3) Academic (วิชาการ / GPA)
 * ==========================================================================*/
export const GRADE_OPTIONS = ["", "A", "B+", "B", "C+", "C", "D+", "D", "F", "S", "U"];
export const GRADE_POINTS = { A: 4.0, "B+": 3.3, B: 3.0, "C+": 2.3, C: 2.0, "D+": 1.3, D: 1.0, F: 0.0 };
export const ACADEMIC_DEFAULT_WEIGHTS = { wManual: 0.4, wRequired: 0.6 };

export function computeGPA(courses = []) {
  let sumPts = 0, sumCr = 0;
  for (const c of courses) {
    const pts = GRADE_POINTS[c.grade];
    const cr = Number(c.credits || 0);
    if (pts == null || !cr) continue;
    sumPts += pts * cr;
    sumCr += cr;
  }
  const gpa = sumCr ? sumPts / sumCr : 0;
  return { gpa, totalCredits: sumCr };
}

export function acadFromManualGPA(gpaInput) {
  const gpa = Math.max(0, Math.min(4, Number(gpaInput || 0)));
  const score = Math.round(gpa * 10 * 100) / 100;
  const percent = toPercent(score, 40);
  return { gpa, score, percent, source: "manual" };
}

export function acadScoreFromCourses(courses = []) {
  const { gpa } = computeGPA(courses);
  const score = Math.round(gpa * 10 * 100) / 100;
  const percent = toPercent(score, 40);
  return { gpa, score, percent, source: "required" };
}

export function acadCombined(manualGpa, courses = [], weights = ACADEMIC_DEFAULT_WEIGHTS) {
  const wm = Number.isFinite(weights?.wManual) ? weights.wManual : 0.4;
  const wr = Number.isFinite(weights?.wRequired) ? weights.wRequired : 0.6;
  const wSum = wm + wr || 1;

  const m = manualGpa ? acadFromManualGPA(manualGpa) : null;
  const r = courses?.length ? acadScoreFromCourses(courses) : null;

  if (!m && !r) return { score: 0, percent: 0, parts: {}, weights: { wm, wr } };
  if (m && !r) return { score: m.score, percent: m.percent, parts: { m }, weights: { wm: 1, wr: 0 } };
  if (!m && r) return { score: r.score, percent: r.percent, parts: { r }, weights: { wm: 0, wr: 1 } };

  const score = Math.round(((m.score * wm + r.score * wr) / wSum) * 100) / 100;
  const percent = toPercent(score, 40);
  return { score, percent, parts: { m, r }, weights: { wm, wr } };
}

export function scoreAcademic({ manualGpa, scoreGpa25, scoreCore15, weights = ACADEMIC_DEFAULT_WEIGHTS } = {}) {
  const wm = weights?.wManual ?? 0.4;
  const wr = weights?.wRequired ?? 0.6;

  const manualScore40 = Number.isFinite(Number(manualGpa)) ? Math.max(0, Math.min(4, Number(manualGpa))) * 10 : null;
  const backendGpa40 = Number(scoreGpa25 ?? 0) * (40 / 25);
  const gpa40 = manualScore40 ?? backendGpa40;

  const core40 = Number(scoreCore15 ?? 0) * (40 / 15);
  const score = Math.round(((gpa40 * wm) + (core40 * wr)) * 100) / 100;
  const percent = toPercent(score, 40);
  return { score, percent, parts: { gpa40, core40 }, weights: { wm, wr } };
}

/* ============================================================================
 * 4) Activities (สังคม / สื่อสาร)
 * ==========================================================================*/
export const ROLE_MULTIPLIERS = { participant: 1.0, staff: 1.5 };

export function getRoleMultiplier(role = "", table = ROLE_MULTIPLIERS) {
  const r = String(role).toLowerCase();
  if (/(staff|เจ้าหน้าที่|สตาฟ)/.test(r)) return table.staff;
  if (/(participant|ผู้เข้าร่วม)/.test(r)) return table.participant;
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
  return Math.round(sum / pcts.length);
}

export function scoreFromHours(h, cap = 10) {
  const x = Number(h || 0);
  if (!x) return 0;
  return Math.round(Math.min(1, x / 20) * cap * 100) / 100;
}

/* ============================================================================
 * 6) รวม 5 มิติ → 0–100 ต่อแกน + คะแนนรวมเท่ากัน
 * ==========================================================================*/
export function calcAllCompetencies({
  acadScore = 0,
  langScore = 0,
  techScore = 0,
  socialActs = [],
  commActs = [],
  targetPointsSocial = 40,
  targetPointsComm = 40,
} = {}) {
  const pAcad = toPercent(acadScore, 40);
  const pLang = toPercent(langScore, 20);
  const pTech = toPercent(techScore, 20);

  const socialPts = activityPointsPerHour(socialActs);
  const commPts = activityPointsPerHour(commActs);
  const pSoc = pointsToPercent(socialPts, targetPointsSocial);
  const pComm = pointsToPercent(commPts, targetPointsComm);

  const totalEqual = equalWeightedTotal([pAcad, pLang, pTech, pSoc, pComm]);
  return {
    each: { acad: pAcad, lang: pLang, tech: pTech, social: pSoc, comm: pComm },
    raw: { acadScore, langScore, techScore, socialPts, commPts },
    totalEqual,
  };
}

/* ============================================================================
 * 7) Collaboration (การทำงานร่วมกับผู้อื่น)
 *     Peer 80% : Self 20%
 * ==========================================================================*/
export function scoreCollaboration({ self = 0, peerAvg = 0, selfWeight } = {}) {
  const envSelf = Number(import.meta?.env?.VITE_SELF_WEIGHT);
  const wSelf = Number.isFinite(selfWeight)
    ? Math.max(0, Math.min(1, selfWeight))
    : (Number.isFinite(envSelf) ? envSelf : 0.2); // default 20%
  const wPeer = 1 - wSelf; // 80%

  const score = Math.round(((self * wSelf) + (peerAvg * wPeer)) * 100) / 100;
  return { score, wSelf, wPeer };
}
