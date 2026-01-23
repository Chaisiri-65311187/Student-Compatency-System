// src/utils/announcementHelpers.js
// Shared utilities for announcement-related pages

export const tz = "Asia/Bangkok";

export const toISODate = (s) => {
    if (!s) return null;
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
};

export const toHHMM = (s) => {
    if (!s) return null;
    const m = /^(\d{2}):?(\d{2})/.exec(String(s));
    return m ? `${m[1]}:${m[2]}` : null;
};

export const parseSafe = (s) => (s ? new Date(s) : null);

export const dateTH = (s) => {
    const d = parseSafe(s);
    if (!d || isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("th-TH", {
        timeZone: tz,
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(d);
};

export const timeHM = (t) => (t ? String(t).slice(0, 5) : "");

export const lineFromPeriod = (p) => {
    const a = toISODate(p.startDate || p.start_date);
    const b = toISODate(p.endDate || p.end_date || p.startDate || p.start_date);
    const date = a && b && a !== b ? `${dateTH(a)} – ${dateTH(b)}` : dateTH(a || b);
    const startT = p.startTime || p.start_time;
    const endT = p.endTime || p.end_time;
    const time = startT || endT ? ` (${timeHM(startT) || "—"}–${timeHM(endT) || "—"})` : "";
    return `${date}${time}`;
};

export const toDateInput = (v) => {
    if (!v) return "";
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
};

export const toTimeInput = (v) => {
    if (!v) return "";
    const m = /^(\d{2}):?(\d{2})/.exec(String(v));
    return m ? `${m[1]}:${m[2]}` : "";
};

// Static options
export const DEPTS = ["ทั้งสองสาขา", "วิทยาการคอมพิวเตอร์", "เทคโนโลยีสารสนเทศ"];
export const YEARS = [1, 2, 3, 4];
export const ACTIVITY_CATS = [
    { value: "university", label: "กิจกรรมกลาง" },
    { value: "faculty", label: "กิจกรรมคณะ" },
    { value: "free", label: "กิจกรรมเสรี" },
];
export const STATUSES = ["open", "closed", "archived"];
export const ROLE_OPTIONS = [
    { value: "student", label: "นิสิต" },
    { value: "teacher", label: "อาจารย์" },
    { value: "all", label: "ทุกกลุ่ม" },
];

export const STATUS_LABEL = {
    open: "เปิดรับ",
    closed: "ปิดรับ",
    archived: "เก็บถาวร",
    pending: "รอดำเนินการ",
    accepted: "อนุมัติแล้ว",
    rejected: "ปฏิเสธแล้ว",
    completed: "ได้รับชั่วโมงแล้ว",
};

export const STATUS_CLASS = {
    open: "badge text-bg-success",
    closed: "badge text-bg-secondary",
    archived: "badge text-bg-dark",
    pending: "badge text-bg-secondary",
    accepted: "badge text-bg-success",
    rejected: "badge text-bg-danger",
    completed: "badge text-bg-info",
};

// Shared CSS styles
export const sharedPageStyles = `
  .bg-animated {
    background: radial-gradient(1200px 600px at 10% -10%, #efe7ff 15%, transparent 60%),
                radial-gradient(1000px 500px at 110% 10%, #e6f0ff 10%, transparent 55%),
                linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%);
  }
  .glassy { backdrop-filter: blur(8px); }
  .topbar {
    position: sticky;
    top: 0;
    left: 0;
    width: 100%;
    background: linear-gradient(90deg, rgba(111,66,193,.9), rgba(142,92,255,.9));
    box-shadow: 0 4px 16px rgba(111,66,193,.22);
    z-index: 1040;
    border-bottom: 1px solid rgba(255,255,255,.12);
  }
  .glass-card {
    backdrop-filter: blur(6px);
    transition: transform .15s ease, box-shadow .15s ease;
  }
  .glass-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 30px rgba(28,39,49,.12)!important;
  }
  .form-control:focus {
    box-shadow: 0 0 0 .2rem rgba(111,66,193,.12);
    border-color: #8e5cff;
  }
  .ripple { position: relative; overflow: hidden; }
  .ripple:after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    opacity: 0;
    background: radial-gradient(circle at var(--x,50%) var(--y,50%), rgba(255,255,255,.45), transparent 40%);
    transform: scale(.2);
    transition: transform .3s, opacity .45s;
    pointer-events: none;
  }
  .ripple:active:after { opacity: 1; transform: scale(1); transition: 0s; }
  .ripple { --x: 50%; --y: 50%; }
  .ripple:focus-visible { outline: 3px solid rgba(142,92,255,.45); outline-offset: 2px; }
  .bg-blob { position: absolute; filter: blur(60px); opacity: .55; z-index: 0; pointer-events: none; }
  .bg-blob-1 { width: 420px; height: 420px; left: -120px; top: -80px; background: #d7c6ff; animation: drift1 18s ease-in-out infinite; }
  .bg-blob-2 { width: 360px; height: 360px; right: -120px; top: 120px; background: #c6ddff; animation: drift2 22s ease-in-out infinite; }
  .bg-blob-3 { width: 300px; height: 300px; left: 15%; bottom: -120px; background: #ffd9ec; animation: drift3 20s ease-in-out infinite; }
  @keyframes drift1 { 0%,100% { transform: translate(0,0) } 50% { transform: translate(20px,10px) } }
  @keyframes drift2 { 0%,100% { transform: translate(0,0) } 50% { transform: translate(-16px,8px) } }
  @keyframes drift3 { 0%,100% { transform: translate(0,0) } 50% { transform: translate(12px,-12px) } }
`;
