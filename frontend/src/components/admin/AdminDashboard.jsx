// src/pages/admin/AdminDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const tz = "Asia/Bangkok";
const formatDateTH = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: tz,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // gatekeeping
  useEffect(() => {
    if (!user) navigate("/login");
    else if (user.role !== "admin") navigate("/home");
  }, [user, navigate]);

  const [overview, setOverview] = useState({
    totalUsers: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalAdmins: 0,
    totalAnnouncements: 0,
    pendingReviews: 0,
  });
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");

  // fetch data
  useEffect(() => {
    if (user?.role !== "admin") return;

    const API = (import.meta.env.VITE_API_BASE || "http://localhost:5000").replace(/\/+$/, "");
    const ctrl = new AbortController();

    (async () => {
      setLoading(true);
      setLoadErr("");
      try {
        const [ovRes, userRes] = await Promise.all([
          fetch(`${API}/api/admin/overview`, { signal: ctrl.signal }),
          fetch(`${API}/api/admin/recent-users`, { signal: ctrl.signal }),
        ]);

        if (!ovRes.ok) throw new Error(`overview ${ovRes.status}`);
        if (!userRes.ok) throw new Error(`recent-users ${userRes.status}`);

        const [ov, uu] = await Promise.all([ovRes.json(), userRes.json()]);
        setOverview((prev) => ({ ...prev, ...ov }));
        setRecentUsers(Array.isArray(uu) ? uu : []);
      } catch (e) {
        if (e.name !== "AbortError") {
          console.warn("AdminDashboard fetch failed:", e);
          setLoadErr("โหลดข้อมูลไม่สำเร็จ");
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [user]);

  const handleLogout = () => {
    logout?.();
    navigate("/login");
  };

  // role color map
  const roleClass = (r) =>
    r === "admin"
      ? "badge text-bg-danger"
      : r === "teacher"
      ? "badge text-bg-primary"
      : "badge text-bg-secondary";

  // simple search in table (ตามชื่อ/รหัส)
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return recentUsers;
    return recentUsers.filter(
      (u) =>
        String(u.username || "").toLowerCase().includes(s) ||
        String(u.name || "").toLowerCase().includes(s)
    );
  }, [recentUsers, q]);

  return (
    <div className="min-vh-100" style={{ background: "linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%)" }}>
      {/* Top Bar */}
      <div
        className="d-flex align-items-center px-3"
        style={{
          height: 72,
          background: "linear-gradient(90deg, #6f42c1, #8e5cff)",
          boxShadow: "0 4px 14px rgba(111,66,193,.22)",
        }}
      >
        <img
          src="/src/assets/csit.jpg"
          alt="Logo"
          className="rounded-3 me-3"
          style={{ height: 40, width: 40, objectFit: "cover" }}
        />
        <h5 className="text-white fw-semibold m-0">CSIT Competency System — Admin</h5>
        <div className="ms-auto d-flex align-items-center">
          <span className="text-white-50 me-3">
            {user ? `${user.username} ${user.fullName || user.full_name || ""}` : ""}
          </span>
          <button className="btn btn-light btn-sm rounded-pill" onClick={handleLogout}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      <div className="container-xxl py-4">
        {/* Overview */}
        <div className="row g-3">
          <KpiCard icon="bi-people" title="ผู้ใช้ทั้งหมด" value={overview.totalUsers} />
          <KpiCard icon="bi-mortarboard" title="นิสิต" value={overview.totalStudents} />
          <KpiCard icon="bi-person-workspace" title="อาจารย์" value={overview.totalTeachers} />
          <KpiCard icon="bi-shield-lock" title="ผู้ดูแลระบบ" value={overview.totalAdmins} />
          <KpiCard icon="bi-megaphone" title="ประกาศทั้งหมด" value={overview.totalAnnouncements} />
          <KpiCard icon="bi-hourglass-split" title="รอทบทวน" value={overview.pendingReviews} />
        </div>

        {/* Quick Actions */}
        <div className="card border-0 shadow-sm rounded-4 my-4">
          <div className="card-body d-flex flex-wrap gap-2 align-items-center">
            <h5 className="m-0 me-auto">การทำงานด่วน</h5>
            <Link to="/admin/users" className="btn btn-outline-dark rounded-3">
              <i className="bi bi-people me-1"></i> จัดการผู้ใช้
            </Link>
            {/* <Link to="/admin/announcements" className="btn btn-outline-primary rounded-3">
              <i className="bi bi-megaphone me-1"></i> จัดการประกาศ
            </Link> */}
          </div>
        </div>

        {/* Recent users */}
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body">
            <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
              <h5 className="m-0 me-auto">ผู้ใช้ที่เพิ่มล่าสุด</h5>
              <div className="position-relative" style={{ minWidth: 220 }}>
                <input
                  className="form-control rounded-3 ps-3"
                  placeholder="ค้นหา ชื่อ/รหัส"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <Link to="/admin/users" className="btn btn-sm btn-outline-dark rounded-3">
                จัดการ
              </Link>
            </div>

            {loading ? (
              <SkeletonTable />
            ) : loadErr ? (
              <div className="alert alert-danger rounded-4">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {loadErr}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead>
                    <tr>
                      <th>รหัส/อีเมล</th>
                      <th>ชื่อ</th>
                      <th>บทบาท</th>
                      <th>สาขา</th>
                      <th>สร้างเมื่อ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length ? (
                      filtered.map((u) => (
                        <tr key={u.id}>
                          <td className="text-nowrap">{u.username}</td>
                          <td className="text-nowrap">{u.name}</td>
                          <td>
                            <span className={roleClass(u.role)}>{u.role}</span>
                          </td>
                          <td className="text-nowrap">{u.dept || "-"}</td>
                          <td className="text-nowrap">{formatDateTH(u.created_at)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-muted text-center">
                          ไม่มีข้อมูล
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-muted small mt-3">
          แดชบอร์ดผู้ดูแลระบบ · ข้อมูลอัปเดตอัตโนมัติเมื่อเปิดหน้านี้
        </div>
      </div>

      {/* Local styles */}
      <style>{`
        .kpi{
          border: 0; border-radius: 1rem;
          background: #fff; box-shadow: 0 6px 20px rgba(28,39,49,.06);
        }
        .kpi .icon{
          width: 44px; height: 44px; border-radius: 10px;
          display:flex; align-items:center; justify-content:center;
          background: rgba(111,66,193,.1);
          color: #6f42c1;
        }
        .kpi .value{
          font-size: 1.75rem; font-weight: 700;
        }
        .table > :not(caption) > * > *{
          vertical-align: middle;
        }
      `}</style>
    </div>
  );
};

// ===== Sub-components =====
const KpiCard = ({ icon, title, value }) => (
  <div className="col-12 col-sm-6 col-lg-4 col-xxl-3">
    <div className="kpi p-3 h-100">
      <div className="d-flex align-items-center gap-3">
        <div className="icon">
          <i className={`bi ${icon}`}></i>
        </div>
        <div>
          <div className="text-muted small">{title}</div>
          <div className="value">{Number(value || 0).toLocaleString("th-TH")}</div>
        </div>
      </div>
    </div>
  </div>
);

const SkeletonTable = () => (
  <div className="table-responsive">
    <table className="table">
      <thead>
        <tr>
          <th>รหัส/อีเมล</th>
          <th>ชื่อ</th>
          <th>บทบาท</th>
          <th>สาขา</th>
          <th>สร้างเมื่อ</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 6 }).map((_, i) => (
          <tr key={i}>
            {Array.from({ length: 5 }).map((__, j) => (
              <td key={j}>
                <span className="placeholder col-8"></span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default AdminDashboard;
