// src/components/admin/ManageUsersPage.jsx
import React, { useEffect, useMemo, useState } from "react";
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

const roleText = (r) => {
  switch (r) {
    case "admin": return "ผู้ดูแลระบบ";
    case "teacher": return "อาจารย์";
    case "student": return "นิสิต";
    default: return r || "-";
  }
};
const roleBadge = (r) => {
  switch (r) {
    case "admin": return "badge text-bg-danger";
    case "teacher": return "badge text-bg-primary";
    case "student": return "badge text-bg-success";
    default: return "badge text-bg-secondary";
  }
};

const toast = Swal.mixin({
  toast: true, position: "top-end", showConfirmButton: false, timer: 1800, timerProgressBar: true,
});

export default function ManageUsersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
  const [form, setForm] = useState({
    username: "", password: "", full_name: "", role: "student", major_id: "",
  });

  // เมนู “จัดการ” แบบ custom dropdown (ไม่ต้องใช้ Bootstrap JS)
  const [menuOpenId, setMenuOpenId] = useState(null);
  useEffect(() => {
    const onDocClick = () => setMenuOpenId(null);
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // guard
  useEffect(() => {
    if (!user) return navigate("/login");
    if (user.role !== "admin") return navigate("/home");
  }, [user, navigate]);

  useEffect(() => { listMajors().then(setMajors).catch(() => {}); }, []);

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

  const openCreate = () => {
    setEditing(null);
    setForm({ username: "", password: "", full_name: "", role: "student", major_id: "" });
    setShowForm(true);
  };
  const openEdit = (u) => {
    setEditing(u);
    setForm({
      username: u.username, password: "", full_name: u.full_name || "",
      role: u.role || "student", major_id: u.major_id || "",
    });
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!editing && !form.password) { Swal.fire({ icon: "warning", title: "โปรดกรอกรหัสผ่าน" }); return; }
    if (!form.full_name?.trim()) { Swal.fire({ icon: "warning", title: "โปรดกรอกชื่อ-นามสกุล" }); return; }
    if (!editing && !form.username?.trim()) { Swal.fire({ icon: "warning", title: "โปรดกรอกรหัส/อีเมล" }); return; }

    setSaving(true);
    try {
      if (editing) {
        await updateUser(editing.id, {
          full_name: form.full_name.trim(),
          role: form.role,
          major_id: (form.role === "student" || form.role === "teacher") ? (form.major_id || null) : null,
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
        });
        toast.fire({ icon: "success", title: "เพิ่มผู้ใช้สำเร็จ" });
      }
      setShowForm(false);
      await load();
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "บันทึกไม่สำเร็จ", text: e?.message || "กรุณาลองใหม่อีกครั้ง" });
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
  const showMajor  = form.role === "student" || form.role === "teacher";

  return (
    <div className="container py-4">
      {/* Header: เพิ่มปุ่มย้อนกลับ */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate(-1)}>
            ← ย้อนกลับ
          </button>
          <div>
            <h2 className="mb-1">จัดการผู้ใช้</h2>
            <div className="text-muted small">ทั้งหมด {total.toLocaleString()} รายการ</div>
          </div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-primary" onClick={openCreate}>+ เพิ่มผู้ใช้</button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card shadow-sm mb-3">
        <div className="card-body d-flex flex-wrap gap-2 align-items-center">
          <div className="input-group" style={{ maxWidth: 360 }}>
            <span className="input-group-text"><i className="bi bi-search" aria-hidden="true" /></span>
            <input
              className="form-control"
              placeholder="ค้นหา ชื่อ/รหัส"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="ค้นหาผู้ใช้"
            />
          </div>

          <select
            className="form-select"
            style={{ maxWidth: 220 }}
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
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0 table-striped">
            <thead className="table-light">
              <tr>
                <th>รหัส/อีเมล</th>
                <th>ชื่อ</th>
                <th>บทบาท</th>
                <th>สาขา</th>
                <th>สร้างเมื่อ</th>
                <th className="text-end" style={{ width: 64 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-5">
                    <div className="spinner-border" role="status" aria-hidden="true" />
                    <div className="small text-muted mt-2">กำลังโหลดข้อมูล…</div>
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((u) => (
                  <tr key={u.id}>
                    <td className="fw-medium">{u.username}</td>
                    <td>{u.full_name}</td>
                    <td><span className={roleBadge(u.role)}>{roleText(u.role)}</span></td>
                    <td>{u.dept || "-"}</td>
                    <td>{u.created_at?.slice(0, 10) || "-"}</td>
                    <td className="text-end position-relative">
                       <div className="btn-group btn-group-sm">
                      <button
                        className="btn btn-outline-secondary"
                        onClick={() => openEdit(u)}
                      >
                        แก้ไข
                      </button>
                      <button
                        className="btn btn-outline-danger"
                        onClick={() => remove(u)}
                      >
                        ลบ
                      </button>
                    </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-muted">
                    <div className="mb-2">ยังไม่มีข้อมูลผู้ใช้</div>
                    <button className="btn btn-primary" onClick={openCreate}>+ เพิ่มผู้ใช้คนแรก</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="d-flex justify-content-end align-items-center gap-2 mt-3">
        <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
          ก่อนหน้า
        </button>
        <span className="small">หน้า {page}/{totalPages}</span>
        <button className="btn btn-sm btn-outline-secondary" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
          ถัดไป
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.5)" }} role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <form className="modal-content" onSubmit={submit}>
              <div className="modal-header">
                <h5 className="modal-title">{editing ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"}</h5>
                <button type="button" className="btn-close" onClick={() => setShowForm(false)} />
              </div>
              <div className="modal-body d-flex flex-column gap-2">
                {!editing && (
                  <>
                    <label className="form-label mb-0">รหัส/อีเมล</label>
                    <input
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
                <input
                  type="password"
                  className="form-control"
                  required={!editing}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />

                <label className="form-label mb-0">บทบาท</label>
                <select
                  className="form-select"
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      role: e.target.value,
                      major_id:
                        e.target.value === "student" || e.target.value === "teacher" ? f.major_id : "",
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
                >
                  <option value="">-</option>
                  {majors.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                {!showMajor && <div className="form-text">เฉพาะบทบาทนิสิต/อาจารย์เท่านั้นที่เลือกสาขาได้</div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" type="button" disabled={saving} onClick={() => setShowForm(false)}>
                  ยกเลิก
                </button>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />}
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
