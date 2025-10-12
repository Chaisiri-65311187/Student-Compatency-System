// src/components/StudentInfoPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useCompetency } from "../contexts/CompetencyContext";
import { useNavigate } from "react-router-dom";

const PURPLE = "#6f42c1";

const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`btn btn-sm me-2 mb-2 ${active ? "btn-primary" : "btn-outline-secondary"}`}
    style={{ borderRadius: 999 }}
  >
    {children}
  </button>
);

const StudentInfoPage = () => {
  const { user, logout } = useAuth();
  const { competencyData } = useCompetency();
  const navigate = useNavigate();

  // ======= Guard: ให้ redirect ใน useEffect ไม่ใช่กลาง render =======
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (user.role !== "teacher") {
      navigate("/home");
    }
  }, [user, navigate]);

  // ======= Filters & Search =======
  const [filterDept, setFilterDept] = useState({ cs: false, it: false });
  const [filterYear, setFilterYear] = useState({ 1: false, 2: false, 3: false, 4: false });
  const [search, setSearch] = useState("");

  const toggleDept = (k) => setFilterDept((p) => ({ ...p, [k]: !p[k] }));
  const toggleYear = (k) => setFilterYear((p) => ({ ...p, [k]: !p[k] }));

  const filteredData = useMemo(() => {
    const kw = search.trim().toLowerCase();

    return (competencyData || []).filter((item) => {
      const dep = String(item.department || "");
      const y = String(item.year ?? "");

      const deptSelected =
        (!filterDept.cs && !filterDept.it) ||
        (filterDept.cs && dep === "วิทยาการคอมพิวเตอร์") ||
        (filterDept.it && dep === "เทคโนโลยีสารสนเทศ");

      const yearSelected =
        (!filterYear[1] && !filterYear[2] && !filterYear[3] && !filterYear[4]) ||
        filterYear[y];

      const searchSelected =
        !kw ||
        String(item.studentId || "").toLowerCase().includes(kw) ||
        String(item.name || "").toLowerCase().includes(kw);

      return deptSelected && yearSelected && searchSelected;
    });
  }, [competencyData, filterDept, filterYear, search]);

  // ======= Helpers =======
  const subjectsOf = (it) =>
    [it.subject1, it.subject2, it.subject3, it.subject4, it.subject5, it.subject6].filter(Boolean);

  const fileName = (f) => (typeof f === "string" ? f : f?.name || "—");

  if (!user || user.role !== "teacher") return null;

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
        <h5 className="text-white fw-semibold m-0">CSIT Competency System — Teacher</h5>
        <div className="ms-auto d-flex align-items-center">
          <span className="text-white-50 me-3">{user?.fullName}</span>
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
        {/* Toolbar */}
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body d-flex flex-wrap gap-2 align-items-center">
            <h4 className="mb-0 me-auto">ข้อมูลสมรรถนะนิสิต</h4>

            <div className="position-relative me-2 flex-grow-1 flex-md-grow-0" style={{ minWidth: 260 }}>
              <i className="bi bi-search position-absolute" style={{ left: 12, top: 10, opacity: 0.5 }} />
              <input
                type="text"
                className="form-control ps-5 rounded-pill"
                placeholder="ค้นหา รหัสนิสิต / ชื่อ"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary rounded-pill"
              onClick={() => navigate("/create-announcement")}
            >
              <i className="bi bi-megaphone me-1" />
              สร้างประกาศรับสมัคร
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body">
            <div className="row g-3 align-items-center">
              <div className="col-12 col-md-6">
                <div className="small text-muted mb-2">สาขา</div>
                <Chip active={filterDept.cs} onClick={() => toggleDept("cs")}>
                  วิทยาการคอมพิวเตอร์
                </Chip>
                <Chip active={filterDept.it} onClick={() => toggleDept("it")}>
                  เทคโนโลยีสารสนเทศ
                </Chip>
              </div>
              <div className="col-12 col-md-6">
                <div className="small text-muted mb-2">ชั้นปี</div>
                {[1, 2, 3, 4].map((y) => (
                  <Chip key={y} active={!!filterYear[y]} onClick={() => toggleYear(String(y))}>
                    ชั้นปี {y}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="mt-2 small text-muted">
              <i className="bi bi-info-circle me-1" />
              ไม่เลือก = แสดงทั้งหมด
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="text-muted small mb-2">
          พบ {filteredData.length.toLocaleString("th-TH")} รายการ
        </div>

        {/* Results */}
        {filteredData.length === 0 ? (
          <div className="text-center py-5 card border-0 shadow-sm rounded-4">
            <div className="card-body">
              <div className="display-6 mb-2">😶</div>
              <h5 className="mb-1">ไม่พบข้อมูลสมรรถนะนิสิต</h5>
              <div className="text-muted">ลองลบตัวกรองหรือเปลี่ยนคำค้นหา</div>
            </div>
          </div>
        ) : (
          <div className="row g-4">
            {filteredData.map((it, idx) => {
              const subjects = subjectsOf(it);
              const bannerGrad =
                it.department === "วิทยาการคอมพิวเตอร์"
                  ? `linear-gradient(135deg, ${PURPLE}, #b388ff)`
                  : "linear-gradient(135deg, #0d6efd, #66b2ff)";

              return (
                <div key={idx} className="col-md-6 col-lg-4">
                  <div className="card shadow-sm border-0 rounded-4 overflow-hidden glass-card h-100">
                    {/* banner */}
                    <div
                      className="ratio ratio-21x9"
                      style={{ background: bannerGrad, position: "relative" }}
                    >
                      {it.year && (
                        <span className="badge bg-light text-dark position-absolute bottom-0 start-0 m-2 year-pill">
                          ชั้นปี {it.year}
                        </span>
                      )}
                      {it.department && (
                        <span className="badge bg-dark-subtle text-dark position-absolute top-0 end-0 m-2">
                          {it.department}
                        </span>
                      )}
                    </div>

                    <div className="card-body d-flex flex-column">
                      {/* Header row */}
                      <div className="d-flex align-items-center gap-3 mb-2">
                        {it.profileImage ? (
                          <img
                            src={it.profileImage}
                            alt={it.name || it.studentId}
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 12,
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 12,
                              background: "#e9ecef",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              color: "#6c757d",
                            }}
                            aria-label="avatar"
                          >
                            {(it.name || it.studentId || "?").toString().slice(0, 1)}
                          </div>
                        )}

                        <div className="flex-grow-1">
                          <div className="fw-semibold text-truncate" title={it.name}>
                            {it.name || "—"}
                          </div>
                          <div className="small text-muted text-truncate" title={it.studentId}>
                            {it.studentId || "—"}
                          </div>
                        </div>
                      </div>

                      {/* Body */}
                      {subjects.length > 0 && (
                        <div className="mb-2">
                          <div className="small text-muted mb-1">วิชาเลือก</div>
                          <div className="d-flex flex-wrap gap-1">
                            {subjects.map((s, i) => (
                              <span key={i} className="badge bg-secondary-subtle text-secondary-emphasis">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="row g-2 small">
                        <div className="col-6">
                          <div className="text-muted">เกรด</div>
                          <div className="fw-medium">{it.grade || "—"}</div>
                        </div>
                        <div className="col-6">
                          <div className="text-muted">ชั้นปี</div>
                          <div className="fw-medium">{it.year ?? "—"}</div>
                        </div>
                        <div className="col-12">
                          <div className="text-muted">Hard Skill</div>
                          <div className="fw-medium">{it.hardSkill || "—"}</div>
                        </div>
                        <div className="col-12">
                          <div className="text-muted">Soft Skill</div>
                          <div className="fw-medium">{it.softSkill || "—"}</div>
                        </div>
                      </div>

                      {/* Files */}
                      {(it.projectFile || it.activityFile || it.transcriptFile) && (
                        <div className="mt-2 small">
                          <div className="text-muted mb-1">ไฟล์แนบ</div>
                          {it.projectFile && (
                            <div>
                              <i className="bi bi-file-earmark-code me-1" />
                              ผลงาน: <span className="text-truncate d-inline-block" style={{ maxWidth: "70%" }}>{fileName(it.projectFile)}</span>
                            </div>
                          )}
                          {it.transcriptFile && (
                            <div>
                              <i className="bi bi-file-earmark-text me-1" />
                              Transcript: <span className="text-truncate d-inline-block" style={{ maxWidth: "70%" }}>{fileName(it.transcriptFile)}</span>
                            </div>
                          )}
                          {it.activityFile && (
                            <div>
                              <i className="bi bi-file-earmark-richtext me-1" />
                              กิจกรรมเสริม: <span className="text-truncate d-inline-block" style={{ maxWidth: "70%" }}>{fileName(it.activityFile)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Local styles */}
      <style>{`
        .glass-card { backdrop-filter: blur(6px); transition: transform .15s ease, box-shadow .15s ease; }
        .glass-card:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(28,39,49,.12)!important; }
        .ratio-21x9 { aspect-ratio: 21/9; width: 100%; background: #e9ecef; }
        .year-pill { font-weight: 700; }
        .form-control:focus{
          box-shadow: 0 0 0 .2rem rgba(111,66,193,.12);
          border-color: #8e5cff;
        }
      `}</style>
    </div>
  );
};

export default StudentInfoPage;
