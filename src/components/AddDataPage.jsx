import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCompetency } from '../contexts/CompetencyContext'; // นำเข้า useCompetency
import 'bootstrap/dist/css/bootstrap.min.css';

const AddDataPage = () => {
  const { user } = useAuth();
  const { addCompetency } = useCompetency(); // ใช้ฟังก์ชัน addCompetency
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
    skill: '',
    softSkill: '',
    projectFile: null,
    hardSkill: '',
    transcriptFile: null,
    activityFile: null,
  });

  const [isGradeEntered, setIsGradeEntered] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // ตรวจสอบว่าเป็นผู้ใช้งานที่ล็อกอินหรือไม่ ถ้ายังไม่ได้ล็อกอินจะนำไปที่หน้า login
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
  }, [user, navigate]); // เมื่อ `user` เปลี่ยนแปลงจะทำการอัปเดต `formData` หรือเปลี่ยนเส้นทางไปที่ login

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === 'grade' && value) {
      setIsGradeEntered(true);
    } else if (name === 'grade' && !value) {
      setIsGradeEntered(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('ข้อมูลที่กรอก: ', formData);

    // เรียกใช้ addCompetency เพื่อเพิ่มข้อมูลใน CompetencyContext
    addCompetency(formData);

    navigate('/home');
  };

  const handleLogout = () => {
    navigate('/login');
  };

  const handleTranscriptFileChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      transcriptFile: e.target.files[0],
    }));
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

  if (!user) {
    return <div>กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div style={{ backgroundColor: '#FFF8F0', minHeight: '100vh' }}>
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
          <button className="btn btn-light btn-sm" onClick={handleLogout}>ออกจากระบบ</button>
        </div>
      </div>

      <div className="container my-5" style={{ minHeight: 'calc(100vh - 60px)' }}>
        <h2 className="text-center mb-4">กรอกข้อมูลสมรรถนะของตนเอง</h2>

        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="col-12 mb-3">
              <label className="form-label">รหัสนิสิต</label>
              <input
                type="text"
                className="form-control"
                name="studentId"
                value={formData.studentId}
                onChange={handleChange}
                required
                readOnly
              />
            </div>

            <div className="col-12 mb-3">
              <label className="form-label">ชื่อ</label>
              <input
                type="text"
                className="form-control"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                readOnly
              />
            </div>

            <div className="col-12 mb-3">
              <label className="form-label">สาขา</label>
              <input
                type="text"
                className="form-control"
                name="department"
                value={formData.department}
                onChange={handleChange}
                required
                readOnly
              />
            </div>

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

            <div className="col-12 mb-3">
              <label className="form-label">ชั้นปี</label>
              <select
                className="form-select"
                name="year"
                value={formData.year}
                onChange={handleChange}
                required
              >
                <option value="">เลือกชั้นปี</option>
                <option value="1">ชั้นปี 1</option>
                <option value="2">ชั้นปี 2</option>
                <option value="3">ชั้นปี 3</option>
                <option value="4">ชั้นปี 4</option>
              </select>
            </div>

            <div className="col-12 mb-3">
              <label className="form-label">เกรด</label>
              <input
                type="text"
                className="form-control"
                name="grade"
                value={formData.grade}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-12 mb-3">
              <label className="form-label">Hard Skill</label>
              <input
                type="text"
                className="form-control"
                name="hardSkill"
                value={formData.hardSkill}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-12 mb-3">
              <label className="form-label">Soft Skill</label>
              <input
                type="text"
                className="form-control"
                name="softSkill"
                value={formData.softSkill}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-12 mb-3">
              <label className="form-label">ผลงาน</label>
              <input
                type="file"
                className="form-control"
                name="projectFile"
                onChange={handleProjectFileChange}
              />
            </div>

            <div className="col-12 mb-3">
              <label className="form-label">กิจกรรมเสริม</label>
              <input
                type="file"
                className="form-control"
                name="activityFile"
                onChange={handleActivityFileChange}
              />
            </div>

            <div className="col-12">
              <button type="submit" className="btn btn-dark w-100">
                ส่งข้อมูล
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDataPage;
