/* ============================================================================
 * 1) Language (ภาษา) - ปรับใหม่ตามเกณฑ์มหาวิทยาลัย
 * CEPT: A1=40%, A2=55%, B1=70%(เกณฑ์จบ), B2=85%, C1=95%, C2=100%
 * ==========================================================================*/
export const CEPT_LEVEL_TO_PCT = {
  A1: 40,
  A2: 55,
  B1: 70,  // เกณฑ์ขั้นต่ำสำหรับจบการศึกษา
  B2: 85,
  C1: 95,
  C2: 100
};

export function scoreLang(level) {
  // คืนค่าเป็น % โดยตรง (0-100)
  const percent = CEPT_LEVEL_TO_PCT[level] ?? 0;
  return { score: percent, percent };
}

/**
 * Normalize peer/self score → 0..100
 * @param {number} v - ค่าคะแนน
 * @param {boolean} isScale1to5 - true ถ้าค่าเป็นสเกล 1-5, false ถ้าเป็น 0-100
 * @returns {number} คะแนน 0-100
 */
export function normalizePeerScore(v, isScale1to5 = null) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;

  // ถ้าระบุ isScale1to5 ให้ใช้ตามนั้น
  if (isScale1to5 === true) {
    // สเกล 1-5 → 0-100: (score-1)/4 * 100
    const clamped = Math.max(1, Math.min(5, n));
    return Math.round(((clamped - 1) / 4) * 100);
  }
  if (isScale1to5 === false) {
    // สเกล 0-100
    return Math.round(Math.max(0, Math.min(100, n)));
  }

  // ถ้าไม่ระบุ ให้เดา: ถ้า <= 5 และไม่ใช่ 0 น่าจะเป็นสเกล 1-5
  // แต่เพื่อความปลอดภัย ให้ clamp 0-100 เลย (ไม่เดา)
  return Math.round(Math.max(0, Math.min(100, n)));
}

/* ============================================================================
 * 2) Technology (เทคโนโลยี) - ปรับใหม่
 * - ICT ผ่าน (≥50%) = 20%
 * - ITPE IP (≥55%) = 30%, ITPE FE (≥60%) = 50%
 * - Training: 5% ต่อ course (สูงสุด 20%)
 * - CEPT score as tech skill bonus (สูงสุด 10%)
 * ==========================================================================*/
export function scoreTech(trainCount, ictPct, itpePct, ceptObj) {
  let totalScore = 0;

  // 1) ICT Digital Literacy (0-20%)
  const ict = Math.max(0, Math.min(100, Number(ictPct ?? 0)));
  if (ict >= 50) {
    // ผ่าน ICT ได้ 20% + bonus ตามคะแนนที่เกิน 50
    totalScore += 20 + Math.min(10, (ict - 50) / 5);
  } else if (ict > 0) {
    // ไม่ผ่านแต่มีคะแนน ได้ตามสัดส่วน (สูงสุด 15%)
    totalScore += (ict / 50) * 15;
  }

  // 2) ITPE (0-50%)
  const itpe = Math.max(0, Math.min(100, Number(itpePct ?? 0)));
  if (itpe >= 60) {
    // ผ่าน FE level
    totalScore += 50;
  } else if (itpe >= 55) {
    // ผ่าน IP level
    totalScore += 30 + ((itpe - 55) / 5) * 20;
  } else if (itpe > 0) {
    // ไม่ผ่านแต่มีคะแนน
    totalScore += (itpe / 55) * 25;
  }

  // 3) Training courses (5% ต่อ course, สูงสุด 20%)
  const trainingScore = Math.min(20, (Number(trainCount) || 0) * 5);
  totalScore += trainingScore;

  // 4) CEPT as tech bonus (สูงสุด 10%)
  let ceptBonus = 0;
  if (ceptObj?.level) {
    const ceptPct = CEPT_LEVEL_TO_PCT[ceptObj.level] || 0;
    ceptBonus = Math.min(10, ceptPct / 10);
  } else if (ceptObj?.score_raw != null) {
    const raw = Math.max(0, Math.min(50, Number(ceptObj.score_raw)));
    ceptBonus = Math.min(10, (raw / 50) * 10);
  }
  totalScore += ceptBonus;

  // Cap at 100%
  const percent = Math.round(Math.min(100, totalScore));
  return { score: percent, percent };
}

/* ============================================================================
 * 3) Academic (วิชาการ / GPA) - ปรับใหม่
 * GPA 0-4 แปลงเป็น 0-100% โดย GPA 2.0 = 50%, GPA 3.0 = 75%, GPA 4.0 = 100%
 * ==========================================================================*/
export const GRADE_OPTIONS = ["", "A", "B+", "B", "C+", "C", "D+", "D", "F", "S", "U"];
export const GRADE_POINTS = { A: 4.0, "B+": 3.5, B: 3.0, "C+": 2.5, C: 2.0, "D+": 1.5, D: 1.0, F: 0.0 };
export const ACADEMIC_DEFAULT_WEIGHTS = { wGpa: 0.6, wCore: 0.4 };

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

/**
 * แปลง GPA (0-4) เป็น % (0-100)
 * เกณฑ์: GPA 2.0 = 50%, GPA 4.0 = 100%
 */
export function gpaToPercent(gpa) {
  const g = Math.max(0, Math.min(4, Number(gpa) || 0));
  // สูตร: (gpa / 4) * 100 แบบ linear
  // หรือใช้ weighted ให้ GPA ต่ำได้คะแนนน้อยกว่า
  if (g < 2.0) {
    // GPA 0-2 = 0-50%
    return Math.round((g / 2.0) * 50);
  }
  // GPA 2-4 = 50-100%
  return Math.round(50 + ((g - 2.0) / 2.0) * 50);
}

export function acadFromManualGPA(gpaInput) {
  const gpa = Math.max(0, Math.min(4, Number(gpaInput || 0)));
  const percent = gpaToPercent(gpa);
  return { gpa, score: percent, percent, source: "manual" };
}

export function acadScoreFromCourses(courses = []) {
  const { gpa } = computeGPA(courses);
  const percent = gpaToPercent(gpa);
  return { gpa, score: percent, percent, source: "required" };
}

export function acadCombined(manualGpa, courses = [], weights = ACADEMIC_DEFAULT_WEIGHTS) {
  const wGpa = Number.isFinite(weights?.wGpa) ? weights.wGpa : 0.6;
  const wCore = Number.isFinite(weights?.wCore) ? weights.wCore : 0.4;
  const wSum = wGpa + wCore || 1;

  const m = manualGpa ? acadFromManualGPA(manualGpa) : null;
  const r = courses?.length ? acadScoreFromCourses(courses) : null;

  if (!m && !r) return { score: 0, percent: 0, parts: {}, weights: { wGpa, wCore } };
  if (m && !r) return { score: m.percent, percent: m.percent, parts: { m }, weights: { wGpa: 1, wCore: 0 } };
  if (!m && r) return { score: r.percent, percent: r.percent, parts: { r }, weights: { wGpa: 0, wCore: 1 } };

  const percent = Math.round(((m.percent * wGpa + r.percent * wCore) / wSum));
  return { score: percent, percent, parts: { m, r }, weights: { wGpa, wCore } };
}

/**
 * คำนวณคะแนนวิชาการจาก manual GPA และ/หรือ backend scores
 * - manualGpa: GPA ที่นิสิตกรอกเอง (0-4)
 * - scoreGpa25: คะแนน GPA จาก backend (สเกล 0-25)
 * - scoreCore15: คะแนนวิชาแกนจาก backend (สเกล 0-15)
 */
export function scoreAcademic({ manualGpa, scoreGpa25, scoreCore15, weights = ACADEMIC_DEFAULT_WEIGHTS } = {}) {
  const wGpa = weights?.wGpa ?? 0.6;
  const wCore = weights?.wCore ?? 0.4;

  // แปลง manual GPA เป็น %
  let gpaPct = null;
  if (Number.isFinite(Number(manualGpa)) && Number(manualGpa) > 0) {
    gpaPct = gpaToPercent(Number(manualGpa));
  }

  // แปลง backend GPA score (0-25) เป็น % (0-100)
  const backendGpaPct = scoreGpa25 != null ? Math.round((Number(scoreGpa25) / 25) * 100) : null;

  // ใช้ manual ก่อน ถ้าไม่มีใช้ backend
  const finalGpaPct = gpaPct ?? backendGpaPct ?? 0;

  // แปลง core score (0-15) เป็น % (0-100)
  const corePct = scoreCore15 != null ? Math.round((Number(scoreCore15) / 15) * 100) : 0;

  // รวมคะแนน
  const percent = Math.round((finalGpaPct * wGpa) + (corePct * wCore));

  return {
    score: percent,
    percent,
    parts: { gpaPct: finalGpaPct, corePct },
    weights: { wGpa, wCore }
  };
}

/* ============================================================================
 * 4) Activities (สังคม / สื่อสาร) - ปรับใหม่
 * เป้าหมาย: 20 ชั่วโมง = 100% (ลดจาก 40 ชม.)
 * Staff multiplier: 1.5x
 * ==========================================================================*/
export const ROLE_MULTIPLIERS = { participant: 1.0, staff: 1.5, leader: 2.0 };

/**
 * เกณฑ์กิจกรรมสังคม ตามมาตรฐานมหาวิทยาลัย:
 * - กิจกรรมกลาง: ≥6 กิจกรรม, ≥30 ชม.
 * - กิจกรรมคณะ: ≥8 กิจกรรม, ≥40 ชม.
 * - กิจกรรมเสรี: ≥4 กิจกรรม, ≥20 ชม.
 * รวม: 18 กิจกรรม, 90 ชม. = 100%
 */
export const SOCIAL_CRITERIA = {
  central: { minActivities: 6, minHours: 30, weight: 0.33 },  // กิจกรรมกลาง
  faculty: { minActivities: 8, minHours: 40, weight: 0.45 },  // กิจกรรมคณะ
  elective: { minActivities: 4, minHours: 20, weight: 0.22 }, // กิจกรรมเสรี
};
export const TARGET_HOURS_SOCIAL = 90;  // รวมทั้งหมด
export const TARGET_ACTIVITIES_SOCIAL = 18;
export const TARGET_HOURS_COMM = 20;

export function getRoleMultiplier(role = "", table = ROLE_MULTIPLIERS) {
  const r = String(role).toLowerCase();
  if (/(leader|หัวหน้า|ประธาน)/.test(r)) return table.leader || 2.0;
  if (/(staff|เจ้าหน้าที่|สตาฟ|กรรมการ)/.test(r)) return table.staff;
  if (/(participant|ผู้เข้าร่วม)/.test(r)) return table.participant;
  return 1.0;
}

/**
 * คำนวณคะแนนกิจกรรมสังคมแบบละเอียดตามประเภท
 * @param {Array} activities - รายการกิจกรรม (ต้องมี category: 'central'|'faculty'|'elective')
 * @returns {Object} { totalPercent, breakdown }
 */
export function scoreSocialActivities(activities = []) {
  const breakdown = {
    central: { count: 0, hours: 0, percent: 0 },
    faculty: { count: 0, hours: 0, percent: 0 },
    elective: { count: 0, hours: 0, percent: 0 },
  };

  // นับกิจกรรมและชั่วโมงแยกตามประเภท
  for (const a of activities) {
    const cat = String(a?.category || a?.type || 'elective').toLowerCase();
    const hrs = Number(a?.hours ?? 0) || 3; // default 3 ชม.
    const mul = getRoleMultiplier(a?.role);
    const effectiveHours = hrs * mul;

    if (cat.includes('central') || cat.includes('กลาง') || cat === 'university') {
      breakdown.central.count++;
      breakdown.central.hours += effectiveHours;
    } else if (cat.includes('faculty') || cat.includes('คณะ') || cat === 'department') {
      breakdown.faculty.count++;
      breakdown.faculty.hours += effectiveHours;
    } else {
      breakdown.elective.count++;
      breakdown.elective.hours += effectiveHours;
    }
  }

  // คำนวณ % แต่ละประเภท (ดูทั้งจำนวนกิจกรรมและชั่วโมง)
  for (const [key, criteria] of Object.entries(SOCIAL_CRITERIA)) {
    const data = breakdown[key];
    const actPct = Math.min(100, (data.count / criteria.minActivities) * 100);
    const hrsPct = Math.min(100, (data.hours / criteria.minHours) * 100);
    // ใช้ค่าต่ำสุดระหว่างจำนวนกิจกรรมและชั่วโมง (ต้องผ่านทั้งสองเกณฑ์)
    data.percent = Math.round(Math.min(actPct, hrsPct));
  }

  // รวมคะแนนตาม weight
  const totalPercent = Math.round(
    breakdown.central.percent * SOCIAL_CRITERIA.central.weight +
    breakdown.faculty.percent * SOCIAL_CRITERIA.faculty.weight +
    breakdown.elective.percent * SOCIAL_CRITERIA.elective.weight
  );

  return { totalPercent: Math.min(100, totalPercent), breakdown };
}

export function activityPointsPerHour(
  activities = [],
  { perHour = 1, defaultHours = 3, roleMultipliers = ROLE_MULTIPLIERS, capPoints = Infinity } = {}
) {
  let total = 0;
  for (const a of activities) {
    const hrs = Number(a?.hours ?? 0) || defaultHours;
    const mul = getRoleMultiplier(a?.role, roleMultipliers);
    total += hrs * perHour * mul;
  }
  return Math.min(total, capPoints);
}

export function pointsToPercent(points, targetPoints = TARGET_HOURS_SOCIAL) {
  const p = Math.max(0, Number(points || 0));
  const t = Math.max(1, Number(targetPoints || 1));
  return Math.round(Math.min(100, (p / t) * 100));
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

export function scoreFromHours(h, targetHours = 20) {
  const x = Number(h || 0);
  if (!x) return 0;
  return Math.round(Math.min(100, (x / targetHours) * 100));
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
  targetPointsSocial = TARGET_HOURS_SOCIAL,
  targetPointsComm = TARGET_HOURS_COMM,
} = {}) {
  // คะแนนแต่ละด้านเป็น % (0-100) แล้ว
  const pAcad = Math.min(100, Math.max(0, Number(acadScore) || 0));
  const pLang = Math.min(100, Math.max(0, Number(langScore) || 0));
  const pTech = Math.min(100, Math.max(0, Number(techScore) || 0));

  // คำนวณกิจกรรมจากชั่วโมง
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

  // Normalize inputs to 0-100
  const selfScore = Math.max(0, Math.min(100, Number(self) || 0));
  const peerScore = Math.max(0, Math.min(100, Number(peerAvg) || 0));

  const score = Math.round((selfScore * wSelf) + (peerScore * wPeer));
  return { score, wSelf, wPeer };
}
