// backend/src/utils/announceHours.js
function toMinutes(t) {
  if (!t) return null; // "HH:MM:SS" or "HH:MM"
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(t));
  if (!m) return null;
  return (+m[1]) * 60 + (+m[2]);
}
function daysInclusive(d1, d2) {
  const a = new Date(d1);
  const b = d2 ? new Date(d2) : new Date(d1);
  a.setHours(0,0,0,0); b.setHours(0,0,0,0);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}
exports.calcAnnouncementHours = (ann) => {
  const minsStart = toMinutes(ann.work_time_start);
  const minsEnd   = toMinutes(ann.work_time_end);
  const perDayHrs = (minsStart!=null && minsEnd!=null && minsEnd>minsStart)
    ? (minsEnd - minsStart) / 60
    : 6; // fallback
  const nDays = daysInclusive(ann.work_date, ann.work_end);
  return Math.round(perDayHrs * nDays);
};
