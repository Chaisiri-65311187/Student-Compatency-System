import React from 'react';
import { useCompetency } from '../contexts/CompetencyContext'; // ใช้ Competency Context
import { useAuth } from '../contexts/AuthContext'; // ใช้ AuthContext เพื่อดึงข้อมูลผู้ใช้
import { useNavigate } from 'react-router-dom'; // ใช้ navigate สำหรับนำทาง

const StudentInfoPage = () => {
  const { user } = useAuth(); // ดึงข้อมูลผู้ใช้จาก context
  const { competencyData } = useCompetency(); // ดึงข้อมูลสมรรถนะจาก CompetencyContext
  const navigate = useNavigate();

  // ตรวจสอบว่าเป็นอาจารย์หรือไม่ ถ้าไม่ใช่จะไม่สามารถเข้าถึงหน้านี้ได้
  if (user?.role !== 'teacher') {
    navigate('/home'); // ถ้าไม่ใช่อาจารย์จะนำทางกลับไปที่หน้า HomePage
    return null; // หยุดการแสดงผล
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
          <span className="text-white me-3">{user?.fullName}</span>
          <button className="btn btn-light btn-sm" onClick={() => navigate('/login')}>ออกจากระบบ</button>
        </div>
      </div>

      <div className="container my-5">
        <h2 className="text-center mb-4">ข้อมูลสมรรถนะของนิสิต</h2>

        {/* แสดงข้อมูลนิสิตในรูปแบบการ์ด */}
        <div className="row g-4">
          {competencyData.map((item, index) => (
            <div key={index} className="col-md-4">
              <div className="card shadow-sm">
                <div className="card-body">
                  <h5>{item.studentId}</h5>
                  <p><strong>ชื่อ:</strong> {item.name}</p>
                  <p><strong>สาขา:</strong> {item.department}</p> {/* แสดงสาขา */}
                  <p><strong>วิชาเลือก:</strong> {item.subject1}, {item.subject2}, {item.subject3}, {item.subject4}, {item.subject5}, {item.subject6}</p>
                  <p><strong>ชั้นปี:</strong> {item.year}</p>
                  <p><strong>เกรด:</strong> {item.grade}</p>
                  <p><strong>ทักษะ:</strong> {item.skill}</p>
                  <p><strong>Hard Skill:</strong> {item.hardSkill}</p>
                  <p><strong>Soft Skill:</strong> {item.softSkill}</p>
                  <p><strong>ไฟล์โปรเจค:</strong> {item.projectFile ? item.projectFile.name : 'ไม่มีไฟล์'}</p>
                  <p><strong>ไฟล์ Transcript:</strong> {item.transcriptFile ? item.transcriptFile.name : 'ไม่มีไฟล์'}</p>
                  <p><strong>ไฟล์กิจกรรมเสริม:</strong> {item.activityFile ? item.activityFile.name : 'ไม่มีไฟล์'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudentInfoPage;
