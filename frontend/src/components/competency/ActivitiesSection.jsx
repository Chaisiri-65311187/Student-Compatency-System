// src/components/competency/ActivitiesSection.jsx
import React, { useEffect, useState } from "react";
import {
  listActivities,
  addActivity,
  updateActivity,
  deleteActivity,
} from "../../services/competencyApi";

// helper: ISO → yyyy-MM-dd (สำหรับ input[type=date])
const toDateInput = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
};

export default function ActivitiesSection({ user, category }) {
  const [items, setItems] = useState([]);

  // ฟอร์มเพิ่ม
  const [title, setTitle] = useState("");
  const [subtype, setSubtype] = useState("");
  const [role, setRole] = useState("");
  const [hours, setHours] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [proof, setProof] = useState("");

  // โหมดแก้ไข
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({
    title: "", subtype: "", role: "", hours: "", date_from: "", date_to: "", proof_url: ""
  });

  const refresh = async () => {
    const r = await listActivities(user.id, category);
    setItems(r.items || []);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [category]);

  const onAdd = async () => {
    if (!title.trim()) return alert("กรอกชื่อกิจกรรม");
    await addActivity({
      account_id: user.id, category,
      subtype: subtype || null, title: title.trim(),
      role: role || null, hours: hours ? Number(hours) : null,
      date_from: from || null, date_to: to || null, proof_url: proof || null,
    });
    setTitle(""); setSubtype(""); setRole(""); setHours(""); setFrom(""); setTo(""); setProof("");
    await refresh();
  };

  const startEdit = (it) => {
    setEditingId(it.id);
    setEdit({
      title: it.title || "",
      subtype: it.subtype || "",
      role: it.role || "",
      hours: it.hours ?? "",
      date_from: toDateInput(it.date_from),
      date_to: toDateInput(it.date_to),
      proof_url: it.proof_url || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdit({ title:"", subtype:"", role:"", hours:"", date_from:"", date_to:"", proof_url:"" });
  };

  const saveEdit = async (id) => {
    if (!edit.title.trim()) return alert("กรอกชื่อกิจกรรม");
    await updateActivity(id, {
      account_id: user.id,
      category,
      title: edit.title.trim(),
      subtype: edit.subtype || null,
      role: edit.role || null,
      hours: edit.hours !== "" ? Number(edit.hours) : null,
      date_from: edit.date_from || null,
      date_to: edit.date_to || null,
      proof_url: edit.proof_url || null,
    });
    cancelEdit();
    await refresh();
  };

  const remove = async (it) => {
    if (!window.confirm(`ลบกิจกรรม "${it.title}" ?`)) return;
    await deleteActivity(it.id, user.id);
    await refresh();
  };

  return (
    <div>
      <h6 className="mb-2">
        {category === "social" ? "กิจกรรมด้านสังคม" : "กิจกรรมด้านการสื่อสาร"}
      </h6>

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr>
              <th style={{minWidth:180}}>ชื่อกิจกรรม</th>
              <th>ประเภท</th>
              <th>บทบาท</th>
              <th>ชั่วโมง</th>
              <th>ช่วงเวลา</th>
              <th>หลักฐาน</th>
              <th className="text-end" style={{width:160}} />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const isEdit = editingId === it.id;
              return (
                <tr key={it.id}>
                  {/* ชื่อกิจกรรม */}
                  <td>
                    {isEdit ? (
                      <input
                        className="form-control"
                        value={edit.title}
                        onChange={(e)=>setEdit(s=>({...s,title:e.target.value}))}
                      />
                    ) : it.title}
                  </td>

                  {/* ประเภทย่อย */}
                  <td>
                    {isEdit ? (
                      <input
                        className="form-control"
                        value={edit.subtype}
                        onChange={(e)=>setEdit(s=>({...s,subtype:e.target.value}))}
                        placeholder="volunteer/presentation/paper"
                      />
                    ) : (it.subtype || "-")}
                  </td>

                  {/* บทบาท */}
                  <td>
                    {isEdit ? (
                      <input
                        className="form-control"
                        value={edit.role}
                        onChange={(e)=>setEdit(s=>({...s,role:e.target.value}))}
                        placeholder="ผู้เข้าร่วม/ผู้จัด/วิทยากร"
                      />
                    ) : (it.role || "-")}
                  </td>

                  {/* ชั่วโมง */}
                  <td style={{width:120}}>
                    {isEdit ? (
                      <input
                        className="form-control"
                        type="number"
                        value={edit.hours}
                        onChange={(e)=>setEdit(s=>({...s,hours:e.target.value}))}
                      />
                    ) : (it.hours ?? "-")}
                  </td>

                  {/* ช่วงเวลา */}
                  <td style={{minWidth:220}}>
                    {isEdit ? (
                      <div className="d-flex gap-1">
                        <input
                          className="form-control"
                          type="date"
                          value={edit.date_from}
                          onChange={(e)=>setEdit(s=>({...s,date_from:e.target.value}))}
                        />
                        <span className="align-self-center">~</span>
                        <input
                          className="form-control"
                          type="date"
                          value={edit.date_to}
                          onChange={(e)=>setEdit(s=>({...s,date_to:e.target.value}))}
                        />
                      </div>
                    ) : (
                      `${it.date_from || "-"} ~ ${it.date_to || "-"}`
                    )}
                  </td>

                  {/* หลักฐาน */}
                  <td style={{minWidth:160}}>
                    {isEdit ? (
                      <input
                        className="form-control"
                        value={edit.proof_url}
                        onChange={(e)=>setEdit(s=>({...s,proof_url:e.target.value}))}
                        placeholder="URL"
                      />
                    ) : (
                      it.proof_url ? <a href={it.proof_url} target="_blank" rel="noreferrer">link</a> : "-"
                    )}
                  </td>

                  {/* actions */}
                  <td className="text-end">
                    {isEdit ? (
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-primary" onClick={()=>saveEdit(it.id)}>บันทึก</button>
                        <button className="btn btn-outline-secondary" onClick={cancelEdit}>ยกเลิก</button>
                      </div>
                    ) : (
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-secondary" onClick={()=>startEdit(it)}>แก้ไข</button>
                        <button className="btn btn-outline-danger" onClick={()=>remove(it)}>ลบ</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {!items.length && (
              <tr>
                <td colSpan={7} className="text-muted">ยังไม่มีรายการ</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ฟอร์มเพิ่มรายการใหม่ */}
      <div className="border rounded p-3">
        <div className="row g-2">
          <div className="col-md-4">
            <label className="form-label">ชื่อกิจกรรม</label>
            <input className="form-control" value={title} onChange={(e)=>setTitle(e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label">ประเภทย่อย</label>
            <input className="form-control" value={subtype} onChange={(e)=>setSubtype(e.target.value)} placeholder="volunteer/presentation/paper" />
          </div>
          <div className="col-md-3">
            <label className="form-label">บทบาท</label>
            <input className="form-control" value={role} onChange={(e)=>setRole(e.target.value)} placeholder="ผู้เข้าร่วม/ผู้จัด/วิทยากร" />
          </div>
          <div className="col-md-2">
            <label className="form-label">ชั่วโมง</label>
            <input className="form-control" type="number" value={hours} onChange={(e)=>setHours(e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label">จากวันที่</label>
            <input className="form-control" type="date" value={from} onChange={(e)=>setFrom(e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label">ถึงวันที่</label>
            <input className="form-control" type="date" value={to} onChange={(e)=>setTo(e.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label">หลักฐาน URL</label>
            <input className="form-control" value={proof} onChange={(e)=>setProof(e.target.value)} />
          </div>
          <div className="col-12">
            <button className="btn btn-outline-primary" onClick={onAdd}>เพิ่มกิจกรรม</button>
          </div>
        </div>
      </div>
    </div>
  );
}
