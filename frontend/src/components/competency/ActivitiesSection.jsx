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
      <h6 className="mb-2">กิจกรรมด้านสังคม</h6>

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr>
              <th style={{ minWidth: 180 }}>ชื่อกิจกรรม</th>
              <th>ประเภท</th>
              <th>บทบาท</th>
              <th>ชั่วโมง</th>
              <th style={{ minWidth: 220 }}>ช่วงเวลา</th>
              <th style={{ minWidth: 160 }}>หลักฐาน</th>
              <th className="text-end" style={{ width: 160 }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-muted">
                  กำลังโหลด…
                </td>
              </tr>
            ) : (
              <>
                {items.map((it) => {
                  const isEdit = editingId === it.id;
                  return (
                    <tr key={it.id}>
                      <td>
                        {isEdit ? (
                          <input
                            className="form-control"
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
                            className="form-select"
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
                          it.subtype || "-"
                        )}
                      </td>

                      <td>
                        {isEdit ? (
                          <select
                            className="form-select"
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
                            className={`badge ${
                              it.role === "staff"
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
                            className="form-control"
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
                              className="form-control"
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
                              className="form-control"
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
                          `${it.date_from || "-"} ~ ${it.date_to || "-"}`
                        )}
                      </td>

                      <td style={{ minWidth: 160 }}>
                        {isEdit ? (
                          <input
                            className="form-control"
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
                          <a href={it.proof_url} target="_blank" rel="noreferrer">
                            link
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="text-end">
                        {isEdit ? (
                          <div className="btn-group btn-group-sm">
                            <button
                              className="btn btn-primary"
                              onClick={() => saveEdit(it.id)}
                              disabled={editSaving}
                            >
                              {editSaving ? "กำลังบันทึก..." : "บันทึก"}
                            </button>
                            <button
                              className="btn btn-outline-secondary"
                              onClick={cancelEdit}
                              disabled={editSaving}
                            >
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <div className="btn-group btn-group-sm">
                            <button
                              className="btn btn-outline-secondary"
                              onClick={() => startEdit(it)}
                              disabled={deletingId === it.id}
                            >
                              แก้ไข
                            </button>
                            <button
                              className="btn btn-outline-danger"
                              onClick={() => remove(it)}
                              disabled={deletingId === it.id}
                            >
                              {deletingId === it.id ? "กำลังลบ..." : "ลบ"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!items.length && !loading && (
                  <tr>
                    <td colSpan={7} className="text-muted">
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
      <div className="border rounded p-3">
        <div className="row g-2">
          <div className="col-md-4">
            <label className="form-label">ชื่อกิจกรรม</label>
            <input
              className="form-control"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={adding}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">ประเภทย่อย</label>
            <select
              className="form-select"
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
            <label className="form-label">บทบาท</label>
            <select
              className="form-select"
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
            <label className="form-label">ชั่วโมง</label>
            <input
              className="form-control"
              type="number"
              min="0"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              disabled={adding}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">จากวันที่</label>
            <input
              className="form-control"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={adding}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">ถึงวันที่</label>
            <input
              className="form-control"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={adding}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">หลักฐาน (URL)</label>
            <input
              className="form-control"
              type="url"
              placeholder="https://..."
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              disabled={adding}
            />
          </div>
          <div className="col-12">
            <button
              className="btn btn-outline-primary"
              onClick={onAdd}
              disabled={adding}
            >
              {adding ? "กำลังบันทึก..." : "เพิ่มกิจกรรม"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
