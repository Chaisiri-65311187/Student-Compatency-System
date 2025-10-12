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
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  const [announcements] = useState([
    {
      title: 'TA คอมพิวเตอร์',
      teacher: 'อ.สมชาย ใจดี',
      workDate: '2025-09-10 ถึง 2025-12-10',
      year: 4,
      department: 'วิทยาการคอมพิวเตอร์',
      description: 'ช่วยสอนวิชาโปรแกรมมิ่งและตรวจงานนักศึกษา พร้อมทั้งช่วยจัดเตรียมสื่อการสอน',
    },
    {
      title: 'ผู้ช่วยทำโปรเจ็ค IT',
      teacher: 'อ.สุดา แก้วใส',
      workDate: '2025-09-15 ถึง 2025-11-30',
      year: 3,
      department: 'เทคโนโลยีสารสนเทศ',
      description: 'ช่วยนักศึกษาทำโปรเจ็คด้านระบบเครือข่ายและฐานข้อมูล พร้อมรายงานผลการทดลอง',
    },
    {
      title: 'โปรเจ็ควิศวกรรมคอมพิวเตอร์',
      teacher: 'อ.ปกรณ์ สายทอง',
      workDate: '2025-10-01 ถึง 2025-12-15',
      year: 2,
      department: 'วิทยาการคอมพิวเตอร์',
      description: 'เข้าร่วมพัฒนาโปรเจ็คฮาร์ดแวร์และซอฟต์แวร์ตามโจทย์ของอาจารย์',
    },
  ]);

  const filteredAnnouncements = announcements.filter(item => {
    const yearSelected =
      (!filterYear.year1 && !filterYear.year2 && !filterYear.year3 && !filterYear.year4) ||
      (filterYear.year1 && item.year === 1) ||
      (filterYear.year2 && item.year === 2) ||
      (filterYear.year3 && item.year === 3) ||
      (filterYear.year4 && item.year === 4);

    const departmentSelected =
      (!filterDepartment.cs && !filterDepartment.it) ||
      (filterDepartment.cs && item.department === 'วิทยาการคอมพิวเตอร์') ||
      (filterDepartment.it && item.department === 'เทคโนโลยีสารสนเทศ');

    const searchSelected = item.title.toLowerCase().includes(searchTerm.toLowerCase());

    return yearSelected && departmentSelected && searchSelected;
  });

  const handleYearChange = (year) => {
    setFilterYear(prev => ({ ...prev, [year]: !prev[year] }));
  };

  const handleDepartmentChange = (department) => {
    setFilterDepartment(prev => ({ ...prev, [department]: !prev[department] }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const openModal = (announcement) => {
    setSelectedAnnouncement(announcement);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedAnnouncement(null);
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
          <span className="text-white me-3">
  {user ? `${user.username} ${user.full_name || user.fullName || ""}` : "ไม่พบผู้ใช้"}
</span>
          <button className="btn btn-light btn-sm" onClick={handleLogout}>ออกจากระบบ</button>
        </div>
      </div>

      <div className="d-flex">
        {/* Sidebar */}
        <div className="p-4" style={{ width: '250px', backgroundColor: '#ffffff', boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)', height: '100vh' }}>
          <h5
            className="mb-4"
            style={{
              border: '1px solid #ccc',       // สีกรอบ
              padding: '10px 15px',           // ระยะห่างด้านใน
              borderRadius: '5px',            // มุมโค้ง
              backgroundColor: '#f9f9f9',     // พื้นหลังอ่อน ๆ
              textAlign: 'center',             // กึ่งกลางแนวนอน
              display: 'flex',                 // ใช้ flex
              alignItems: 'center',            // กึ่งกลางแนวตั้ง
              justifyContent: 'center',        // กึ่งกลางแนวนอน (สำหรับ flex)
              height: '50px'                   // ความสูงเพื่อให้จัดกลางแนวตั้งชัดเจน
            }}
          >
            ตัวกรอง
          </h5>

          <h6>ชั้นปี</h6>
          {['year1', 'year2', 'year3', 'year4'].map(year => (
            <div key={year} className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id={year}
                checked={filterYear[year]}
                onChange={() => handleYearChange(year)}
              />
              <label className="form-check-label" htmlFor={year}>ชั้นปี {year.charAt(year.length - 1)}</label>
            </div>
          ))}

          <h6 className="mt-4">สาขา</h6>
          {['cs', 'it'].map(dept => (
            <div key={dept} className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id={dept}
                checked={filterDepartment[dept]}
                onChange={() => handleDepartmentChange(dept)}
              />
              <label className="form-check-label" htmlFor={dept}>
                {dept === 'cs' ? 'วิทยาการคอมพิวเตอร์' : 'เทคโนโลยีสารสนเทศ'}
              </label>
            </div>
          ))}
        </div>

        {/* Main Content */}

        <div className="p-4 w-100">

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
                onClick={() => navigate('/add-data')}
              >
                เพิ่มข้อมูล
              </button>
              <button
                className="btn btn-warning"
                onClick={() => navigate('/edit')}
              >
                แก้ไขข้อมูล
              </button>
            </div>
          </div>

          <div className="mb-4">
            <input
              type="text"
              className="form-control w-50"
              placeholder="ค้นหาประกาศ"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="row g-4">
            {filteredAnnouncements.length === 0 ? (
              <div className="col-12">
                <div className="alert alert-info">ไม่พบประกาศที่ตรงกับการค้นหา</div>
              </div>
            ) : (
              filteredAnnouncements.map((item, index) => (
                <div key={index} className="col-md-4">
                  <div className="card shadow-sm border-light rounded">
                    <div className="card-body">
                      <h5>{item.title}</h5>
                      <p><strong>อาจารย์ผู้รับผิดชอบ:</strong> {item.teacher}</p>
                      <p><strong>วันที่ทำงาน:</strong> {item.workDate}</p>
                      <p><strong>ชั้นปีที่สมัครได้:</strong> {item.year}</p>
                      <p><strong>สาขาที่เกี่ยวข้อง:</strong> {item.department}</p>
                      <button className="btn btn-primary mt-2" onClick={() => openModal(item)}>ดูรายละเอียด</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && selectedAnnouncement && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{
            backgroundColor: 'rgba(0,0,0,0.5)',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflowY: 'auto',
            zIndex: 1050,
          }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{selectedAnnouncement.title}</h5>
                <button type="button" className="btn-close" onClick={closeModal}></button>
              </div>
              <div className="modal-body">
                <p><strong>อาจารย์ผู้รับผิดชอบ:</strong> {selectedAnnouncement.teacher}</p>
                <p><strong>วันที่ทำงาน:</strong> {selectedAnnouncement.workDate}</p>
                <p><strong>ชั้นปีที่สมัครได้:</strong> {selectedAnnouncement.year}</p>
                <p><strong>สาขาที่เกี่ยวข้อง:</strong> {selectedAnnouncement.department}</p>
                <p><strong>รายละเอียด:</strong> {selectedAnnouncement.description}</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={closeModal}>ปิด</button>
                <button className="btn btn-primary">สมัคร</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
