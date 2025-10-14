// src/components/admin/ManageUsersPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { getUsers, createUser, updateUser, deleteUser, listMajors } from "../../services/api";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

const roles = [
  { value: "",        label: "ทั้งหมด" },
  { value: "student", label: "นิสิต" },
  { value: "teacher", label: "อาจารย์" },
  { value: "admin",   label: "ผู้ดูแลระบบ" },
];

const roleText = (r) =>
  r === "admin"   ? "ผู้ดูแลระบบ" :
  r === "teacher" ? "อาจารย์" :
  r === "student" ? "นิสิต" : r || "-";

const roleBadge = (r) =>
  r === "admin"   ? "badge text-bg-danger"  :
  r === "teacher" ? "badge text-bg-primary" :
  r === "student" ? "badge text-bg-success" : "badge text-bg-secondary";

const tz = "Asia/Bangkok";
const formatDateTH = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: tz, year: "numeric", month: "short", day: "2-digit"
  }).format(d);
};

const toast = Swal.mixin({ toast: true, position: "top-end", showConfirmButton: false, timer: 1800, timerProgressBar: true });

export default function ManageUsersPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ---------- state ----------
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [loading, setLoading] = useState(false);
  const [majors, setMajors] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);

  // ✅ เพิ่ม year_level เข้า form state
  const [form, setForm] = useState({
    username: "", password: "", full_name: "", role: "student", major_id: "", year_level: ""
  });
  const [showPw, setShowPw] = useState(false);

  // sort
  const [sort, setSort] = useState({ key: "created_at", dir: "desc" }); // asc|desc
  const sortedRows = useMemo(() => {
    const r = [...rows];
    const { key, dir } = sort;

    // จัดการ key แบบตัวเลข
    if (key === "year_level") {
      r.sort((a, b) => {
        const da = Number(a?.year_level ?? 0);
        const db = Number(b?.year_level ?? 0);
        return dir === "asc" ? da - db : db - da;
      });
      return r;
    }
    if (key === "created_at") {
      r.sort((a, b) => {
        const da = new Date(a?.created_at || 0).getTime();
        const db = new Date(b?.created_at || 0).getTime();
        return dir === "asc" ? da - db : db - da;
      });
      return r;
    }

    // ค่าอื่นเปรียบเทียบเป็นสตริง
    r.sort((a, b) => {
      const va = (a?.[key] ?? "").toString().toLowerCase();
      const vb = (b?.[key] ?? "").toString().toLowerCase();
      if (va < vb) return dir === "asc" ? -1 : 1;
      if (va > vb) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return r;
  }, [rows, sort]);

  // ---------- guards ----------
  useEffect(() => {
    if (!user) return navigate("/login");
    if (user.role !== "admin") return navigate("/home");
  }, [user, navigate]);

  // ---------- effects ----------
  useEffect(() => {
    listMajors().then((items) => setMajors(items || [])).catch(() => {});
  }, []);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getUsers({ search, role, page, limit });
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "โหลดรายชื่อไม่สำเร็จ", text: e?.message || "กรุณาลองใหม่อีกครั้ง" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search, role, page, limit]);

  // ---------- handlers ----------
  const openCreate = () => {
    setEditing(null);
    setForm({
      username: "", password: "", full_name: "", role: "student", major_id: "", year_level: "" // ✅ reset year_level
    });
    setShowPw(false);
    setShowForm(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      username: u.username,
      password: "",
      full_name: u.full_name || "",
      role: u.role || "student",
      major_id: u.major_id || "",
      year_level: u.year_level || "" // ✅ preload year_level
    });
    setShowPw(false);
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!editing && !form.password) return Swal.fire({ icon: "warning", title: "โปรดกรอกรหัสผ่าน" });
    if (!form.full_name?.trim())   return Swal.fire({ icon: "warning", title: "โปรดกรอกชื่อ-นามสกุล" });
    if (!editing && !form.username?.trim()) return Swal.fire({ icon: "warning", title: "โปรดกรอกรหัส/อีเมล" });

    setSaving(true);
    try {
      if (editing) {
        await updateUser(editing.id, {
          full_name: form.full_name.trim(),
          role: form.role,
          major_id: (form.role === "student" || form.role === "teacher") ? (form.major_id || null) : null,
          year_level: (form.role === "student" && form.year_level) ? Number(form.year_level) : null, // ✅
          ...(form.password ? { password: form.password } : {}),
        });
        toast.fire({ icon: "success", title: "บันทึกการแก้ไขสำเร็จ" });
      } else {
        await createUser({
          username: form.username.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          role: form.role,
          major_id: (form.role === "student" || form.role === "teacher") ? (form.major_id || null) : null,
          year_level: (form.role === "student" && form.year_level) ? Number(form.year_level) : null, // ✅
        });
        toast.fire({ icon: "success", title: "เพิ่มผู้ใช้สำเร็จ" });
      }
      setShowForm(false);
      await load();
    } catch (e2) {
      console.error(e2);
      Swal.fire({ icon: "error", title: "บันทึกไม่สำเร็จ", text: e2?.message || "กรุณาลองใหม่อีกครั้ง" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u) => {
    const result = await Swal.fire({
      icon: "warning", title: `ลบผู้ใช้ ${u.username}?`, text: "การลบไม่สามารถย้อนกลับได้",
      showCancelButton: true, confirmButtonText: "ลบ", cancelButtonText: "ยกเลิก", confirmButtonColor: "#d33",
    });
    if (!result.isConfirmed) return;

    try {
      await deleteUser(u.id);
      toast.fire({ icon: "success", title: "ลบผู้ใช้สำเร็จ" });
      await load();
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "ลบไม่สำเร็จ", text: e?.message || "กรุณาลองใหม่อีกครั้ง" });
    }
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  // ✅ แสดง “สาขา” เฉพาะ นิสิต/อาจารย์ และ “ชั้นปี” เฉพาะ นิสิต
  const showMajor   = form.role === "student" || form.role === "teacher";
  const showYearLvl = form.role === "student";

  // sort helpers
  const sortIcon = (key) => (sort.key !== key ? "bi-arrow-down-up" : sort.dir === "asc" ? "bi-sort-down" : "bi-sort-up");
  const clickSort = (key) => setSort((s) => (s.key !== key ? { key, dir: "asc" } : { key, dir: s.dir === "asc" ? "desc" : "asc" }));

  // focus first input in modal
  const firstInputRef = useRef(null);
  useEffect(() => { if (showForm) setTimeout(() => firstInputRef.current?.focus(), 50); }, [showForm, editing]);

  // ---------- JSX ----------
  return (
    <div className="min-vh-100" style={{ background: "linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%)" }}>
      {/* Top Bar */}
      <div className="d-flex align-items-center px-3" style={{ height: 72, background: "linear-gradient(90deg, #6f42c1, #8e5cff)", boxShadow: "0 4px 14px rgba(111,66,193,.22)" }}>
        <img src="/src/assets/csit.jpg" alt="Logo" className="rounded-3 me-3" style={{ height: 40, width: 40, objectFit: "cover" }} />
        <h5 className="text-white fw-semibold m-0">CSIT Competency System — Admin</h5>
        <div className="ms-auto d-flex align-items-center">
          <span className="text-white-50 me-3">{user ? `${user.username} ${user.fullName || user.full_name || ""}` : ""}</span>
          <button className="btn btn-light btn-sm rounded-pill" onClick={() => { logout?.(); navigate("/login"); }}>ออกจากระบบ</button>
        </div>
      </div>

      <div className="container-xxl py-4">
        {/* Header */}
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <div className="card-body d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <button className="btn btn-outline-secondary btn-sm rounded-pill" onClick={() => navigate(-1)}>← ย้อนกลับ</button>
              <div>
                <h2 className="mb-0">จัดการผู้ใช้</h2>
                <div className="text-muted small">ทั้งหมด {total.toLocaleString()} รายการ</div>
              </div>
            </div>
            <div>
              <button className="btn btn-primary rounded-pill" onClick={openCreate}><i className="bi bi-plus-circle me-1" /> เพิ่มผู้ใช้</button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="card shadow-sm rounded-4 mb-3">
          <div className="card-body d-flex flex-wrap gap-2 align-items-center">
            <div className="input-group" style={{ maxWidth: 380 }}>
              <span className="input-group-text"><i className="bi bi-search" aria-hidden="true" /></span>
              <input
                className="form-control"
                placeholder="ค้นหา ชื่อ/รหัส"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="ค้นหาผู้ใช้"
              />
              {(search || searchInput) && (
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}
                  title="ล้างการค้นหา"
                >
                  ล้าง
                </button>
              )}
            </div>

            <select
              className="form-select"
              style={{ maxWidth: 240 }}
              value={role}
              onChange={(e) => { setPage(1); setRole(e.target.value); }}
              aria-label="กรองตามบทบาท"
            >
              {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>

            <div className="ms-auto d-flex align-items-center gap-2">
              {loading && (
                <span className="text-muted small d-flex align-items-center gap-2">
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  กำลังโหลด…
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card shadow-sm rounded-4">
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0 table-striped">
              <thead className="table-light">
                <tr>
                  <th role="button" onClick={() => clickSort("username")}>
                    รหัส/อีเมล <i className={`bi ${sortIcon("username")} ms-1`} />
                  </th>
                  <th role="button" onClick={() => clickSort("full_name")}>
                    ชื่อ <i className={`bi ${sortIcon("full_name")} ms-1`} />
                  </th>
                  <th>บทบาท</th>
                  {/* ✅ เพิ่มคอลัมน์ชั้นปี พร้อม sort */}
                  <th role="button" onClick={() => clickSort("year_level")}>
                    ชั้นปี <i className={`bi ${sortIcon("year_level")} ms-1`} />
                  </th>
                  <th>สาขา</th>
                  <th role="button" onClick={() => clickSort("created_at")}>
                    สร้างเมื่อ <i className={`bi ${sortIcon("created_at")} ms-1`} />
                  </th>
                  <th className="text-end" style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j}><span className="placeholder col-8" /></td>
                      ))}
                    </tr>
                  ))
                ) : sortedRows.length ? (
                  sortedRows.map((u) => (
                    <tr key={u.id}>
                      <td className="fw-medium text-nowrap">{u.username}</td>
                      <td className="text-nowrap">{u.full_name}</td>
                      <td><span className={roleBadge(u.role)}>{roleText(u.role)}</span></td>
                      {/* ✅ แสดงชั้นปี */}
                      <td className="text-nowrap">{u.year_level ?? "-"}</td>
                      <td className="text-nowrap">{u.dept || u.major_name || "-"}</td>
                      <td className="text-nowrap">{formatDateTH(u.created_at)}</td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-secondary" onClick={() => openEdit(u)}>แก้ไข</button>
                          <button className="btn btn-outline-danger" onClick={() => remove(u)}>ลบ</button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-5 text-muted">
                      <div className="mb-2">ยังไม่มีข้อมูลผู้ใช้</div>
                      <button className="btn btn-primary" onClick={openCreate}>
                        <i className="bi bi-plus-circle me-1" /> เพิ่มผู้ใช้คนแรก
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="d-flex justify-content-end align-items-center gap-2 mt-3">
          <button className="btn btn-sm btn-outline-secondary rounded-pill" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</button>
          <span className="small">หน้า {page}/{Math.max(1, Math.ceil(total / limit))}</span>
          <button className="btn btn-sm btn-outline-secondary rounded-pill" disabled={page >= Math.max(1, Math.ceil(total / limit)) || loading} onClick={() => setPage((p) => p + 1)}>ถัดไป</button>
        </div>

        <div className="text-center text-muted small mt-3">
          ผู้ใช้ทั้งหมด {total.toLocaleString()} รายการ
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.5)" }} role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <form className="modal-content rounded-4" onSubmit={submit}>
              <div className="modal-header border-0">
                <h5 className="modal-title">{editing ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"}</h5>
                <button type="button" className="btn-close" onClick={() => setShowForm(false)} />
              </div>
              <div className="modal-body d-flex flex-column gap-2 pt-0">
                {!editing && (
                  <>
                    <label className="form-label mb-0">รหัส/อีเมล</label>
                    <input
                      ref={firstInputRef}
                      className="form-control"
                      required
                      placeholder="student@nu.ac.th หรือ รหัสนิสิต"
                      value={form.username}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    />
                  </>
                )}

                <label className="form-label mb-0">ชื่อ-นามสกุล</label>
                <input
                  className="form-control"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                />

                <label className="form-label mb-0">รหัสผ่าน {editing ? "(เว้นว่าง = ไม่เปลี่ยน)" : ""}</label>
                <div className="input-group">
                  <input
                    type={showPw ? "text" : "password"}
                    className="form-control"
                    required={!editing}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target.form)?.requestSubmit(); }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    title={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  >
                    <i className={`bi ${showPw ? "bi-eye-slash" : "bi-eye"}`} />
                  </button>
                </div>

                <label className="form-label mb-0">บทบาท</label>
                <select
                  className="form-select"
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      role: e.target.value,
                      major_id: (e.target.value === "student" || e.target.value === "teacher") ? f.major_id : "",
                      year_level: (e.target.value === "student") ? f.year_level : "" // ✅ reset ถ้าไม่ใช่นิสิต
                    }))
                  }
                >
                  <option value="student">นิสิต</option>
                  <option value="teacher">อาจารย์</option>
                  <option value="admin">ผู้ดูแลระบบ</option>
                </select>

                <label className="form-label mb-0">สาขา</label>
                <select
                  className="form-select"
                  value={form.major_id}
                  disabled={!showMajor}
                  onChange={(e) => setForm((f) => ({ ...f, major_id: e.target.value }))}
                  title={!showMajor ? "เลือกได้เฉพาะบทบาทนิสิต/อาจารย์" : undefined}
                >
                  <option value="">-</option>
                  {majors.map((m) => (
                    <option key={m.id} value={m.id}>{m.name || m.name_th || m.name_en}</option>
                  ))}
                </select>
                {!showMajor && <div className="form-text">เฉพาะบทบาทนิสิต/อาจารย์เท่านั้นที่เลือกสาขาได้</div>}

                {/* ✅ ชั้นปี (นิสิตเท่านั้น) */}
                <label className="form-label mb-0">ชั้นปี</label>
                <select
                  className="form-select"
                  value={form.year_level}
                  disabled={!showYearLvl}
                  onChange={(e) => setForm((f) => ({ ...f, year_level: e.target.value }))}
                  title={!showYearLvl ? "เลือกได้เฉพาะบทบาทนิสิต" : undefined}
                >
                  <option value="">-</option>
                  {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                {!showYearLvl && <div className="form-text">เฉพาะบทบาทนิสิตเท่านั้นที่เลือกชั้นปีได้</div>}
              </div>

              <div className="modal-footer border-0">
                <button className="btn btn-secondary rounded-pill" type="button" disabled={saving} onClick={() => setShowForm(false)}>ยกเลิก</button>
                <button className="btn btn-primary rounded-pill" type="submit" disabled={saving}>
                  {saving && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />}
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Local styles */}
      <style>{`
        .table > :not(caption) > * > *{ vertical-align: middle; }
        th[role="button"]{ user-select:none; }
        .form-control:focus, .form-select:focus{
          box-shadow: 0 0 0 .2rem rgba(111,66,193,.12);
          border-color: #8e5cff;
        }
      `}</style>
    </div>
  );
}
