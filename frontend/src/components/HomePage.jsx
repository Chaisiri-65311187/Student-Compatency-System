// src/components/HomePage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getCompetencyProfile } from "../services/competencyApi";
import {
  listAnnouncements,
  listMyApplications,
  applyAnnouncement,
  withdrawApplication,
  getAnnouncement,
} from "../services/announcementsApi";
import PeerEvaluationForm from "./competency/PeerEvaluationForm";
import { ACTIVITY_CATS } from "../utils/announcementHelpers";

/* ===== Date helpers (TH) ===== */
const tz = "Asia/Bangkok";
const parseSafeDate = (s) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
};
const dateTH = (d) => {
  const dt = parseSafeDate(d);
  if (!dt) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: tz, day: "2-digit", month: "short", year: "numeric",
  }).format(dt);
};
const timeHM = (t) => {
  if (!t) return "";
  if (typeof t === "string") {
    const hhmm = t.match(/^(\d{2}):?(\d{2})/);
    if (hhmm) return `${hhmm[1]}:${hhmm[2]}`;
  }
  try {
    const dt = new Date(`1970-01-01T${t}`);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleTimeString("th-TH", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
    }
  } catch { }
  return String(t).slice(0, 5);
};
const rangeLine = (p) => {
  const date =
    p?.end_date && p.end_date !== p.start_date
      ? `${dateTH(p.start_date)} – ${dateTH(p.end_date)}`
      : dateTH(p?.start_date);
  const time =
    p?.start_time || p?.end_time
      ? ` (${timeHM(p.start_time) || "—"}–${timeHM(p.end_time) || "—"})`
      : "";
  return `${date}${time}`;
};

/* ===== UI const ===== */
const PURPLE = "#6f42c1";

/* ===== Normalizer & close rules ===== */
function normalizeAnnouncement(r) {
  const rawCap = r.capacity ?? r.seats;
  const capacity =
    rawCap == null || String(rawCap).trim() === "" ? null : Number(rawCap);

  const acceptedLike = [
    r.accepted_count, r.approved_count, r.filled, r.current,
    r.applied_count, r.app_count, r.accepted, r.count
  ]
    .map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0))
    .reduce((a, b) => Math.max(a, b), 0);

  const completed = Number(r.completed_count || 0);
  const applicants = Number(r.applicants_count || 0);
  const occupiedBase = Math.max(acceptedLike, applicants);
  const occupied = occupiedBase + completed;
  const remaining = capacity == null ? null : Math.max(0, capacity - occupied);

  return {
    id: r.id,
    title: r.title,
    teacher: r.teacher || r.teacher_name || r.owner_name || "-",
    description: r.description || "",
    department: r.department || "ไม่จำกัด",
    year: Number(r.year) || null,
    work_date: r.work_date || null,
    work_end: r.work_end || null,
    work_periods: Array.isArray(r.work_periods) ? r.work_periods
      : Array.isArray(r.periods) ? r.periods : [],
    deadline: r.deadline || null,
    status: r.status || "open",
    location: r.location || "",
    capacity,
    accepted_count: acceptedLike,
    completed_count: completed,
    applicants_count: applicants,
    remaining,
    finished: r.finished || r.is_finished || false,
    activity_category: r.activity_category,
    work_time_start: r.work_time_start,
    work_time_end: r.work_time_end,
  };
}
function isClosed(a) {
  const now = new Date();
  const statusStr = String(a.status || "").toLowerCase();
  const notExplicitlyOpen = !["open", "เปิดรับ"].includes(statusStr);
  const dl = parseSafeDate(a.deadline);
  const deadlinePassed = !!dl && dl < now;
  const periodsOver =
    Array.isArray(a.work_periods) &&
    a.work_periods.length > 0 &&
    a.work_periods.every((p) => {
      const ed = parseSafeDate(p.end_date || p.start_date);
      return !!ed && ed < now;
    });
  const cap = Number.isFinite(Number(a.capacity)) ? Number(a.capacity) : null;
  const full = cap != null && (a.remaining ?? 0) <= 0;
  const finishedFlag = !!a.finished || !!a.is_finished;
  const hasCompleted = Number(a.completed_count || 0) > 0;
  return notExplicitlyOpen || deadlinePassed || periodsOver || full || finishedFlag || hasCompleted;
}

export default function HomePage() {
  // Filters
  const [filterYear, setFilterYear] = useState({ year1: false, year2: false, year3: false, year4: false });
  const [filterDepartment, setFilterDepartment] = useState({ cs: false, it: false });
  const [searchTerm, setSearchTerm] = useState("");

  // Data
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");

  // สมัครของฉัน
  const [myAppStatus, setMyAppStatus] = useState({}); // { [announcement_id]: status }

  // Auth / nav
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Peer eval
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const periodKey = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const sem = m <= 5 ? 1 : 2;
    return `${y}-${sem}`;
  }, []);
  const [peerModalOpen, setPeerModalOpen] = useState(false);
  const openPeerModal = () => setPeerModalOpen(true);
  const closePeerModal = () => setPeerModalOpen(false);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      try {
        setLoadingProfile(true);
        const prof = await getCompetencyProfile(user.id);
        if (!alive) return;
        setProfile(prof || null);
      } catch {
        if (!alive) return;
        setProfile(null);
      } finally {
        if (alive) setLoadingProfile(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  // Modal (announcement detail)
  const [showModal, setShowModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  // แจ้งเตือน
  const NOTI_KEY = user?.id ? `notif_seen_v1_${user.id}` : "notif_seen_v1_anonymous";
  const [notiOpen, setNotiOpen] = useState(false);
  const [notifItems, setNotifItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const searchRef = useRef(null);

  // map id -> title
  const annTitleById = useMemo(() => {
    const m = {};
    (announcements || []).forEach((a) => { m[a.id] = a.title; });
    return m;
  }, [announcements]);

  const loadSeen = () => {
    try { const s = JSON.parse(localStorage.getItem(NOTI_KEY) || "[]"); return new Set(s.map(String)); }
    catch { return new Set(); }
  };
  const saveSeen = (idsSet) => { localStorage.setItem(NOTI_KEY, JSON.stringify(Array.from(idsSet))); };

  // โหลดประกาศ
  useEffect(() => {
    (async () => {
      setLoading(true); setLoadErr("");
      try {
        const data = await listAnnouncements({ status: "open" });
        const rows = Array.isArray(data) ? data
          : Array.isArray(data?.rows) ? data.rows
            : Array.isArray(data?.items) ? data.items : [];
        setAnnouncements(rows.map(normalizeAnnouncement));
      } catch (e) {
        setLoadErr(e?.message || "โหลดประกาศไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // โหลด “ประกาศที่ฉันสมัคร”
  useEffect(() => {
    const sid = Number(user?.id ?? 0);
    if (!Number.isFinite(sid) || sid <= 0) return; // กัน 400 จาก id ไม่ถูก
    let alive = true;
    (async () => {
      try {
        const data = await listMyApplications(sid);
        const items = Array.isArray(data) ? data : data?.items || [];
        const map = {};
        items.forEach((x) => { map[x.announcement_id] = x.status; });
        if (!alive) return;
        setMyAppStatus(map);

        // แจ้งเตือน: pending + accepted + completed
        const notifs = items
          .filter((x) => ["pending", "accepted", "completed"].includes(x.status))
          .map((x) => ({
            id: `${x.id}-${x.status}`,
            status: x.status,
            announcement_id: x.announcement_id,
            title: annTitleById[x.announcement_id] || `ประกาศ #${x.announcement_id}`,
            when: x.updated_at || x.approved_at || x.completed_at || x.created_at || null,
          }));
        const seen = loadSeen();
        setNotifItems(notifs);
        setUnreadCount(notifs.filter((n) => !seen.has(n.id)).length);
      } catch (e) {
        console.error("listMyApplications:", e?.message || e);
      }
    })();
    return () => { alive = false; };
  }, [user?.id, annTitleById]);

  // Poll แจ้งเตือนทุก 30 วิ
  useEffect(() => {
    const sid = Number(user?.id ?? 0);
    if (!Number.isFinite(sid) || sid <= 0) return;
    const timer = setInterval(async () => {
      try {
        const data = await listMyApplications(sid);
        const items = Array.isArray(data) ? data : data?.items || [];
        const notifs = items
          .filter((x) => ["pending", "accepted", "completed"].includes(x.status))
          .map((x) => ({
            id: `${x.id}-${x.status}`,
            status: x.status,
            announcement_id: x.announcement_id,
            title: annTitleById[x.announcement_id] || `ประกาศ #${x.announcement_id}`,
            when: x.updated_at || x.approved_at || x.completed_at || x.created_at || null,
          }));
        const seen = loadSeen();
        setNotifItems(notifs);
        setUnreadCount(notifs.filter((n) => !seen.has(n.id)).length);
      } catch { }
    }, 30000);
    return () => clearInterval(timer);
  }, [user?.id, annTitleById]);

  // Client filter
  const filteredAnnouncements = useMemo(() => {
    const yearActive = filterYear.year1 || filterYear.year2 || filterYear.year3 || filterYear.year4;
    const deptActive = filterDepartment.cs || filterDepartment.it;
    const kw = searchTerm.trim().toLowerCase();
    return announcements.filter((item) => {
      const byYear =
        !yearActive ||
        (filterYear.year1 && item.year === 1) ||
        (filterYear.year2 && item.year === 2) ||
        (filterYear.year3 && item.year === 3) ||
        (filterYear.year4 && item.year === 4);
      const byDept =
        !deptActive ||
        item.department === "ไม่จำกัด" ||
        (filterDepartment.cs && item.department === "วิทยาการคอมพิวเตอร์") ||
        (filterDepartment.it && item.department === "เทคโนโลยีสารสนเทศ");
      const byKW =
        !kw ||
        (item.title || "").toLowerCase().includes(kw) ||
        (item.teacher || "").toLowerCase().includes(kw) ||
        (item.description || "").toLowerCase().includes(kw);
      return byYear && byDept && byKW;
    });
  }, [announcements, filterYear, filterDepartment, searchTerm]);

  // Helpers
  const handleLogout = () => { logout(); navigate("/login"); };
  const openModal = (a) => { setSelectedAnnouncement(a); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setSelectedAnnouncement(null); };

  const StatusBadge = ({ status }) => {
    const map = { open: "badge text-bg-success", closed: "badge text-bg-secondary", archived: "badge text-bg-dark" };
    const label = status === "open" ? "เปิดรับ" : status === "closed" ? "ปิดรับ" : "เก็บถาวร";
    return <span className={map[status] || "badge text-bg-secondary"}>{label}</span>;
  };
  const Chip = ({ active, onClick, children }) => (
    <button
      type="button"
      onClick={onClick}
      className={`btn btn-sm me-2 mb-2 ${active ? "btn-primary" : "btn-outline-secondary"} chip ripple`}
      style={{ borderRadius: 999 }}
    >
      {children}
    </button>
  );
  const SkeletonCard = () => (
    <div className="col-md-6 col-lg-4">
      <div className="card shadow-sm border-0 rounded-4 overflow-hidden glass-card">
        <div className="ratio ratio-21x9 placeholder-wave" />
        <div className="card-body">
          <h5 className="card-title placeholder-wave"><span className="placeholder col-8"></span></h5>
          <p className="placeholder-wave mb-2"><span className="placeholder col-6"></span></p>
          <p className="placeholder-wave mb-2"><span className="placeholder col-4"></span></p>
        </div>
      </div>
    </div>
  );

  const refreshMyApps = async () => {
    const sid = Number(user?.id ?? 0);
    if (!Number.isFinite(sid) || sid <= 0) return;
    const data = await listMyApplications(sid);
    const items = Array.isArray(data) ? data : data?.items || [];
    const map = {};
    items.forEach((x) => { map[x.announcement_id] = x.status; });
    setMyAppStatus(map);
    return items;
  };

  const onApply = async (ann) => {
    const sid = Number(user?.id ?? 0);
    if (!Number.isFinite(sid) || sid <= 0) { alert("กรุณาเข้าสู่ระบบนิสิตก่อนสมัคร"); return; }

    // ตรวจซ้ำก่อนสมัคร
    try {
      const latest = await refreshMyApps();
      const m = {};
      (latest || []).forEach((x) => { m[x.announcement_id] = x.status; });
      if (["pending", "accepted", "completed", "awarded"].includes(m[ann.id])) {
        alert("คุณได้สมัคร/ได้รับการยืนยันในประกาศนี้แล้ว");
        return;
      }
    } catch { }

    // ดึงประกาศสดและเช็กปิด
    try {
      const fresh = await getAnnouncement(ann.id);
      const annFresh = normalizeAnnouncement(fresh);
      if (isClosed(annFresh)) {
        alert("ประกาศนี้ปิดรับแล้ว");
        setAnnouncements((prev) => prev.map((a) => (a.id === annFresh.id ? annFresh : a)));
        return;
      }
    } catch { }

    if (isClosed(ann)) { alert("ประกาศนี้ปิดรับแล้ว"); return; }
    if (!confirm(`ยืนยันการสมัครเข้าร่วม: ${ann.title}?`)) return;

    try {
      await applyAnnouncement(ann.id, sid);
      await refreshMyApps();
      alert("ยืนยันการสมัครเรียบร้อย (สถานะ: รอตรวจ)");
    } catch (e) {
      alert(e?.message || "สมัครไม่สำเร็จ");
    }
  };

  const onWithdraw = async (ann) => {
    const sid = Number(user?.id ?? 0);
    if (!Number.isFinite(sid) || sid <= 0) return;
    if (!confirm("ยืนยันถอนการสมัคร?")) return;
    try {
      await withdrawApplication(ann.id, sid);
      await refreshMyApps();
    } catch (e) {
      alert(e?.message || "ถอนสมัครไม่สำเร็จ");
    }
  };

  // แจ้งเตือน: action
  const markAllRead = () => {
    const seen = loadSeen();
    notifItems.forEach((n) => seen.add(n.id));
    saveSeen(seen);
    setUnreadCount(0);
  };
  const toggleNoti = () => setNotiOpen((v) => !v);
  const closeNotiPanel = () => setNotiOpen(false);

  // Hotkeys
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault(); searchRef.current?.focus();
      }
      if (e.key === 'Escape') closeNotiPanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // เรนเดอร์
  return (
    <div className="min-vh-100 position-relative  bg-animated">
      {/* Decorative background blobs */}
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
          <div className="ms-auto d-flex align-items-center gap-2 position-relative">
            <div className="text-white-50 d-none d-md-block">
              {user ? `${user.username} ${user.full_name || user.fullName || ""}` : "ไม่พบผู้ใช้"}
            </div>
            {/* 🔔 Bell */}
            <button type="button" className="btn btn-link text-white position-relative p-0 me-1 ripple" onClick={toggleNoti} title="การแจ้งเตือน" style={{ fontSize: 20, lineHeight: 1 }}>
              <i className="bi bi-bell"></i>
              {unreadCount > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: ".7rem" }}>{unreadCount}</span>
              )}
            </button>
            {/* แผงแจ้งเตือน */}
            {notiOpen && (
              <div className="card shadow border-0 rounded-3" style={{ position: "absolute", right: 0, top: "110%", width: 360, zIndex: 2000 }} onMouseLeave={closeNotiPanel}>
                <div className="card-header d-flex justify-content-between align-items-center py-2">
                  <div className="fw-semibold">การแจ้งเตือน</div>
                  <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill ripple" onClick={markAllRead} disabled={unreadCount === 0}>อ่านทั้งหมดแล้ว</button>
                </div>
                <div className="list-group list-group-flush" style={{ maxHeight: 360, overflowY: "auto" }}>
                  {notifItems.length === 0 ? (
                    <div className="text-muted small text-center py-3">ไม่มีการแจ้งเตือน</div>
                  ) : (
                    notifItems.map((n) => {
                      const seen = loadSeen().has(n.id);
                      const titleText =
                        n.status === "completed" ? "ได้รับชั่วโมงแล้ว" :
                          n.status === "accepted" ? "ได้รับการอนุมัติ" :
                            "ยืนยันสมัครแล้ว (รอตรวจ)";
                      return (
                        <div key={n.id} className="list-group-item">
                          <div className="d-flex">
                            <div className="me-2"><i className={`bi ${seen ? "bi-check-circle" : "bi-dot"} fs-5`} /></div>
                            <div className="flex-grow-1">
                              <div className="fw-semibold">{titleText}</div>
                              <div className="small"><span className="text-muted">ประกาศ:</span> {n.title}</div>
                              <div className="small text-muted">เวลา: {n.when ? dateTH(n.when) : "-"}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            <button className="btn btn-light btn-sm rounded-pill ripple" onClick={handleLogout}>ออกจากระบบ</button>
          </div>
        </div>
      </div>

      <div className="container-xxl py-4 position-relative" style={{ zIndex: 1 }}>
        <div className="row g-4">
          {/* Sidebar Filters */}
          <div className="col-12 col-xl-3">
            <div className="card border-0 shadow-sm rounded-4" style={{ position: "sticky", top: 96 }}>
              <div className="card-body">
                <div className="small text-uppercase text-muted fw-semibold mb-2">ตัวกรอง</div>
                <div className="mb-3">
                  <div className="small text-muted mb-1">ชั้นปี</div>
                  <Chip active={filterYear.year1} onClick={() => setFilterYear((p) => ({ ...p, year1: !p.year1 }))}>ปี 1</Chip>
                  <Chip active={filterYear.year2} onClick={() => setFilterYear((p) => ({ ...p, year2: !p.year2 }))}>ปี 2</Chip>
                  <Chip active={filterYear.year3} onClick={() => setFilterYear((p) => ({ ...p, year3: !p.year3 }))}>ปี 3</Chip>
                  <Chip active={filterYear.year4} onClick={() => setFilterYear((p) => ({ ...p, year4: !p.year4 }))}>ปี 4</Chip>
                </div>
                <div>
                  <div className="small text-muted mb-1">สาขา</div>
                  <Chip active={filterDepartment.cs} onClick={() => setFilterDepartment((p) => ({ ...p, cs: !p.cs }))}>วิทยาการคอมพิวเตอร์</Chip>
                  <Chip active={filterDepartment.it} onClick={() => setFilterDepartment((p) => ({ ...p, it: !p.it }))}>เทคโนโลยีสารสนเทศ</Chip>
                </div>
                <div className="mt-2 small text-muted">ไม่เลือก = แสดงทั้งหมด</div>
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="col-12 col-xl-9">
            {/* Toolbar */}
            <div className="card border-0 shadow-sm rounded-4 mb-3">
              <div className="card-body d-flex flex-wrap gap-2 align-items-center">
                <h4 className="mb-0 me-auto">ประกาศรับสมัครจากอาจารย์</h4>
                <div className="position-relative me-2 flex-grow-1 flex-md-grow-0" style={{ minWidth: 260 }}>
                  <i className="bi bi-search position-absolute" style={{ left: 10, top: "50%", transform: "translateY(-50%)", opacity: .5 }}></i>
                  <input
                    id="searchAnnouncements"
                    name="searchAnnouncements"
                    ref={searchRef}
                    type="text"
                    className="form-control rounded-pill ps-5"
                    placeholder="กด / เพื่อค้นหา (ชื่อประกาศ / อาจารย์ / รายละเอียด)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <button type="button" className="btn btn-outline-primary rounded-pill ripple" onClick={() => navigate("/competency/form")}>ข้อมูลสมรรถนะ</button>
                <button type="button" className="btn btn-outline-primary rounded-pill ripple" onClick={() => navigate("/profile")}>Profile</button>

                {user?.role === "student" && (
                  <button className="btn btn-primary btn-sm rounded-pill" onClick={openPeerModal}>
                    ประเมินเพื่อน
                  </button>
                )}
              </div>
            </div>

            {/* Results */}
            {loading ? (
              <div className="row g-4">{Array.from({ length: 6 }).map((_, i) => (<div className="col-md-6 col-lg-4" key={i}><div className="card shadow-sm border-0 rounded-4 overflow-hidden glass-card"><div className="ratio ratio-21x9 placeholder-wave" /><div className="card-body"><h5 className="card-title placeholder-wave"><span className="placeholder col-8"></span></h5><p className="placeholder-wave mb-2"><span className="placeholder col-6"></span></p><p className="placeholder-wave mb-2"><span className="placeholder col-4"></span></p></div></div></div>))}</div>
            ) : loadErr ? (
              <div className="alert alert-danger rounded-4">เกิดข้อผิดพลาด: {loadErr}</div>
            ) : filteredAnnouncements.length === 0 ? (
              <div className="text-center py-5 card border-0 shadow-sm rounded-4"><div className="card-body"><h5 className="mb-1">ไม่พบประกาศที่ตรงกับการค้นหา</h5><div className="text-muted">ลองลบตัวกรองหรือเปลี่ยนคำค้นหา</div></div></div>
            ) : (
              <div className="row g-4">
                {filteredAnnouncements.map((item) => {
                  const myStatus = myAppStatus[item.id];
                  const closed = isClosed(item);
                  const deptBadge = item.department && item.department !== 'ไม่จำกัด' ? item.department : null;
                  const pct = item.capacity != null ? Math.min(100, Math.round(((item.capacity - (item.remaining ?? 0)) / item.capacity) * 100)) : null;
                  const catLabel = ACTIVITY_CATS.find((c) => c.value === item.activity_category)?.label || "กิจกรรม";
                  const catColor = item.activity_category === 'university' ? 'text-bg-warning'
                    : item.activity_category === 'faculty' ? 'text-bg-info'
                      : item.activity_category === 'free' ? 'text-bg-success'
                        : 'text-bg-light text-dark border';

                  let rightButton = null;
                  if (myStatus === "completed" || myStatus === "awarded") {
                    rightButton = (<span className="badge text-bg-success rounded-pill px-3 py-2">✅ ได้รับชั่วโมงแล้ว</span>);
                  } else if (myStatus === "pending" || myStatus === "accepted") {
                    rightButton = (
                      <button className="btn btn-outline-danger rounded-pill ripple" onClick={() => onWithdraw(item)}>
                        ❌ ถอนสมัคร
                      </button>
                    );
                  } else if (closed) {
                    rightButton = (
                      <span className="badge text-bg-secondary rounded-pill px-3 py-2">
                        {item.remaining === 0 ? "🔴 เต็มแล้ว" : "🔒 ปิดรับ"}
                      </span>
                    );
                  } else {
                    rightButton = (
                      <button className="btn btn-success rounded-pill ripple shadow-sm" onClick={() => onApply(item)}>
                        ✨ สมัครเลย
                      </button>
                    );
                  }

                  return (
                    <div key={item.id} className="col-md-4 col-lg-5">
                      <div className="card shadow-sm border-0 rounded-4 overflow-hidden h-100"
                        style={{ transition: 'transform 0.2s, box-shadow 0.2s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 15px 35px rgba(111,66,193,0.15)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}>

                        {/* Card Header with Gradient */}
                        <div className="p-3 text-white position-relative" style={{ background: `linear-gradient(135deg, ${PURPLE}, #b388ff)` }}>
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              {item.year && (
                                <span className="badge bg-white text-dark rounded-pill mb-2 shadow-sm me-1">
                                  📚 ชั้นปี {item.year}
                                </span>
                              )}
                              <span className={`badge ${catColor} rounded-pill mb-2 shadow-sm`}>
                                {catLabel}
                              </span>
                              <h6 className="fw-bold mb-0 text-truncate" title={item.title} style={{ maxWidth: 220 }}>
                                {item.title}
                              </h6>
                            </div>
                            <StatusBadge status={item.status} />
                          </div>
                        </div>

                        <div className="card-body d-flex flex-column">
                          <div className="text-muted small mb-2">
                            👨‍🏫 <span className="text-dark fw-semibold">{item.teacher}</span>
                            {deptBadge && <span className="badge bg-light text-dark ms-2">{deptBadge}</span>}
                          </div>

                          {/* Capacity Progress */}
                          {item.capacity != null && (
                            <div className="mb-2">
                              <div className="d-flex justify-content-between small text-muted mb-1">
                                <span>👥 ความจุ</span>
                                <span>{(item.capacity - (item.remaining ?? 0))} / {item.capacity}</span>
                              </div>
                              <div className="progress rounded-pill" style={{ height: 8 }}>
                                <div className={`progress-bar ${pct < 70 ? 'bg-success' : pct < 90 ? 'bg-warning' : 'bg-danger'}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )}

                          {Array.isArray(item.work_periods) && item.work_periods.length > 0 ? (
                            <div className="small mb-2 text-muted">
                              📅 {item.work_periods.map((p, i) => (<span key={i}>{rangeLine(p)}{i < item.work_periods.length - 1 ? ', ' : ''}</span>))}
                            </div>
                          ) : (item.work_date || item.work_end) && (
                            <div className="small mb-2 text-muted">
                              📅 {item.work_end && item.work_end !== item.work_date ? `${dateTH(item.work_date)} – ${dateTH(item.work_end)}` : dateTH(item.work_date)}
                              {item.work_time_start ? ` (${timeHM(item.work_time_start)}–${timeHM(item.work_time_end || "")})` : ""}
                            </div>
                          )}

                          {item.deadline && (
                            <div className="small text-danger mb-2">⏰ ปิดรับ {dateTH(item.deadline)}</div>
                          )}

                          {item.location && (
                            <div className="small text-muted mb-2">📍 {item.location}</div>
                          )}

                          {item.description && (
                            <p className="text-muted small mb-3 flex-grow-1" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {item.description}
                            </p>
                          )}

                          <div className="mt-auto d-flex gap-2">
                            <button className="btn btn-outline-primary flex-grow-1 rounded-pill ripple" onClick={() => { setSelectedAnnouncement(item); setShowModal(true); }}>
                              👁️ ดูรายละเอียด
                            </button>
                            {rightButton}
                          </div>

                          {myStatus && !["rejected", "pending", "accepted", "completed", "awarded"].includes(myStatus) && (
                            <div className="small text-muted mt-2 text-center">สถานะ: {myStatus}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: รายละเอียดประกาศ */}
      {showModal && selectedAnnouncement && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)", position: "fixed", inset: 0, overflowY: "auto", zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 overflow-hidden border-0 shadow-lg">
              {/* Gradient Header */}
              <div className="text-white p-4" style={{ background: `linear-gradient(135deg, ${PURPLE}, #b388ff)` }}>
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    {selectedAnnouncement.year && (
                      <span className="badge bg-white text-dark rounded-pill mb-2 me-1">📚 ชั้นปี {selectedAnnouncement.year}</span>
                    )}
                    {(() => {
                      const ac = selectedAnnouncement.activity_category;
                      const color = ac === 'university' ? 'text-bg-warning'
                        : ac === 'faculty' ? 'text-bg-info'
                          : ac === 'free' ? 'text-bg-success'
                            : 'text-bg-light text-dark border';
                      const label = ACTIVITY_CATS.find((c) => c.value === ac)?.label || "กิจกรรม";
                      return <span className={`badge ${color} rounded-pill mb-2`}>{label}</span>;
                    })()}
                    <h4 className="modal-title fw-bold mb-0">{selectedAnnouncement.title}</h4>
                    <div className="opacity-75 mt-1">👨‍🏫 {selectedAnnouncement.teacher}</div>
                  </div>
                  <button type="button" className="btn-close btn-close-white" onClick={() => { setShowModal(false); setSelectedAnnouncement(null); }}></button>
                </div>
              </div>

              <div className="modal-body">
                <div className="row g-3">
                  {/* Info Cards */}
                  <div className="col-6 col-md-3">
                    <div className="card border-0 bg-light rounded-3 text-center py-3">
                      <div style={{ fontSize: '1.5rem' }}>📋</div>
                      <div className="small text-muted">สถานะ</div>
                      <StatusBadge status={selectedAnnouncement.status} />
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card border-0 bg-light rounded-3 text-center py-3">
                      <div style={{ fontSize: '1.5rem' }}>👥</div>
                      <div className="small text-muted">รับ</div>
                      <div className="fw-bold">{selectedAnnouncement.remaining ?? "ไม่จำกัด"}{selectedAnnouncement.capacity != null && (<> / {selectedAnnouncement.capacity}</>)}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card border-0 bg-light rounded-3 text-center py-3">
                      <div style={{ fontSize: '1.5rem' }}>🏢</div>
                      <div className="small text-muted">สาขา</div>
                      <div className="fw-semibold small">{selectedAnnouncement.department}</div>
                    </div>
                  </div>
                  {selectedAnnouncement.deadline && (
                    <div className="col-6 col-md-3">
                      <div className="card border-0 bg-danger bg-opacity-10 rounded-3 text-center py-3">
                        <div style={{ fontSize: '1.5rem' }}>⏰</div>
                        <div className="small text-muted">ปิดรับ</div>
                        <div className="fw-semibold text-danger small">{dateTH(selectedAnnouncement.deadline)}</div>
                      </div>
                    </div>
                  )}

                  {/* Work Periods */}
                  <div className="col-12">
                    <div className="card border-0 bg-light rounded-3 p-3">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <span style={{ fontSize: '1.2rem' }}>📅</span>
                        <span className="fw-semibold">ช่วงวันที่ทำงาน</span>
                      </div>
                      {Array.isArray(selectedAnnouncement.work_periods) && selectedAnnouncement.work_periods.length > 0 ? (
                        <div className="small">{selectedAnnouncement.work_periods.map((p, i) => (<div key={i}>• {rangeLine(p)}</div>))}</div>
                      ) : (
                        <div className="small">
                          {selectedAnnouncement.work_end && selectedAnnouncement.work_end !== selectedAnnouncement.work_date
                            ? `${dateTH(selectedAnnouncement.work_date)} – ${dateTH(selectedAnnouncement.work_end)}`
                            : dateTH(selectedAnnouncement.work_date) || "ยังไม่ระบุ"}
                          {selectedAnnouncement.work_time_start && (
                            ` (${timeHM(selectedAnnouncement.work_time_start)} – ${timeHM(selectedAnnouncement.work_time_end || "")})`
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Location */}
                  {selectedAnnouncement.location && (
                    <div className="col-12">
                      <div className="d-flex align-items-center gap-2">
                        <span style={{ fontSize: '1.2rem' }}>📍</span>
                        <span><span className="text-muted">สถานที่:</span> <span className="fw-medium">{selectedAnnouncement.location}</span></span>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {selectedAnnouncement.description && (
                    <div className="col-12">
                      <div className="d-flex align-items-start gap-2">
                        <span style={{ fontSize: '1.2rem' }}>📝</span>
                        <div>
                          <div className="text-muted small mb-1">รายละเอียด</div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{selectedAnnouncement.description}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer border-0 bg-light">
                <button className="btn btn-outline-secondary rounded-pill ripple" onClick={() => { setShowModal(false); setSelectedAnnouncement(null); }}>ปิด</button>

                {(() => {
                  const ms = myAppStatus[selectedAnnouncement.id];
                  if (ms === "completed" || ms === "awarded") {
                    return <span className="badge text-bg-success rounded-pill px-3 py-2">✅ ได้รับชั่วโมงแล้ว</span>;
                  }
                  if (ms === "pending" || ms === "accepted") {
                    return <button className="btn btn-outline-danger rounded-pill ripple" onClick={() => onWithdraw(selectedAnnouncement)}>❌ ถอนการสมัคร</button>;
                  }
                  if (isClosed(selectedAnnouncement)) {
                    return (
                      <span className="badge text-bg-secondary rounded-pill px-3 py-2">
                        {(selectedAnnouncement.remaining ?? 1) === 0 ? "🔴 เต็มแล้ว" : "🔒 ปิดรับ"}
                      </span>
                    );
                  }
                  return (
                    <button className="btn btn-success rounded-pill ripple shadow-sm" onClick={() => onApply(selectedAnnouncement)}>
                      ✨ สมัครเลย
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: แบบประเมินเพื่อน (ย่อ) */}
      {user?.role === "student" && peerModalOpen && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)", position: "fixed", inset: 0, overflowY: "auto", zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4">
              <div className="modal-header border-0">
                <h5 className="modal-title">แบบประเมินเพื่อน (รอบ {periodKey})</h5>
                <button type="button" className="btn-close" onClick={closePeerModal}></button>
              </div>
              <div className="modal-body">
                {loadingProfile ? (
                  <div className="text-muted small">
                    <span className="spinner-border spinner-border-sm me-2" />กำลังโหลดข้อมูล…
                  </div>
                ) : !profile ? (
                  <div className="alert alert-warning mb-0 rounded-3">
                    ไม่สามารถโหลดข้อมูลโปรไฟล์ได้ ลองรีเฟรชหน้านี้อีกครั้ง
                  </div>
                ) : (
                  <PeerEvaluationForm user={user} profile={profile} periodKey={periodKey} />
                )}
              </div>
              <div className="modal-footer border-0">
                <button className="btn btn-secondary rounded-3 ripple" onClick={closePeerModal}>ปิด</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Local styles */}
      <style>{`
        .bg-animated {
          background: radial-gradient(1200px 600px at 10% -10%, #efe7ff 15%, transparent 60%),
                      radial-gradient(1000px 500px at 110% 10%, #e6f0ff 10%, transparent 55%),
                      linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%);
        }
        .glassy { backdrop-filter: blur(8px); }
        .topbar { position: sticky; top: 0; left: 0; width: 100%; background: linear-gradient(90deg, rgba(111,66,193,.9), rgba(142,92,255,.9)); box-shadow: 0 4px 16px rgba(111,66,193,.22); z-index: 1040; border-bottom: 1px solid rgba(255,255,255,.12); }

        .glass-card{ backdrop-filter: blur(6px); transition: transform .15s ease, box-shadow .15s ease; }
        .glass-card:hover{ transform: translateY(-2px); box-shadow: 0 12px 30px rgba(28,39,49,.12)!important; }
        .line-clamp-3{ display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
        .chip{ padding:.35rem .75rem; }

        .ratio-21x9{ aspect-ratio:21/9; width:100%; background:transparent; border-radius:1rem 1rem 0 0; overflow:hidden; }
        .banner-overlay{ position:absolute; inset:0; display:flex; justify-content:space-between; align-items:flex-start; padding:.5rem; pointer-events:none; }
        .banner-overlay .status-wrap, .banner-overlay .year-pill{ pointer-events:auto; }

        .year-pill{ display:inline-flex; align-items:center; padding:.45rem .9rem; border-radius:9999px; font-weight:700; font-size:.97rem; letter-spacing:.2px; color:#fff; background:linear-gradient(135deg,#0091ff,#6dd5fa); box-shadow:0 6px 18px rgba(0,0,0,.12); border:none; }
        .year-pill.year2{ background:linear-gradient(135deg,#6a11cb,#2575fc); }
        .year-pill.year3{ background:linear-gradient(135deg,#f7971e,#ffd200); color:#222; }
        .year-pill.year4{ background:linear-gradient(135deg,#ff416c,#ff4b2b); }
        .banner-overlay .badge{ font-size:.85rem; padding:.38rem .6rem; }

        /* Ripple */
        .ripple { position: relative; overflow: hidden; }
        .ripple:after { content: ""; position: absolute; inset: 0; border-radius: inherit; opacity: 0; background: radial-gradient(circle at var(--x,50%) var(--y,50%), rgba(255,255,255,.45), transparent 40%); transform: scale(0.2); transition: transform .3s, opacity .45s; pointer-events: none; }
        .ripple:active:after { opacity: 1; transform: scale(1); transition: 0s; }
        .ripple { --x: 50%; --y: 50%; }
        .ripple:focus-visible { outline: 3px solid rgba(142,92,255,.45); outline-offset: 2px; }

        html, body { overflow-x: hidden; }
        .bg-blob {
          position: absolute; filter: blur(60px); opacity: .55; z-index: 0; pointer-events: none; overflow: hidden; max-width: 100vw; will-change: transform;
        }
        .bg-animated { overflow-x: hidden; width: 100%; max-width: 100vw; }
        .bg-blob-1 { width: 420px; height: 420px; left: -120px; top: -80px; background: #d7c6ff; animation: drift1 18s ease-in-out infinite; }
        .bg-blob-2 { width: 360px; height: 360px; right: -120px; top: 120px; background: #c6ddff; animation: drift2 22s ease-in-out infinite; }
        .bg-blob-3 { width: 300px; height: 300px; left: 15%; bottom: -120px; background: #ffd9ec; animation: drift3 20s ease-in-out infinite; }
        @keyframes drift1 { 0%,100%{ transform: translate(0,0) } 50%{ transform: translate(20px,10px) } }
        @keyframes drift2 { 0%,100%{ transform: translate(0,0) } 50%{ transform: translate(-16px,8px) } }
        @keyframes drift3 { 0%,100%{ transform: translate(0,0) } 50%{ transform: translate(12px,-12px) } }
      `}</style>

      {/* script: ripple center */}
      <script dangerouslySetInnerHTML={{
        __html: `
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
