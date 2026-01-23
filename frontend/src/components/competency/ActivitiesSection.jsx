// src/components/competency/ActivitiesSection.jsx
import React, { useEffect, useState } from "react";
import {
  listActivities,
  addActivity,
  updateActivity,
  deleteActivity,
} from "../../services/competencyApi";
import Swal from "sweetalert2";

const toDateInput = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
};

// ✅ Toast มุมขวาบน
const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 1800,
  timerProgressBar: true,
});

// ✅ บทบาท (เหลือแค่ 2)
const ROLE_OPTIONS = [
  { value: "participant", label: "ผู้เข้าร่วม" },
  { value: "staff", label: "สตาฟ" },
];

// ✅ ประเภทย่อย (3 ตัวเลือก)
const SUBTYPE_OPTIONS = [
  { value: "กิจกรรมกลาง", label: "กิจกรรมกลาง" },
  { value: "กิจกรรมคณะ", label: "กิจกรรมคณะ" },
  { value: "กิจกรรมเลือกเสรี", label: "กิจกรรมเลือกเสรี" },
];

// ===== helpers =====
const validUrl = (u) => {
  if (!u) return true;
  try {
    const x = new URL(u);
    return !!x.protocol && !!x.host;
  } catch {
    return false;
  }
};
const validateRange = (from, to) => {
  if (!from || !to) return true;
  return new Date(from).getTime() <= new Date(to).getTime();
};

export default function ActivitiesSection({ user }) {
  const category = "social"; // 🔒 fix ให้แสดงเฉพาะกิจกรรมด้านสังคม

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // add form
  const [title, setTitle] = useState("");
  const [subtype, setSubtype] = useState("กิจกรรมกลาง");
  const [role, setRole] = useState("participant");
  const [hours, setHours] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [proof, setProof] = useState("");
  const [adding, setAdding] = useState(false);

  // edit form
  const [editingId, setEditingId] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [edit, setEdit] = useState({
    title: "",
    subtype: "กิจกรรมกลาง",
    role: "participant",
    hours: "",
    date_from: "",
    date_to: "",
    proof_url: "",
  });

  const refresh = async () => {
    try {
      setLoading(true);
      const r = await listActivities(user.id, category);
      setItems(r.items || []);
    } catch (e) {
      Swal.fire("โหลดข้อมูลไม่สำเร็จ", e?.message || "กรุณาลองใหม่", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
    // eslint-disable-next-line
  }, []);

  const onAdd = async () => {
    // ✅ ตรวจข้อมูล
    if (!title.trim())
      return Swal.fire("ยังไม่กรอกชื่อกิจกรรม", "กรุณากรอกชื่อกิจกรรม", "warning");

    if (!validateRange(from, to))
      return Swal.fire("ช่วงเวลาไม่ถูกต้อง", "วันที่เริ่มควรไม่เกินวันที่สิ้นสุด", "warning");

    if (proof && !validUrl(proof))
      return Swal.fire("URL ไม่ถูกต้อง", "โปรดใส่ลิงก์หลักฐานให้ถูกต้อง", "warning");

    const hnum = hours === "" ? null : Number(hours);
    if (hnum !== null && (!Number.isFinite(hnum) || hnum < 0))
      return Swal.fire("ชั่วโมงไม่ถูกต้อง", "กรุณาใส่ตัวเลขตั้งแต่ 0 ขึ้นไป", "warning");

    try {
      setAdding(true);
      await addActivity({
        account_id: user.id,
        category,
        subtype: subtype || null,
        title: title.trim(),
        role: role || "participant",
        hours: hnum,
        date_from: from || null,
        date_to: to || null,
        proof_url: proof || null,
      });
      // reset
      setTitle("");
      setSubtype("กิจกรรมกลาง");
      setRole("participant");
      setHours("");
      setFrom("");
      setTo("");
      setProof("");
      await refresh();
      Toast.fire({ icon: "success", title: "เพิ่มกิจกรรมแล้ว" });
    } catch (e) {
      Swal.fire("บันทึกไม่สำเร็จ", e?.message || "กรุณาลองใหม่", "error");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (it) => {
    setEditingId(it.id);
    setEdit({
      title: it.title || "",
      subtype:
        SUBTYPE_OPTIONS.some((s) => s.value === it.subtype)
          ? it.subtype
          : "กิจกรรมกลาง",
      role: ["participant", "staff"].includes(it.role) ? it.role : "participant",
      hours: it.hours ?? "",
      date_from: toDateInput(it.date_from),
      date_to: toDateInput(it.date_to),
      proof_url: it.proof_url || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdit({
      title: "",
      subtype: "กิจกรรมกลาง",
      role: "participant",
      hours: "",
      date_from: "",
      date_to: "",
      proof_url: "",
    });
  };

  const saveEdit = async (id) => {
    // ✅ ตรวจข้อมูล
    if (!edit.title.trim())
      return Swal.fire("ยังไม่กรอกชื่อกิจกรรม", "กรุณากรอกชื่อกิจกรรม", "warning");

    if (!validateRange(edit.date_from, edit.date_to))
      return Swal.fire("ช่วงเวลาไม่ถูกต้อง", "วันที่เริ่มควรไม่เกินวันที่สิ้นสุด", "warning");

    if (edit.proof_url && !validUrl(edit.proof_url))
      return Swal.fire("URL ไม่ถูกต้อง", "โปรดใส่ลิงก์หลักฐานให้ถูกต้อง", "warning");

    const hnum = edit.hours === "" ? null : Number(edit.hours);
    if (hnum !== null && (!Number.isFinite(hnum) || hnum < 0))
      return Swal.fire("ชั่วโมงไม่ถูกต้อง", "กรุณาใส่ตัวเลขตั้งแต่ 0 ขึ้นไป", "warning");

    try {
      setEditSaving(true);
      await updateActivity(id, {
        account_id: user.id,
        category,
        title: edit.title.trim(),
        subtype: edit.subtype || null,
        role: edit.role || "participant",
        hours: hnum,
        date_from: edit.date_from || null,
        date_to: edit.date_to || null,
        proof_url: edit.proof_url || null,
      });
      cancelEdit();
      await refresh();
      Toast.fire({ icon: "success", title: "บันทึกการแก้ไขแล้ว" });
    } catch (e) {
      Swal.fire("บันทึกไม่สำเร็จ", e?.message || "กรุณาลองใหม่", "error");
    } finally {
      setEditSaving(false);
    }
  };

  const remove = async (it) => {
    const c = await Swal.fire({
      icon: "warning",
      title: `ลบกิจกรรม?`,
      text: `"${it.title}" จะถูกลบถาวร`,
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#d33",
    });
    if (!c.isConfirmed) return;

    try {
      setDeletingId(it.id);
      await deleteActivity(it.id, user.id);
      await refresh();
      Toast.fire({ icon: "success", title: "ลบกิจกรรมแล้ว" });
    } catch (e) {
      Swal.fire("ลบไม่สำเร็จ", e?.message || "กรุณาลองใหม่", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <h6 className="fw-bold mb-3">กิจกรรมด้านสังคม</h6>

      <div className="table-responsive rounded-4 shadow-sm border-0 mb-4">
        <table className="table align-middle table-hover mb-0">
          <thead className="table-light">
            <tr>
              <th style={{ minWidth: 180, borderTop: "none" }}>ชื่อกิจกรรม</th>
              <th style={{ borderTop: "none" }}>ประเภท</th>
              <th style={{ borderTop: "none" }}>บทบาท</th>
              <th style={{ borderTop: "none" }}>ชั่วโมง</th>
              <th style={{ minWidth: 220, borderTop: "none" }}>ช่วงเวลา</th>
              <th style={{ minWidth: 160, borderTop: "none" }}>หลักฐาน</th>
              <th className="text-end" style={{ width: 160, borderTop: "none" }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-muted p-4 text-center">
                  <div className="spinner-border spinner-border-sm me-2" role="status" />
                  กำลังโหลด…
                </td>
              </tr>
            ) : (
              <>
                {items.map((it) => {
                  const isEdit = editingId === it.id;
                  return (
                    <tr key={it.id}>
                      <td className="fw-semibold text-dark">
                        {isEdit ? (
                          <input
                            className="form-control rounded-3"
                            value={edit.title}
                            onChange={(e) =>
                              setEdit((s) => ({ ...s, title: e.target.value }))
                            }
                            disabled={editSaving}
                          />
                        ) : (
                          it.title
                        )}
                      </td>

                      <td>
                        {isEdit ? (
                          <select
                            className="form-select rounded-3"
                            value={edit.subtype}
                            onChange={(e) =>
                              setEdit((s) => ({ ...s, subtype: e.target.value }))
                            }
                            disabled={editSaving}
                          >
                            {SUBTYPE_OPTIONS.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="badge text-bg-light border text-dark rounded-pill">
                            {it.subtype || "-"}
                          </span>
                        )}
                      </td>

                      <td>
                        {isEdit ? (
                          <select
                            className="form-select rounded-3"
                            value={edit.role}
                            onChange={(e) =>
                              setEdit((s) => ({ ...s, role: e.target.value }))
                            }
                            disabled={editSaving}
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`badge rounded-pill ${it.role === "staff"
                                ? "text-bg-primary"
                                : "text-bg-secondary"
                              }`}
                          >
                            {ROLE_OPTIONS.find((r) => r.value === it.role)?.label ||
                              it.role ||
                              "-"}
                          </span>
                        )}
                      </td>

                      <td style={{ width: 120 }}>
                        {isEdit ? (
                          <input
                            className="form-control rounded-3"
                            type="number"
                            min="0"
                            value={edit.hours}
                            onChange={(e) =>
                              setEdit((s) => ({ ...s, hours: e.target.value }))
                            }
                            disabled={editSaving}
                          />
                        ) : (
                          it.hours ?? "-"
                        )}
                      </td>

                      <td style={{ minWidth: 220 }}>
                        {isEdit ? (
                          <div className="d-flex gap-1">
                            <input
                              className="form-control rounded-3"
                              type="date"
                              value={edit.date_from}
                              onChange={(e) =>
                                setEdit((s) => ({
                                  ...s,
                                  date_from: e.target.value,
                                }))
                              }
                              disabled={editSaving}
                            />
                            <span className="align-self-center">~</span>
                            <input
                              className="form-control rounded-3"
                              type="date"
                              value={edit.date_to}
                              onChange={(e) =>
                                setEdit((s) => ({
                                  ...s,
                                  date_to: e.target.value,
                                }))
                              }
                              disabled={editSaving}
                            />
                          </div>
                        ) : (
                          <span className="text-muted small">
                            {it.date_from || "-"} <span className="mx-1">~</span> {it.date_to || "-"}
                          </span>
                        )}
                      </td>

                      <td style={{ minWidth: 160 }}>
                        {isEdit ? (
                          <input
                            className="form-control rounded-3"
                            value={edit.proof_url}
                            onChange={(e) =>
                              setEdit((s) => ({
                                ...s,
                                proof_url: e.target.value,
                              }))
                            }
                            placeholder="URL"
                            disabled={editSaving}
                          />
                        ) : it.proof_url ? (
                          <a href={it.proof_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary rounded-pill">
                            Link
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="text-end">
                        {isEdit ? (
                          <div className="btn-group btn-group-sm">
                            <button
                              className="btn btn-primary rounded-start-pill"
                              onClick={() => saveEdit(it.id)}
                              disabled={editSaving}
                            >
                              {editSaving ? "…" : "บันทึก"}
                            </button>
                            <button
                              className="btn btn-outline-secondary rounded-end-pill"
                              onClick={cancelEdit}
                              disabled={editSaving}
                            >
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <div className="d-flex justify-content-end gap-1">
                            <button
                              className="btn btn-sm btn-light border rounded-circle shadow-sm"
                              onClick={() => startEdit(it)}
                              disabled={deletingId === it.id}
                              title="แก้ไข"
                              style={{ width: 32, height: 32, padding: 0 }}
                            >
                              <i className="bi bi-pencil-square" />
                            </button>
                            <button
                              className="btn btn-sm btn-light border rounded-circle shadow-sm text-danger"
                              onClick={() => remove(it)}
                              disabled={deletingId === it.id}
                              title="ลบ"
                              style={{ width: 32, height: 32, padding: 0 }}
                            >
                              <i className="bi bi-trash" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!items.length && !loading && (
                  <tr>
                    <td colSpan={7} className="text-muted text-center p-4">
                      ยังไม่มีรายการ
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ ฟอร์มเพิ่มรายการใหม่ */}
      {/* ✅ ฟอร์มเพิ่มรายการใหม่ */}
      <div className="card border-0 shadow-sm rounded-4 bg-light">
        <div className="card-body">
          <h6 className="fw-semibold text-primary mb-3">
            <i className="bi bi-plus-circle me-2"></i>เพิ่มกิจกรรมใหม่
          </h6>
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label small text-muted">ชื่อกิจกรรม</label>
              <input
                className="form-control rounded-3 border-0"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={adding}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label small text-muted">ประเภทย่อย</label>
              <select
                className="form-select rounded-3 border-0"
                value={subtype}
                onChange={(e) => setSubtype(e.target.value)}
                disabled={adding}
              >
                {SUBTYPE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small text-muted">บทบาท</label>
              <select
                className="form-select rounded-3 border-0"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={adding}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small text-muted">ชั่วโมง</label>
              <input
                className="form-control rounded-3 border-0"
                type="number"
                min="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                disabled={adding}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label small text-muted">จากวันที่</label>
              <input
                className="form-control rounded-3 border-0"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                disabled={adding}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label small text-muted">ถึงวันที่</label>
              <input
                className="form-control rounded-3 border-0"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={adding}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label small text-muted">หลักฐาน (URL)</label>
              <input
                className="form-control rounded-3 border-0"
                type="url"
                placeholder="https://..."
                value={proof}
                onChange={(e) => setProof(e.target.value)}
                disabled={adding}
              />
            </div>
            <div className="col-md-3 d-flex align-items-end">
              <button
                className="btn btn-primary w-100 rounded-pill shadow-sm"
                onClick={onAdd}
                disabled={adding}
                style={{ background: "linear-gradient(135deg, #0d6efd, #0a58ca)", border: "none" }}
              >
                {adding ? "…" : "บันทึกเพิ่ม"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
