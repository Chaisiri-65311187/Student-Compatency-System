import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCompetency } from '../contexts/CompetencyContext';
import Swal from 'sweetalert2';
import 'bootstrap/dist/css/bootstrap.min.css';

export const electiveSubjects = [
  { code: '254274', name: 'Python Programming' },
  { code: '254384', name: 'Cloud Computing' },
  { code: '254451', name: 'Software Engineering' },
  { code: '254471', name: 'Modern Computer Languages' },
  { code: '254475', name: 'Program Auditing' },
  { code: '254483', name: 'Sensing and Actuation for Internet of Things' },
  { code: '254484', name: 'Functional Programming' },
  { code: '254486', name: 'Data Science' },
  { code: '273353', name: 'Electronics Commerce' },
  { code: '273362', name: 'Multimedia Application Development' },
  { code: '273371', name: 'Information Retrieval' },
  { code: '273372', name: 'Server Side Web Programming' },
  { code: '273374', name: 'Java programming for information technology' },
  { code: '273375', name: 'Fundamentals of Data Mining' },
  { code: '273376', name: 'Programming with .Net Framework' },
  { code: '273381', name: 'Computer Graphics and Animation' },
  { code: '273383', name: 'Entrepreneurship in Computer Technology' },
  { code: '273384', name: 'Knowledge Management' },
  { code: '273386', name: 'Geographic Information Systems' },
  { code: '273387', name: 'Mobile Application Development' },
  { code: '273389', name: 'Game Design and Development' },
  { code: '273453', name: 'Decision Support Systems' },
  { code: '273481', name: 'Business Record and Logistics Management' },
  { code: '273483', name: 'Enterprise Resource Planning' },
  { code: '273487', name: 'Special Topics in Information Technology' },
  { code: '273488', name: 'Digital Image Processing' },
];

const AddDataPage = () => {
  const { user } = useAuth();
  const { addCompetency } = useCompetency();
  const [formData, setFormData] = useState({
    studentId: '',
    name: '',
    department: '',
    subject1: '',
    subject2: '',
    subject3: '',
    subject4: '',
    subject5: '',
    subject6: '',
    year: '',
    grade: '',
    hardSkill: '',
    softSkill: '',
    projectFile: null,
    activityFile: null,
    profileImage: null, // ฟิลด์สำหรับรูปภาพ
  });

  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else {
      setFormData((prev) => ({
        ...prev,
        studentId: user.username,
        name: user.fullName,
        department: user.department || '',
      }));
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        profileImage: reader.result, // เก็บข้อมูลรูปภาพใน base64
      }));
    };

    if (file) {
      reader.readAsDataURL(file); // อ่านไฟล์รูปภาพและแปลงเป็น base64
    }
  };

  const handleProjectFileChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      projectFile: e.target.files[0],
    }));
  };

  const handleActivityFileChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      activityFile: e.target.files[0],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    Swal.fire({
      title: "ยืนยันการส่งข้อมูล?",
      text: "คุณต้องการส่งข้อมูลนี้หรือไม่",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ใช่, ส่งข้อมูล",
      cancelButtonText: "ยกเลิก",
    }).then((result) => {
      if (result.isConfirmed) {
        addCompetency(formData); // เพิ่มข้อมูล
        Swal.fire("สำเร็จ!", "ส่งข้อมูลเรียบร้อยแล้ว", "success").then(() => {
          navigate('/home');
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
        navigate('/home'); // ตรวจสอบว่าเส้นทางนี้ถูกต้องหรือไม่
        window.scrollTo(0, 0);
      }
    });
  };

  if (!user) {
    return <div>กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div style={{ backgroundColor: '#f4f7fa', minHeight: '100vh' }}>
      {/* Top Bar */}
      <div className="d-flex align-items-center p-2" style={{ height: '60px', backgroundColor: '#6f42c1' }}>
        <img
          src="/src/assets/csit.jpg"
          alt="Logo"
          style={{ height: '50px', marginLeft: '10px', marginRight: '10px' }}
        />
        <h5 className="text-white fw-bold m-0" style={{ marginLeft: '10px' }}>CSIT Competency System</h5>
        <div className="ms-auto d-flex align-items-center">
          <span className="text-white me-3">{user ? `${user.username} ${user.fullName}` : 'ไม่พบผู้ใช้'}</span>
          <button className="btn btn-light btn-sm" onClick={() => navigate('/login')}>ออกจากระบบ</button>
        </div>
      </div>

      {/* Form Container */}
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 'calc(100vh - 60px)' }}>
        <div
          style={{
            backgroundColor: 'white',
            padding: '40px',
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            width: '100%',
            maxWidth: '600px',
            marginTop: '20px',
            marginBottom: '20px',
          }}
        >
          <h2 className="text-center mb-4">กรอกข้อมูลสมรรถนะของตนเอง</h2>

          <form onSubmit={handleSubmit}>
            <div className="row">
              {/* Profile Image */}
              <div className="col-12 mb-3">
                <label className="form-label">รูปภาพ</label>
                <input
                  type="file"
                  className="form-control"
                  name="profileImage"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                />
              </div>
              {formData.profileImage && (
                <div className="col-12 text-center mb-3">
                  <img
                    src={formData.profileImage}
                    alt="Profile"
                    style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '50%' }}
                  />
                </div>
              )}

              {/* Student Info */}
              <div className="col-12 mb-3">
                <label className="form-label">รหัสนิสิต</label>
                <input type="text" className="form-control" name="studentId" value={formData.studentId} readOnly />
              </div>
              <div className="col-12 mb-3">
                <label className="form-label">ชื่อ</label>
                <input type="text" className="form-control" name="name" value={formData.name} readOnly />
              </div>
              <div className="col-12 mb-3">
                <label className="form-label">สาขา</label>
                <input type="text" className="form-control" name="department" value={formData.department} readOnly />
              </div>

              {/* Subject Fields */}
              <div className="col-12 mb-3">
                <label className="form-label">วิชาเลือก</label>
                <div className="row">
                  {[...Array(6)].map((_, index) => (
                    <div key={index} className="col-12 mb-3">
                      <select
                        className="form-select"
                        name={`subject${index + 1}`}
                        value={formData[`subject${index + 1}`]}
                        onChange={handleChange}
                      >
                        <option value="">เลือกวิชา {index + 1}</option>
                        {electiveSubjects.map((subj) => (
                          <option key={subj.code} value={subj.name}>
                            {subj.name} ({subj.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Year, Grade, Skills */}
              <div className="col-12 mb-3">
                <label className="form-label">ชั้นปี</label>
                <select className="form-select" name="year" value={formData.year} onChange={handleChange} required>
                  <option value="">เลือกชั้นปี</option>
                  <option value="1">ชั้นปี 1</option>
                  <option value="2">ชั้นปี 2</option>
                  <option value="3">ชั้นปี 3</option>
                  <option value="4">ชั้นปี 4</option>
                </select>
              </div>

              <div className="col-12 mb-3">
                <label className="form-label">เกรด</label>
                <input type="text" className="form-control" name="grade" value={formData.grade} onChange={handleChange} required />
              </div>

              <div className="col-12 mb-3">
                <label className="form-label">Hard Skill</label>
                <input type="text" className="form-control" name="hardSkill" value={formData.hardSkill} onChange={handleChange} required />
              </div>

              <div className="col-12 mb-3">
                <label className="form-label">Soft Skill</label>
                <input type="text" className="form-control" name="softSkill" value={formData.softSkill} onChange={handleChange} required />
              </div>

              {/* Files */}
              <div className="col-12 mb-3">
                <label className="form-label">ผลงาน</label>
                <input type="file" className="form-control" name="projectFile" onChange={handleProjectFileChange} />
              </div>

              <div className="col-12 mb-3">
                <label className="form-label">กิจกรรมเสริม</label>
                <input type="file" className="form-control" name="activityFile" onChange={handleActivityFileChange} />
              </div>

              {/* Buttons */}
              <div className="d-flex justify-content-between mt-4">
                <button type="submit" className="btn btn-primary w-80">ส่งข้อมูล</button>
                <button type="button" className="btn btn-secondary w-60" onClick={handleCancel}>ยกเลิก</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddDataPage;
