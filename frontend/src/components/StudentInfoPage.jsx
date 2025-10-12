import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCompetency } from '../contexts/CompetencyContext';
import { useAnnouncements } from '../contexts/AnnouncementsContext';
import { useNavigate } from 'react-router-dom';

const StudentInfoPage = () => {
  const { user } = useAuth(); // ดึงข้อมูลผู้ใช้จาก AuthContext
  const { competencyData } = useCompetency(); // ดึงข้อมูลสมรรถนะนิสิตจาก CompetencyContext
  const { announcements } = useAnnouncements();
  const navigate = useNavigate();

  // กรองข้อมูลด้วยตัวกรอง
  const [filters, setFilters] = useState({
    departments: [], // สาขาที่เลือก
    years: [], // ชั้นปีที่เลือก
  });

  const [filteredData, setFilteredData] = useState(competencyData);

  // ตรวจสอบว่าเป็นอาจารย์หรือไม่ ถ้าไม่ใช่จะไม่สามารถเข้าถึงหน้านี้ได้
  if (user?.role !== 'teacher') {
    navigate('/home'); // ถ้าไม่ใช่อาจารย์จะนำทางกลับไปที่หน้า HomePage
    return null; // หยุดการแสดงผล
  }

  // ฟังก์ชันกรองข้อมูลสมรรถนะนิสิตตามตัวกรอง
  useEffect(() => {
    const result = competencyData.filter((item) => {
      const matchesDepartment = filters.departments.length ? filters.departments.includes(item.department) : true;
      const matchesYear = filters.years.length ? filters.years.includes(item.year.toString()) : true;
      return matchesDepartment && matchesYear;
    });
    setFilteredData(result);
  }, [filters, competencyData]);

  // ฟังก์ชันเปลี่ยนแปลงตัวกรอง
  const handleFilterChange = (e) => {
    const { name, value, checked } = e.target;
    if (checked) {
      setFilters((prevFilters) => ({
        ...prevFilters,
        [name]: [...prevFilters[name], value],
      }));
    } else {
      setFilters((prevFilters) => ({
        ...prevFilters,
        [name]: prevFilters[name].filter((item) => item !== value),
      }));
    }
  };

  return (
    <div style={{ backgroundColor: '#f4f7fa', minHeight: '100vh' }}>
      {/* Top Bar */}
      <div className="d-flex align-items-center p-2" style={{ height: '80px', backgroundColor: '#6f42c1' }}>
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

      <div className="d-flex">
        {/* Sidebar */}
        <div className="p-4" style={{ width: '250px', backgroundColor: '#ffffff', boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)' }}>
          <h5 className="mb-4">ตัวกรอง</h5>

          {/* ตัวกรองสาขา */}
          <div className="mb-4">
            <h6>สาขา</h6>
            <div>
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  name="departments"
                  value="วิทยาการคอมพิวเตอร์"
                  checked={filters.departments.includes('วิทยาการคอมพิวเตอร์')}
                  onChange={handleFilterChange}
                />
                <label className="form-check-label">วิทยาการคอมพิวเตอร์</label>
              </div>
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  name="departments"
                  value="เทคโนโลยีสารสนเทศ"
                  checked={filters.departments.includes('เทคโนโลยีสารสนเทศ')}
                  onChange={handleFilterChange}
                />
                <label className="form-check-label">เทคโนโลยีสารสนเทศ</label>
              </div>
            </div>
          </div>

          {/* ตัวกรองชั้นปี */}
          <div>
            <h6>ชั้นปี</h6>
            <div>
              {[1, 2, 3, 4].map((year) => (
                <div key={year} className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    name="years"
                    value={year}
                    checked={filters.years.includes(year.toString())}
                    onChange={handleFilterChange}
                  />
                  <label className="form-check-label">ชั้นปี {year}</label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container my-5" style={{ minHeight: 'calc(100vh - 70px)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}
          >
            <h2 className="mb-0">ประกาศรับสมัครจากอาจารย์</h2>

            <div className="d-flex gap-2">
              <button
                className="btn btn-success"
                onClick={() => navigate('/create-announcement')}
              >
                สร้างประกาศรับสมัคร
              </button>

            </div>
          </div>

          {/* แสดงข้อมูลนิสิตในรูปแบบการ์ด */}
          <div className="row g-4">
            {filteredData.length > 0 ? (
              filteredData.map((item, index) => (
                <div key={index} className="col-md-4">
                  <div className="card shadow-lg border-light rounded-3">
                    <div className="card-body">
                      <h5 className="card-title text-center">{item.studentId}</h5>
                      <p><strong>ชื่อ:</strong> {item.name}</p>
                      <p><strong>สาขา:</strong> {item.department}</p>
                      <p><strong>วิชาเลือก:</strong></p>
                      <ul>
                        {[item.subject1, item.subject2, item.subject3, item.subject4, item.subject5, item.subject6].map((subj, idx) => (
                          <li key={idx}>{subj}</li>
                        ))}
                      </ul>
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
              ))
            ) : (
              <p>ไม่มีข้อมูลสมรรถนะนิสิต</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentInfoPage;
