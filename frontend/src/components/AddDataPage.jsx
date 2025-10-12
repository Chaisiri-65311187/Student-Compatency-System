// src/components/AddDataPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCompetency } from "../contexts/CompetencyContext";
import Swal from "sweetalert2";

export const electiveSubjects = [
  { code: "254274", name: "Python Programming" },
  { code: "254384", name: "Cloud Computing" },
  { code: "254451", name: "Software Engineering" },
  { code: "254471", name: "Modern Computer Languages" },
  { code: "254475", name: "Program Auditing" },
  { code: "254483", name: "Sensing and Actuation for Internet of Things" },
  { code: "254484", name: "Functional Programming" },
  { code: "254486", name: "Data Science" },
  { code: "273353", name: "Electronics Commerce" },
  { code: "273362", name: "Multimedia Application Development" },
  { code: "273371", name: "Information Retrieval" },
  { code: "273372", name: "Server Side Web Programming" },
  { code: "273374", name: "Java programming for information technology" },
  { code: "273375", name: "Fundamentals of Data Mining" },
  { code: "273376", name: "Programming with .Net Framework" },
  { code: "273381", name: "Computer Graphics and Animation" },
  { code: "273383", name: "Entrepreneurship in Computer Technology" },
  { code: "273384", name: "Knowledge Management" },
  { code: "273386", name: "Geographic Information Systems" },
  { code: "273387", name: "Mobile Application Development" },
  { code: "273389", name: "Game Design and Development" },
  { code: "273453", name: "Decision Support Systems" },
  { code: "273481", name: "Business Record and Logistics Management" },
  { code: "273483", name: "Enterprise Resource Planning" },
  { code: "273487", name: "Special Topics in Information Technology" },
  { code: "273488", name: "Digital Image Processing" },
];

const MAX_IMAGE_MB = 2;

const AddDataPage = () => {
  const { user, logout } = useAuth();
  const { addCompetency } = useCompetency();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    studentId: "",
    name: "",
    department: "",
    subject1: "",
    subject2: "",
    subject3: "",
    subject4: "",
    subject5: "",
    subject6: "",
    year: "",
    grade: "",
    hardSkill: "",
    softSkill: "",
    projectFile: null,
    activityFile: null,
    profileImage: null, // base64
  });

  useEffect(() => {
    if (!user) {
      navigate("/login");
    } else {
      setFormData((prev) => ({
        ...prev,
        studentId: user.username,
        name: user.fullName,
        department: user.department || "",
      }));
    }
  }, [user, navigate]);

  const selectedSubjects = useMemo(() => {
    return [
      formData.subject1,
      formData.subject2,
      formData.subject3,
      formData.subject4,
      formData.subject5,
      formData.subject6,
    ].filter(Boolean);
  }, [formData]);

  const isDuplicateSubject = (value, index) => {
    if (!value) return false;
    const arr = [
      formData.subject1,
      formData.subject2,
      formData.subject3,
      formData.subject4,
      formData.subject5,
      formData.subject6,
    ];
    return arr.some((v, i) => v === value && i !== index);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // ถ้าเป็น subject ให้เช็คซ้ำ
    const match = /^subject([1-6])$/.exec(name);
    if (match) {
      const idx = Number(match[1]) - 1;
      if (isDuplicateSubject(value, idx)) {
        Swal.fire("ซ้ำ!", "วิชานี้ถูกเลือกไปแล้วในช่องอื่น", "warning");
        return;
      }
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      Swal.fire("ไฟล์ไม่ถูกต้อง", "กรุณาเลือกไฟล์รูปภาพเท่านั้น", "error");
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      Swal.fire("ไฟล์ใหญ่เกินไป", `ขนาดรูปต้องไม่เกิน ${MAX_IMAGE_MB}MB`, "error");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, profileImage: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const clearProfileImage = () => {
    setFormData((prev) => ({ ...prev, profileImage: null }));
  };

  const handleProjectFileChange = (e) => {
    setFormData((prev) => ({ ...prev, projectFile: e.target.files?.[0] || null }));
  };

  const handleActivityFileChange = (e) => {
    setFormData((prev) => ({ ...prev, activityFile: e.target.files?.[0] || null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // ตัวอย่างตรวจเกรด (ถ้าอยากให้เป็นตัวเลข 0.00-4.00)
    // if (!/^(?:[0-3](?:\.\d{1,2})?|4(?:\.0{1,2})?)$/.test(formData.grade)) {
    //   Swal.fire("รูปแบบเกรดไม่ถูกต้อง", "กรุณากรอกเกรดเป็น 0.00 - 4.00", "warning");
    //   return;
    // }

    Swal.fire({
      title: "ยืนยันการส่งข้อมูล?",
      text: "คุณต้องการส่งข้อมูลนี้หรือไม่",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ใช่, ส่งข้อมูล",
      cancelButtonText: "ยกเลิก",
    }).then((result) => {
      if (result.isConfirmed) {
        addCompetency(formData);
        Swal.fire("สำเร็จ!", "ส่งข้อมูลเรียบร้อยแล้ว", "success").then(() => {
          navigate("/home");
          window.scrollTo(0, 0);
        });
      }
    });
  };

  const handleCancel = () => {
    Swal.fire({
      title: "ยกเลิกการกรอกข้อมูล?",
      text: "ข้อมูลที่กรอกจะไม่ถูกบันทึก",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ใช่, ยกเลิก",
      cancelButtonText: "กลับไปกรอกต่อ",
    }).then((result) => {
      if (result.isConfirmed) {
        navigate("/home");
        window.scrollTo(0, 0);
      }
    });
  };

  if (!user) return <div>กำลังโหลดข้อมูล...</div>;

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
        <h5 className="text-white fw-semibold m-0">CSIT Competency System</h5>

        <div className="ms-auto d-flex align-items-center">
          <span className="text-white-50 me-3">{user ? `${user.username} ${user.fullName}` : "ไม่พบผู้ใช้"}</span>
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

      {/* Form Container */}
      <div className="container-xxl py-4">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-8 col-xl-7">
            <div
              className="card border-0 shadow-sm rounded-4"
              style={{ backdropFilter: "blur(6px)", background: "rgba(255,255,255,.95)" }}
            >
              <div className="card-body p-4 p-lg-5">
                <h2 className="h4 fw-semibold text-center mb-4">กรอกข้อมูลสมรรถนะของตนเอง</h2>

                <form onSubmit={handleSubmit}>
                  {/* SECTION: ผู้ใช้ */}
                  <div className="mb-4">
                    <div className="small text-uppercase text-muted fw-semibold mb-3">ข้อมูลผู้ใช้</div>
                    <div className="row g-3">
                      <div className="col-sm-6">
                        <div className="form-floating">
                          <input type="text" className="form-control" id="studentId" value={formData.studentId} readOnly />
                          <label htmlFor="studentId">รหัสนิสิต</label>
                        </div>
                      </div>
                      <div className="col-sm-6">
                        <div className="form-floating">
                          <input type="text" className="form-control" id="name" value={formData.name} readOnly />
                          <label htmlFor="name">ชื่อ</label>
                        </div>
                      </div>
                      <div className="col-sm-6">
                        <div className="form-floating">
                          <input type="text" className="form-control" id="department" value={formData.department} readOnly />
                          <label htmlFor="department">สาขา</label>
                        </div>
                      </div>

                      {/* รูปโปรไฟล์ */}
                      <div className="col-sm-6">
                        <label className="form-label">รูปโปรไฟล์</label>
                        <input
                          type="file"
                          className="form-control"
                          accept="image/*"
                          onChange={handleProfileImageChange}
                        />
                        <div className="form-text">รองรับไฟล์รูป (สูงสุด {MAX_IMAGE_MB}MB)</div>
                        {formData.profileImage && (
                          <div className="d-flex align-items-center gap-3 mt-2">
                            <img
                              src={formData.profileImage}
                              alt="Profile"
                              style={{ width: 90, height: 90, objectFit: "cover", borderRadius: "12px" }}
                            />
                            <button type="button" className="btn btn-outline-danger btn-sm" onClick={clearProfileImage}>
                              ลบรูป
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SECTION: วิชาเลือก */}
                  <div className="mb-4">
                    <div className="small text-uppercase text-muted fw-semibold mb-3">วิชาเลือก</div>
                    <div className="row g-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="col-12 col-md-6">
                          <div className="form-floating">
                            <select
                              className="form-select"
                              id={`subject${i + 1}`}
                              name={`subject${i + 1}`}
                              value={formData[`subject${i + 1}`]}
                              onChange={handleChange}
                            >
                              <option value="">— เลือกวิชา {i + 1} —</option>
                              {electiveSubjects.map((s) => (
                                <option key={s.code} value={s.name} disabled={selectedSubjects.includes(s.name) && formData[`subject${i + 1}`] !== s.name}>
                                  {s.name} ({s.code})
                                </option>
                              ))}
                            </select>
                            <label htmlFor={`subject${i + 1}`}>วิชา {i + 1}</label>
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedSubjects.length > 0 && (
                      <div className="mt-2 small text-muted">
                        เลือกแล้ว: {selectedSubjects.join(", ")}
                      </div>
                    )}
                  </div>

                  {/* SECTION: ชั้นปี / เกรด / ทักษะ */}
                  <div className="mb-4">
                    <div className="small text-uppercase text-muted fw-semibold mb-3">ชั้นปี & เกรด & ทักษะ</div>
                    <div className="row g-3">
                      <div className="col-sm-4">
                        <div className="form-floating">
                          <select className="form-select" id="year" name="year" value={formData.year} onChange={handleChange} required>
                            <option value="">เลือกชั้นปี</option>
                            <option value="1">ชั้นปี 1</option>
                            <option value="2">ชั้นปี 2</option>
                            <option value="3">ชั้นปี 3</option>
                            <option value="4">ชั้นปี 4</option>
                          </select>
                          <label htmlFor="year">ชั้นปี</label>
                        </div>
                      </div>

                      <div className="col-sm-4">
                        <div className="form-floating">
                          <input
                            type="text"
                            className="form-control"
                            id="grade"
                            name="grade"
                            value={formData.grade}
                            onChange={handleChange}
                            placeholder="เช่น 3.25"
                            required
                          />
                          <label htmlFor="grade">เกรดเฉลี่ย</label>
                        </div>
                      </div>

                      <div className="col-sm-12">
                        <div className="form-floating mb-3">
                          <input
                            type="text"
                            className="form-control"
                            id="hardSkill"
                            name="hardSkill"
                            value={formData.hardSkill}
                            onChange={handleChange}
                            placeholder="ระบุ Hard Skill"
                            required
                          />
                          <label htmlFor="hardSkill">Hard Skill</label>
                        </div>
                        <div className="form-floating">
                          <input
                            type="text"
                            className="form-control"
                            id="softSkill"
                            name="softSkill"
                            value={formData.softSkill}
                            onChange={handleChange}
                            placeholder="ระบุ Soft Skill"
                            required
                          />
                          <label htmlFor="softSkill">Soft Skill</label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION: ไฟล์แนบ */}
                  <div className="mb-4">
                    <div className="small text-uppercase text-muted fw-semibold mb-3">ไฟล์แนบ</div>
                    <div className="row g-3">
                      <div className="col-sm-6">
                        <label className="form-label">ผลงาน (Project)</label>
                        <input type="file" className="form-control" onChange={handleProjectFileChange} />
                        {formData.projectFile && (
                          <div className="form-text">ไฟล์: {formData.projectFile.name}</div>
                        )}
                      </div>
                      <div className="col-sm-6">
                        <label className="form-label">กิจกรรมเสริม (Activity)</label>
                        <input type="file" className="form-control" onChange={handleActivityFileChange} />
                        {formData.activityFile && (
                          <div className="form-text">ไฟล์: {formData.activityFile.name}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="d-flex flex-wrap gap-2 justify-content-end">
                    <button type="button" className="btn btn-outline-secondary rounded-3" onClick={handleCancel}>
                      ยกเลิก
                    </button>
                    <button type="submit" className="btn btn-primary rounded-3">
                      ส่งข้อมูล
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="text-center text-muted small mt-3">
              ตรวจทานข้อมูลให้ถูกต้องก่อนกด “ส่งข้อมูล”
            </div>
          </div>
        </div>
      </div>

      {/* Local styles */}
      <style>{`
        .form-control:focus, .form-select:focus{
          box-shadow: 0 0 0 .2rem rgba(111,66,193,.12);
          border-color: #8e5cff;
        }
      `}</style>
    </div>
  );
};

export default AddDataPage;
