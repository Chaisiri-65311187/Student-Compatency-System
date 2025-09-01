import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css';

const HomePage = () => {
  const [filterYear, setFilterYear] = useState({
    year1: false,
    year2: false,
    year3: false,
    year4: false,
  });
  const [filterDepartment, setFilterDepartment] = useState({
    cs: false,
    it: false,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const { user, logout } = useAuth(); // ใช้ useAuth เพื่อดึงข้อมูลผู้ใช้
  const navigate = useNavigate(); // ใช้ navigate สำหรับการนำทางหลังออกจากระบบ

  const [data] = useState([
    { name: 'งานที่ 1', course: 'คอมพิวเตอร์', date: '2025-09-01', year: 4, department: 'วิทยาการคอมพิวเตอร์' },
    { name: 'งานที่ 2', course: 'เทคโนโลยีสารสนเทศ', date: '2025-09-02', year: 3, department: 'เทคโนโลยีสารสนเทศ' },
    { name: 'งานที่ 3', course: 'วิศวกรรมคอมพิวเตอร์', date: '2025-09-03', year: 2, department: 'วิทยาการคอมพิวเตอร์' },
    { name: 'งานที่ 4', course: 'คอมพิวเตอร์', date: '2025-09-04', year: 1, department: 'เทคโนโลยีสารสนเทศ' },
    // เพิ่มข้อมูลตัวอย่าง
  ]);

  // ฟิลเตอร์ข้อมูล
  const filteredData = data.filter(item =>
    (filterYear.year1 && item.year === 1) ||
    (filterYear.year2 && item.year === 2) ||
    (filterYear.year3 && item.year === 3) ||
    (filterYear.year4 && item.year === 4) ||
    (filterDepartment.cs && item.department === 'วิทยาการคอมพิวเตอร์') ||
    (filterDepartment.it && item.department === 'เทคโนโลยีสารสนเทศ') ||
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ฟังก์ชันสำหรับการอัปเดตตัวกรองชั้นปี
  const handleYearChange = (year) => {
    setFilterYear((prevState) => ({
      ...prevState,
      [year]: !prevState[year],
    }));
  };

  // ฟังก์ชันสำหรับการอัปเดตตัวกรองสาขา
  const handleDepartmentChange = (department) => {
    setFilterDepartment((prevState) => ({
      ...prevState,
      [department]: !prevState[department],
    }));
  };

  // ฟังก์ชัน logout
  const handleLogout = () => {
    logout();
    navigate('/login'); // นำทางไปหน้า Login
  };

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
          <Link to="/add-data" className="btn btn-light btn-sm me-2">เพิ่มข้อมูล</Link>
          <button className="btn btn-light btn-sm" onClick={handleLogout}>ออกจากระบบ</button>
        </div>
      </div>

      <div className="d-flex">
        {/* Sidebar */}
        <div
          className="p-4"
          style={{
            width: '250px',
            backgroundColor: '#343a40',
            color: '#fff',
            height: '100vh',
            borderRight: '1px solid #ddd',
          }}
        >
          <h5 className="text-white">ตัวกรอง</h5>

          {/* ตัวกรองชั้นปี */}
          <h6>ชั้นปี</h6>
          <div>
            {['year1', 'year2', 'year3', 'year4'].map((year) => (
              <div key={year} className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id={year}
                  checked={filterYear[year]}
                  onChange={() => handleYearChange(year)}
                />
                <label className="form-check-label" htmlFor={year}>
                  ชั้นปี {year.charAt(year.length - 1)}
                </label>
              </div>
            ))}
          </div>

          {/* ตัวกรองสาขา */}
          <h6>สาขา</h6>
          <div>
            {['cs', 'it'].map((department) => (
              <div key={department} className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id={department}
                  checked={filterDepartment[department]}
                  onChange={() => handleDepartmentChange(department)}
                />
                <label className="form-check-label" htmlFor={department}>
                  {department === 'cs' ? 'วิทยาการคอมพิวเตอร์' : 'เทคโนโลยีสารสนเทศ'}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* เนื้อหาหลัก */}
        <div className="p-4 w-100">
          <div className="d-flex justify-content-between align-items-center mb-4">
            {/* แถบค้นหา */}
            <input
              type="text"
              className="form-control w-50"
              placeholder="ค้นหางาน"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* รายการสมรรถนะนิสิต */}
          <div className="row g-4">
            {filteredData.map((item, index) => (
              <div key={index} className="col-md-4">
                <div className="card shadow-sm border-light rounded">
                  <div className="card-body">
                    <h5>{item.name}</h5>
                    <p><strong>วิชา:</strong> {item.course}</p>
                    <p><strong>วันที่:</strong> {item.date}</p>
                    <p><strong>ชั้นปี:</strong> {item.year}</p>
                    <p><strong>สาขา:</strong> {item.department}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
