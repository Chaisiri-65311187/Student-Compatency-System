import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCompetency } from '../contexts/CompetencyContext';
import Swal from 'sweetalert2';
import 'bootstrap/dist/css/bootstrap.min.css';

const EditDataPage = () => {
  const { user } = useAuth();
  const { updateCompetency } = useCompetency(); // ยังไม่ดึงข้อมูลจริง
  const navigate = useNavigate();

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
  });

  // ตั้งค่า user ใน formData ทันทีที่โหลด
  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else {
      setFormData(prev => ({
        ...prev,
        studentId: user.username,
        name: user.fullName,
        department: user.department || '',
      }));
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProjectFileChange = (e) => {
    setFormData(prev => ({ ...prev, projectFile: e.target.files[0] }));
  };

  const handleActivityFileChange = (e) => {
    setFormData(prev => ({ ...prev, activityFile: e.target.files[0] }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    Swal.fire({
      title: "ยืนยันการอัปเดตข้อมูล?",
      text: "คุณต้องการอัปเดตข้อมูลนี้หรือไม่",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ใช่, อัปเดตข้อมูล",
      cancelButtonText: "ยกเลิก",
    }).then((result) => {
      if (result.isConfirmed) {
        updateCompetency(formData); // ส่ง formData
        Swal.fire("สำเร็จ!", "อัปเดตข้อมูลเรียบร้อยแล้ว", "success").then(() => {
          navigate('/home');
          window.scrollTo(0, 0);
        });
      }
    });
  };

  const handleCancel = () => {
    Swal.fire({
      title: "ยกเลิกการแก้ไข?",
      text: "ข้อมูลที่แก้ไขจะไม่ถูกบันทึก",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ใช่, ยกเลิก",
      cancelButtonText: "กลับไปแก้ไขต่อ",
    }).then((result) => {
      if (result.isConfirmed) {
        navigate('/home');
        window.scrollTo(0, 0);
      }
    });
  };

  if (!user) return <div>กำลังโหลดข้อมูล...</div>;

  return (
    <div style={{ backgroundColor: '#f4f7fa', minHeight: '100vh' }}>
      {/* Top Bar */}
      <div className="d-flex align-items-center p-2" style={{ height: '60px', backgroundColor: '#6f42c1' }}>
        <img src="/src/assets/csit.jpg" alt="Logo" style={{ height: '50px', margin: '0 10px' }} />
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
          <h2 className="text-center mb-4">แก้ไขข้อมูลสมรรถนะของตนเอง</h2>

          <form onSubmit={handleSubmit}>
            <div className="row">
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
                        <option value={`วิชา ${index + 1}`}>วิชา {index + 1}</option>
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
                <label className="form-label">ผลงาน (เลือกใหม่ถ้าต้องการอัปเดต)</label>
                <input type="file" className="form-control" name="projectFile" onChange={handleProjectFileChange} />
              </div>

              <div className="col-12 mb-3">
                <label className="form-label">กิจกรรมเสริม (เลือกใหม่ถ้าต้องการอัปเดต)</label>
                <input type="file" className="form-control" name="activityFile" onChange={handleActivityFileChange} />
              </div>

              {/* Buttons */}
              <div className="d-flex justify-content-between mt-4">
                <button type="submit" className="btn btn-primary w-80">บันทึก</button>
                <button type="button" className="btn btn-secondary w-60" onClick={handleCancel}>ยกเลิก</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditDataPage;
