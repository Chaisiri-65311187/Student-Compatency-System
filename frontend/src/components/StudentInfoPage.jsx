// src/components/StudentInfoPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { getUsers, listMajors } from "../services/api";
import { getCompetencyProfile } from "../services/competencyApi";

const PURPLE = "#6f42c1";

/* ปุ่มชิปทรงโค้งเหมือนในภาพ */
const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`btn btn-sm me-2 mb-2 ${
      active ? "btn-primary" : "btn-outline-secondary"
    }`}
    style={{ borderRadius: 999 }}
  >
    {children}
  </button>
);

export default function StudentInfoPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (user.role !== "teacher") navigate("/home");
  }, [user, navigate]);

  const [loading, setLoading] = useState(true);
  const [majors, setMajors] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [enrich, setEnrich] = useState({});
  const [error, setError] = useState("");
  const [filterDept, setFilterDept] = useState({ cs: false, it: false });
  const [filterYear, setFilterYear] = useState({
    year1: false,
    year2: false,
    year3: false,
    year4: false,
  });
  const [search, setSearch] = useState("");

  const toggleDept = (k) => setFilterDept((p) => ({ ...p, [k]: !p[k] }));
  const toggleYear = (k) => setFilterYear((p) => ({ ...p, [k]: !p[k] }));

  useEffect(() => {
    const run = async () => {
      if (!user?.role || user.role !== "teacher") return;
      setLoading(true);
      setError("");
      try {
        const m = await listMajors();
        setMajors(m || []);
        // โหลดนิสิตทั้งหมด
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
        // enrich
        const ids = all.map((u) => u.id);
        const CHUNK = 25;
        const map = {};
        for (let i = 0; i < ids.length; i += CHUNK) {
          const chunk = ids.slice(i, i + CHUNK);
          const results = await Promise.allSettled(
            chunk.map((id) => getCompetencyProfile(id))
          );
          results.forEach((r, idx) => {
            const id = chunk[idx];
            if (r.status === "fulfilled" && r.value?.account) {
              const acct = r.value.account;
              map[id] = {
                manual_gpa: acct.manual_gpa ?? null,
                year_level: acct.year_level ?? null,
                computed_gpa: r.value.computed_gpa ?? null,
              };
            } else map[id] = { manual_gpa: null, year_level: null, computed_gpa: null };
          });
        }
        setEnrich(map);
      } catch (e) {
        console.error(e);
        setError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user?.role]);

  const majorNameById = useMemo(() => {
    const m = {};
    (majors || []).forEach((x) => (m[x.id] = x.name));
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
        (!filterYear.year1 &&
          !filterYear.year2 &&
          !filterYear.year3 &&
          !filterYear.year4) ||
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

  if (!user || user.role !== "teacher") return null;

  return (
    <div
      className="min-vh-100"
      style={{
        background: "linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%)",
      }}
    >
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
        <h5 className="text-white fw-semibold m-0">
          CSIT Competency System — Teacher
        </h5>
        <div className="ms-auto d-flex align-items-center">
          <span className="text-white-50 me-3">
            {user?.full_name || user?.username}
          </span>
          <button
            className="btn btn-light btn-sm rounded-pill"
            onClick={() => {
              logout?.();
              navigate("/login");
            }}
          >
            ออกจากระบบ
          </button>
        </div>
      </div>

      <div className="container-xxl py-4">
        <div className="row g-4">
          {/* Sidebar Filters เหมือนในภาพ */}
          <div className="col-12 col-xl-3">
            <div
              className="card border-0 shadow-sm rounded-4"
              style={{ position: "sticky", top: 96 }}
            >
              <div className="card-body">
                <div className="small text-uppercase text-muted fw-semibold mb-2">
                  ตัวกรอง
                </div>

                {/* ชั้นปี */}
                <div className="mb-3">
                  <div className="small text-muted mb-1">ชั้นปี</div>
                  <Chip
                    active={filterYear.year1}
                    onClick={() => toggleYear("year1")}
                  >
                    ปี 1
                  </Chip>
                  <Chip
                    active={filterYear.year2}
                    onClick={() => toggleYear("year2")}
                  >
                    ปี 2
                  </Chip>
                  <Chip
                    active={filterYear.year3}
                    onClick={() => toggleYear("year3")}
                  >
                    ปี 3
                  </Chip>
                  <Chip
                    active={filterYear.year4}
                    onClick={() => toggleYear("year4")}
                  >
                    ปี 4
                  </Chip>
                </div>

                {/* สาขา */}
                <div className="mb-2">
                  <div className="small text-muted mb-1">สาขา</div>
                  <Chip active={filterDept.cs} onClick={() => toggleDept("cs")}>
                    วิทยาการคอมพิวเตอร์
                  </Chip>
                  <Chip active={filterDept.it} onClick={() => toggleDept("it")}>
                    เทคโนโลยีสารสนเทศ
                  </Chip>
                </div>

                <div className="mt-2 small text-muted">
                  ไม่เลือก = แสดงทั้งหมด
                </div>
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="col-12 col-xl-9">
            {/* Toolbar */}
            <div className="card border-0 shadow-sm rounded-4 mb-3">
              <div className="card-body d-flex flex-wrap gap-2 align-items-center">
                <h4 className="mb-0 me-auto">ข้อมูลสมรรถนะนิสิต</h4>
                <div
                  className="position-relative me-2 flex-grow-1 flex-md-grow-0"
                  style={{ minWidth: 260 }}
                >
                  <i
                    className="bi bi-search position-absolute"
                    style={{ left: 12, top: 10, opacity: 0.5 }}
                  />
                  <input
                    type="text"
                    className="form-control ps-5 rounded-pill"
                    placeholder="ค้นหา รหัสนิสิต / ชื่อ"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Results */}
            {loading ? (
              <div className="text-muted small mb-2">
                <span className="spinner-border spinner-border-sm me-2" />
                กำลังโหลดรายชื่อนิสิต…
              </div>
            ) : error ? (
              <div className="alert alert-danger">{error}</div>
            ) : (
              <div className="text-muted small mb-2">
                พบ {filtered.length.toLocaleString("th-TH")} รายการ
              </div>
            )}

            {/* Card Results */}
            <div className="row g-4">
              {filtered.map((acc) => {
                const depName = majorNameById[acc.major_id] || "";
                const bannerGrad =
                  depName === "วิทยาการคอมพิวเตอร์"
                    ? `linear-gradient(135deg, ${PURPLE}, #b388ff)`
                    : depName === "เทคโนโลยีสารสนเทศ"
                    ? "linear-gradient(135deg, #0d6efd, #66b2ff)"
                    : "linear-gradient(135deg, #6c757d, #adb5bd)";
                const manualGpa = enrich[acc.id]?.manual_gpa ?? "—";
                const yearLevel = enrich[acc.id]?.year_level ?? "—";
                const computedGpa = enrich[acc.id]?.computed_gpa ?? "—";

                return (
                  <div key={acc.id} className="col-md-6 col-lg-4">
                    <div className="card shadow-sm border-0 rounded-4 overflow-hidden glass-card h-100">
                      <div
                        className="ratio-21x9"
                        style={{ background: bannerGrad, position: "relative" }}
                      >
                        <span className="badge bg-light text-dark position-absolute bottom-0 start-0 m-2 year-pill">
                          ชั้นปี {yearLevel}
                        </span>
                        <span className="badge bg-dark-subtle text-dark position-absolute top-0 end-0 m-2">
                          {depName}
                        </span>
                      </div>
                      <div className="card-body d-flex flex-column">
                        <div className="fw-semibold text-truncate">
                          {acc.full_name}
                        </div>
                        <div className="text-muted small mb-2">
                          {acc.username}
                        </div>
                        <div className="row small">
                          <div className="col-6">
                            <div className="text-muted">GPA (กรอกเอง)</div>
                            <div className="fw-medium">{manualGpa}</div>
                          </div>
                          <div className="col-6">
                            <div className="text-muted">GPA (คำนวณ)</div>
                            <div className="fw-medium">{computedGpa}</div>
                          </div>
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

      <style>{`
        .glass-card { backdrop-filter: blur(6px); transition: transform .15s ease, box-shadow .15s ease; }
        .glass-card:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(28,39,49,.12)!important; }
        .ratio-21x9 { aspect-ratio: 21/9; width: 100%; background: #e9ecef; }
        .year-pill { font-weight: 700; }
        .form-control:focus {
          box-shadow: 0 0 0 .2rem rgba(111,66,193,.12);
          border-color: #8e5cff;
        }
      `}</style>
    </div>
  );
}
