
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return navigate("/login");
    if (user.role !== "admin") return navigate("/home");
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

  useEffect(() => {
    if (user?.role !== "admin") return;

    const API = (import.meta.env.VITE_API_BASE || "http://localhost:5000").replace(/\/+$/, "");
    (async () => {
      try {
        const [ovRes, userRes] = await Promise.all([
          fetch(`${API}/api/admin/overview`),
          fetch(`${API}/api/admin/recent-users`),
        ]);
        if (ovRes.ok) setOverview(await ovRes.json());
        if (userRes.ok) setRecentUsers(await userRes.json());
      } catch (e) {
        console.warn("AdminDashboard fetch failed:", e);
      }
    })();
  }, [user]);

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div style={{ backgroundColor: "#f4f7fa", minHeight: "100vh" }}>
      {/* Top Bar */}
      <div className="d-flex align-items-center p-2" style={{ height: 80, backgroundColor: "#6f42c1" }}>
        <img
          src="/src/assets/csit.jpg"
          alt="Logo"
          style={{ height: '50px', marginLeft: '10px', marginRight: '10px' }}
        />
        <h5 className="text-white fw-bold m-0">CSIT Competency System — Admin</h5>
        <div className="ms-auto d-flex align-items-center">
          <span className="text-white me-3">{user ? `${user.username} ${user.fullName || user.full_name || ""}` : ""}</span>
          <button className="btn btn-light btn-sm" onClick={handleLogout}>ออกจากระบบ</button>
        </div>
      </div>

      <div className="container py-4">
        {/* Overview Cards */}
        <div className="row g-3">
          <div className="col-md-3"><div className="card shadow-sm"><div className="card-body">
            <div className="text-muted">ผู้ใช้ทั้งหมด</div>
            <div className="display-6">{overview.totalUsers}</div>
          </div></div></div>

          <div className="col-md-3"><div className="card shadow-sm"><div className="card-body">
            <div className="text-muted">นิสิต</div>
            <div className="display-6">{overview.totalStudents}</div>
          </div></div></div>

          <div className="col-md-3"><div className="card shadow-sm"><div className="card-body">
            <div className="text-muted">อาจารย์</div>
            <div className="display-6">{overview.totalTeachers}</div>
          </div></div></div>

          <div className="col-md-3"><div className="card shadow-sm"><div className="card-body">
            <div className="text-muted">ผู้ดูแลระบบ</div>
            <div className="display-6">{overview.totalAdmins}</div>
          </div></div></div>
        </div>

        {/* Quick Actions (อนาคตค่อยลิงก์จริง) */}
        <div className="d-flex gap-2 my-4">
          <Link to="/admin/users" className="btn btn-dark">จัดการผู้ใช้</Link>
          {/* ปุ่มอื่น ๆ ไว้ค่อยทำเมื่อเพิ่มตารางใหม่ */}
          {/* <Link to="/admin/announcements" className="btn btn-primary disabled">จัดการประกาศ (เร็วๆนี้)</Link> */}
        </div>

        <div className="row g-4">
          {/* Recent Users */}
          <div className="col-lg-12">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="m-0">ผู้ใช้ที่เพิ่มล่าสุด</h5>
                  <Link to="/admin/users" className="btn btn-sm btn-outline-dark">จัดการ</Link>
                </div>
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
                      {recentUsers.length ? recentUsers.map(u => (
                        <tr key={u.id}>
                          <td>{u.username}</td>
                          <td>{u.name}</td>
                          <td><span className="badge text-bg-secondary">{u.role}</span></td>
                          <td>{u.dept || "-"}</td>
                          <td>{u.created_at?.slice(0, 10) || "-"}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5} className="text-muted">ไม่มีข้อมูล</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
