// src/components/HomePage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getCompetencyProfile } from "../services/competencyApi";
import PeerEvaluationForm from "../components/competency/PeerEvaluationForm";
import {
  listAnnouncements,
  listMyApplications,
  applyAnnouncement,
  withdrawApplication,
} from "../services/announcementsApi";

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
    timeZone: tz,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(dt);
};
const formatDateTH = (s) => dateTH(s);
const timeHM = (t) => {
  if (!t) return "";
  if (typeof t === "string") {
    const hhmm = t.match(/^(\d{2}):?(\d{2})/);
    if (hhmm) return `${hhmm[1]}:${hhmm[2]}`;
  }
  try {
    const dt = new Date(`1970-01-01T${t}`);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleTimeString("th-TH", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }
  } catch {}
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
  const [appliedMap, setAppliedMap] = useState({}); // { [announcement_id]: { status: 'pending'|'accepted' } }

  // Auth / nav
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Peer eval needs
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const periodKey = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const sem = m <= 5 ? 1 : 2;
    return `${y}-${sem}`;
  }, []);

  // === NEW: modal state for Peer Evaluation ===
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
  const [notifItems, setNotifItems] = useState([]); // [{id, announcement_id, title, when}]
  const [unreadCount, setUnreadCount] = useState(0);

  const searchRef = useRef(null);

  // map id -> title (ไว้โชว์ชื่อประกาศในแจ้งเตือน)
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
    const run = async () => {
      setLoading(true); setLoadErr("");
      try {
        const data = await listAnnouncements({ status: "open" });
        const rows = Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : Array.isArray(data?.items) ? data.items : [];
        setAnnouncements(
          rows.map((r) => {
            const rawCap = r.capacity ?? r.seats;
            const capacity = rawCap == null || String(rawCap).trim() === "" ? null : Number(rawCap);
            const accepted = Number.isFinite(Number(r.accepted_count)) ? Number(r.accepted_count) : 0;
            const remaining = capacity == null ? null : Math.max(0, capacity - accepted);
            return {
              id: r.id,
              title: r.title,
              teacher: r.teacher || r.teacher_name || r.owner_name || "-",
              description: r.description || "",
              department: r.department || "ไม่จำกัด",
              year: Number(r.year) || null,
              work_date: r.work_date || null,
              work_end: r.work_end || null,
              work_periods: Array.isArray(r.work_periods) ? r.work_periods : Array.isArray(r.periods) ? r.periods : [],
              deadline: r.deadline || null,
              status: r.status || "open",
              location: r.location || "",
              capacity,
              accepted_count: accepted,
              remaining,
            };
          })
        );
      } catch (e) {
        setLoadErr(e?.message || "โหลดประกาศไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  // โหลด “ประกาศที่ฉันสมัคร” + คำนวณแจ้งเตือน
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;

    const buildNotifs = (apps) =>
      apps.filter((x) => x.status === "accepted").map((x) => ({
        id: String(x.id), // application id
        announcement_id: x.announcement_id,
        title: annTitleById[x.announcement_id] || `ประกาศ #${x.announcement_id}`,
        when: x.updated_at || x.approved_at || x.created_at || null,
      }));

    (async () => {
      try {
        const data = await listMyApplications(user.id);
        const items = Array.isArray(data) ? data : data?.items || [];

        // map สำหรับปุ่ม สมัคร/ถอน
        const map = {};
        items.forEach((x) => { if (x.status === "pending" || x.status === "accepted") { map[x.announcement_id] = { status: x.status }; } });

        // แจ้งเตือน
        const notifs = buildNotifs(items);
        const seen = loadSeen();
        const unread = notifs.filter((n) => !seen.has(n.id)).length;

        if (!alive) return;
        setAppliedMap(map);
        setNotifItems(notifs);
        setUnreadCount(unread);
      } catch { /* ignore */ }
    })();

    return () => { alive = false; };
  }, [user?.id, annTitleById]);

  // Poll แจ้งเตือนทุก 30 วิ
  useEffect(() => {
    if (!user?.id) return;
    const timer = setInterval(async () => {
      try {
        const data = await listMyApplications(user.id);
        const items = Array.isArray(data) ? data : data?.items || [];
        const notifs = items.filter((x) => x.status === "accepted").map((x) => ({
          id: String(x.id),
          announcement_id: x.announcement_id,
          title: annTitleById[x.announcement_id] || `ประกาศ #${x.announcement_id}`,
          when: x.updated_at || x.approved_at || x.created_at || null,
        }));
        const seen = loadSeen();
        setNotifItems(notifs);
        setUnreadCount(notifs.filter((n) => !seen.has(n.id)).length);
      } catch {}
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

  // ปุ่มสมัคร/ถอนสมัคร
  const isClosed = (a) => {
    const dl = parseSafeDate(a.deadline);
    const overdue = dl ? dl < new Date() : false;
    const full = a?.capacity != null && (a?.remaining ?? 0) <= 0;
    return a.status !== "open" || overdue || full;
  };

  const onApply = async (ann) => {
    if (!user?.id) { alert("กรุณาเข้าสู่ระบบนิสิตก่อนสมัคร"); return; }
    if (ann?.capacity != null && (ann?.remaining ?? 0) <= 0) { alert("ประกาศนี้เต็มแล้ว ไม่สามารถสมัครได้"); return; }
    try {
      await applyAnnouncement(ann.id, user.id);
      const data = await listMyApplications(user.id);
      const items = Array.isArray(data) ? data : data?.items || [];
      const map = {};
      items.forEach((x) => { if (x.status === "pending" || x.status === "accepted") { map[x.announcement_id] = { status: x.status }; } });
      setAppliedMap(map);
      alert("สมัครเรียบร้อย (สถานะ: รอตรวจ)");
    } catch (e) {
      alert(e?.message || "สมัครไม่สำเร็จ");
    }
  };

  const onWithdraw = async (ann) => {
    if (!user?.id) return;
    if (!confirm("ยืนยันถอนการสมัคร?")) return;
    try {
      await withdrawApplication(ann.id, user.id);
      const data = await listMyApplications(user.id);
      const items = Array.isArray(data) ? data : data?.items || [];
      const map = {};
      items.forEach((x) => { if (x.status === "pending" || x.status === "accepted") { map[x.announcement_id] = { status: x.status }; } });
      setAppliedMap(map);
    } catch (e) {
      alert(e?.message || "ถอนสมัครไม่สำเร็จ");
    }
  };

  // แจ้งเตือน: action
  const markAllRead = () => { const seen = loadSeen(); notifItems.forEach((n) => seen.add(n.id)); saveSeen(seen); setUnreadCount(0); };
  const toggleNoti = () => setNotiOpen((v) => !v);
  const closeNotiPanel = () => setNotiOpen(false);

  // Hotkeys: '/' โฟกัสค้นหา, Esc ปิดแผงแจ้งเตือน
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
            {/* 🔔 Bell Icon */}
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
                      return (
                        <div key={n.id} className="list-group-item">
                          <div className="d-flex">
                            <div className="me-2"><i className={`bi ${seen ? "bi-check-circle" : "bi-dot"} fs-5`} /></div>
                            <div className="flex-grow-1">
                              <div className="fw-semibold">ได้รับการอนุมัติ</div>
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
                  <input ref={searchRef} type="text" className="form-control rounded-pill ps-5" placeholder="กด / เพื่อค้นหา (ชื่อประกาศ / อาจารย์ / รายละเอียด)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <button type="button" className="btn btn-outline-primary rounded-pill ripple" onClick={() => navigate("/competency/form")}>ข้อมูลสมรรถนะ</button>
                <button type="button" className="btn btn-outline-primary rounded-pill ripple" onClick={() => navigate("/profile")}>Profile</button>

                {/* เปลี่ยนปุ่มนี้ให้เปิด Modal */}
                {user?.role === "student" && (
                  <button
                    className="btn btn-primary btn-sm rounded-pill"
                    onClick={openPeerModal}
                  >
                    ประเมินเพื่อน
                  </button>
                )}
              </div>
            </div>

            {/* (ลบการ์ดแบบประเมินที่เคยอยู่บนหน้าออก เพื่อไม่ให้ซ้ำกับ Modal) */}

            {/* Results */}
            {loading ? (
              <div className="row g-4">{Array.from({ length: 6 }).map((_, i) => (<SkeletonCard key={i} />))}</div>
            ) : loadErr ? (
              <div className="alert alert-danger rounded-4">เกิดข้อผิดพลาด: {loadErr}</div>
            ) : filteredAnnouncements.length === 0 ? (
              <div className="text-center py-5 card border-0 shadow-sm rounded-4"><div className="card-body"><h5 className="mb-1">ไม่พบประกาศที่ตรงกับการค้นหา</h5><div className="text-muted">ลองลบตัวกรองหรือเปลี่ยนคำค้นหา</div></div></div>
            ) : (
              <div className="row g-4">
                {filteredAnnouncements.map((item) => {
                  const myApply = appliedMap[item.id];
                  const closed = isClosed(item);
                  const deptBadge = item.department && item.department !== 'ไม่จำกัด' ? item.department : null;
                  return (
                    <div key={item.id} className="col-md-6 col-lg-4">
                      <div className="card shadow-sm border-0 rounded-4 overflow-hidden glass-card h-100">
                        {/* Banner */}
                        <div className="ratio ratio-21x9" style={{ background: `linear-gradient(135deg, ${PURPLE}, #b388ff)`, position: "relative" }}>
                          <div className="banner-overlay">
                            {item.year && (<span className={`year-pill year${item.year}`}>ปี {item.year}</span>)}
                            <span className="status-wrap"><StatusBadge status={item.status} /></span>
                          </div>
                        </div>

                        <div className="card-body d-flex flex-column">
                          <h5 className="mb-1 text-truncate" title={item.title}>{item.title}</h5>
                          <div className="text-muted small mb-2">
                            อาจารย์ผู้รับผิดชอบ: <span className="text-dark fw-semibold">{item.teacher}</span>
                            {deptBadge && <span className="badge bg-light text-dark ms-2">{deptBadge}</span>}
                          </div>

                          {/* จำนวนรับ */}
                          <div className="small mb-2"><i className="bi bi-people me-1" />รับ: {item.remaining ?? "ไม่จำกัด"}{item.capacity != null && <> / {item.capacity}</>}</div>

                          {/* ช่วงวันที่ทำงาน */}
                          {Array.isArray(item.work_periods) && item.work_periods.length > 0 ? (
                            <div className="small mb-2"><div className="text-muted">ช่วงวันที่ทำงาน:</div>{item.work_periods.map((p, i) => (<div key={i}>• {rangeLine(p)}</div>))}</div>
                          ) : (item.work_date || item.work_end) && (
                            <div className="small mb-2"><span className="text-muted">ช่วงวันที่ทำงาน:</span> <span className="fw-medium">{item.work_end && item.work_end !== item.work_date ? `${dateTH(item.work_date)} – ${dateTH(item.work_end)}` : dateTH(item.work_date)}</span></div>
                          )}

                          {/* deadline / department / location */}
                          {item.deadline && (<div className="small mb-1"><span className="text-muted">วันปิดรับสมัคร:</span> <span className="fw-medium">{formatDateTH(item.deadline)}</span></div>)}
                          <div className="small mb-1"><span className="text-muted">สาขา:</span> <span className="fw-medium">{item.department || '-'}</span></div>
                          {item.location && (<div className="small text-muted mb-2">สถานที่: {item.location}</div>)}

                          {item.description && (<p className="text-muted mb-3 line-clamp-3">{item.description}</p>)}

                          <div className="mt-auto d-flex gap-2">
                            <button className="btn btn-outline-secondary flex-grow-1 rounded-3 ripple" onClick={() => openModal(item)}>ดูรายละเอียด</button>
                            {myApply ? (
                              <button className="btn btn-outline-danger rounded-3 ripple" onClick={() => onWithdraw(item)}>ถอนการสมัคร</button>
                            ) : (
                              <button className="btn btn-primary rounded-3 ripple" disabled={closed} onClick={() => onApply(item)}>สมัคร</button>
                            )}
                          </div>
                          {myApply && (<div className="small text-muted mt-2">สถานะการสมัคร: {myApply.status}</div>)}
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
            <div className="modal-content rounded-4">
              <div className="modal-header border-0">
                <h5 className="modal-title">{selectedAnnouncement.title}</h5>
                <button type="button" className="btn-close" onClick={closeModal}></button>
              </div>

              <div className="modal-body pt-0">
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="small text-muted mb-1">อาจารย์ผู้รับผิดชอบ</div>
                    <div className="fw-medium">{selectedAnnouncement.teacher}</div>
                  </div>
                  <div className="col-md-6">
                    <div className="small text-muted mb-1">สถานะ</div>
                    <StatusBadge status={selectedAnnouncement.status} />
                  </div>

                  <div className="col-12">
                    <div className="small text-muted mb-1">ช่วงวันที่ทำงาน</div>
                    {Array.isArray(selectedAnnouncement.work_periods) && selectedAnnouncement.work_periods.length > 0 ? (
                      <div className="fw-normal">{selectedAnnouncement.work_periods.map((p, i) => (<div key={i}>• {rangeLine(p)}</div>))}</div>
                    ) : (
                      <div className="fw-medium">{selectedAnnouncement.work_end && selectedAnnouncement.work_end !== selectedAnnouncement.work_date ? `${dateTH(selectedAnnouncement.work_date)} – ${dateTH(selectedAnnouncement.work_end)}` : dateTH(selectedAnnouncement.work_date)}</div>
                    )}
                  </div>

                  {selectedAnnouncement.deadline && (
                    <div className="col-md-6">
                      <div className="small text-muted mb-1">วันปิดรับสมัคร</div>
                      <div className="fw-medium">{formatDateTH(selectedAnnouncement.deadline)}</div>
                    </div>
                  )}

                  <div className="col-md-6">
                    <div className="small text-muted mb-1">ชั้นปีที่สมัครได้</div>
                    <div className="fw-medium">{selectedAnnouncement.year ?? "-"}</div>
                  </div>

                  <div className="col-md-6">
                    <div className="small text-muted mb-1">จำนวนรับ</div>
                    <div className="fw-medium">{selectedAnnouncement.remaining ?? "ไม่จำกัด"}{selectedAnnouncement.capacity != null && (<> / {selectedAnnouncement.capacity}</>)}</div>
                  </div>

                  <div className="col-md-6">
                    <div className="small text-muted mb-1">สาขาที่เกี่ยวข้อง</div>
                    <div className="fw-medium">{selectedAnnouncement.department}</div>
                  </div>

                  {selectedAnnouncement.location && (
                    <div className="col-12">
                      <div className="small text-muted mb-1">สถานที่ทำงาน</div>
                      <div className="fw-medium">{selectedAnnouncement.location}</div>
                    </div>
                  )}

                  {selectedAnnouncement.description && (
                    <div className="col-12">
                      <div className="small text-muted mb-1">รายละเอียด</div>
                      <div className="fw-normal">{selectedAnnouncement.description}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer border-0">
                <button className="btn btn-secondary rounded-3 ripple" onClick={closeModal}>ปิด</button>
                {appliedMap[selectedAnnouncement.id] ? (
                  <button className="btn btn-outline-danger rounded-3 ripple" onClick={() => onWithdraw(selectedAnnouncement)}>ถอนการสมัคร</button>
                ) : (
                  <button className="btn btn-primary rounded-3 ripple" disabled={isClosed(selectedAnnouncement)} onClick={() => onApply(selectedAnnouncement)}>สมัคร</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: แบบประเมินเพื่อน */}
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
                  <PeerEvaluationForm
                    user={user}
                    periodKey={periodKey}
                    profile={profile}
                    onSubmitted={() => {
                      // ปิด modal หลังส่ง
                      closePeerModal();
                      // แจ้งเตือนตามต้องการ เช่น:
                      // toast.success("ส่งแบบประเมินแล้ว ขอบคุณ!");
                      alert("ส่งแบบประเมินแล้ว ขอบคุณ!");
                    }}
                  />
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
        /* ===== Animated gradient bg & blobs (match Welcome/Login) ===== */
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

        /* Background blobs */
        html, body { overflow-x: hidden; }
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
        .bg-animated { overflow-x: hidden; width: 100%; max-width: 100vw; }
        .bg-blob-1 { width: 420px; height: 420px; left: -120px; top: -80px; background: #d7c6ff; animation: drift1 18s ease-in-out infinite; }
        .bg-blob-2 { width: 360px; height: 360px; right: -120px; top: 120px; background: #c6ddff; animation: drift2 22s ease-in-out infinite; }
        .bg-blob-3 { width: 300px; height: 300px; left: 15%; bottom: -120px; background: #ffd9ec; animation: drift3 20s ease-in-out infinite; }
        @keyframes drift1 { 0%,100%{ transform: translate(0,0) } 50%{ transform: translate(20px,10px) } }
        @keyframes drift2 { 0%,100%{ transform: translate(0,0) } 50%{ transform: translate(-16px,8px) } }
        @keyframes drift3 { 0%,100%{ transform: translate(0,0) } 50%{ transform: translate(12px,-12px) } }
      `}</style>

      {/* tiny script to position ripple center under cursor */}
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
