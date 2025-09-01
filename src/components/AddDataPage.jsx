import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // เพิ่มการนำเข้า Link
import { useAuth } from '../contexts/AuthContext'; // ใช้ useAuth เพื่อดึงข้อมูลผู้ใช้
import 'bootstrap/dist/css/bootstrap.min.css';

const AddDataPage = () => {
  const { user } = useAuth(); // ดึงข้อมูลผู้ใช้จาก AuthContext
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
    transcriptFile: null, // ฟิลด์ใหม่สำหรับไฟล์ที่เกี่ยวข้องกับเกรด
    activityFile: null, // ฟิลด์ใหม่สำหรับกิจกรรมเสริม
  });

  const [isGradeEntered, setIsGradeEntered] = useState(false);  // ตรวจสอบว่าเกรดถูกกรอกหรือไม่
  const navigate = useNavigate();

  // ใช้ useEffect เพื่อดึงข้อมูลผู้ใช้ที่ล็อกอินแล้วและกรอกข้อมูลลงในฟอร์ม
  useEffect(() => {
    if (!user) {
      // ถ้าไม่มีข้อมูลผู้ใช้ (ยังไม่ได้ล็อกอิน) ให้ส่งไปหน้า login
      navigate('/login');
    } else {
      // ถ้ามีข้อมูลผู้ใช้ ให้ตั้งค่า formData
      setFormData((prev) => ({
        ...prev,
        studentId: user.username,      // กรอกข้อมูลรหัสนิสิต
        name: user.fullName,           // กรอกข้อมูลชื่อ
        department: user.department || '',  // กรอกข้อมูลสาขา
      }));
    }
  }, [user, navigate]); // ถ้า `user` เปลี่ยนแปลง, ให้ทำการอัพเดท `formData`

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // ตรวจสอบว่าเกรดถูกกรอกหรือไม่
    if (name === 'grade' && value) {
      setIsGradeEntered(true);
    } else if (name === 'grade' && !value) {
      setIsGradeEntered(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // ทำการส่งข้อมูลหรือบันทึกข้อมูลที่กรอก
    console.log('ข้อมูลที่กรอก: ', formData);
    // นำทางไปยังหน้าอื่นหลังจากส่งข้อมูล
    navigate('/home');
  };

  const handleLogout = () => {
    // ฟังก์ชันออกจากระบบ
    navigate('/login');
  };

  // ฟังก์ชันสำหรับจัดการการอัปโหลดไฟล์โปรเจค
  const handleProjectFileChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      projectFile: e.target.files[0], // เก็บไฟล์ที่เลือก
    }));
  };

  // ฟังก์ชันสำหรับจัดการการอัปโหลดไฟล์กิจกรรมเสริม
  const handleActivityFileChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      activityFile: e.target.files[0], // เก็บไฟล์ที่เลือก
    }));
  };

  // หากไม่มีข้อมูลผู้ใช้ ให้แสดงข้อความ หรือหยุดการแสดงผล
  if (!user) {
    return <div>กำลังโหลดข้อมูล...</div>; // หรือแสดงหน้าว่างจนกว่าจะโหลดข้อมูล
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
          <Link to="/home" className="btn btn-light btn-sm me-2">ย้อนกลับ</Link>
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

            {/* ปุ่มสำหรับแนบไฟล์ Transcript เมื่อกรอกเกรดแล้ว */}
            {isGradeEntered && (
              <div className="col-12 mb-3">
                <label className="form-label">แนบไฟล์ Transcript</label>
                <input
                  type="file"
                  className="form-control"
                  name="transcriptFile"
                  onChange={handleTranscriptFileChange}
                />
              </div>
            )}

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
