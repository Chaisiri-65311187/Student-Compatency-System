import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnnouncements } from '../contexts/AnnouncementsContext';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';

const AddAnnouncementPage = () => {
  const { addAnnouncement } = useAnnouncements();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    workDate: '',
    year: '',
    department: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newAnnouncement = { ...formData, teacher: user.fullName };
    addAnnouncement(newAnnouncement);

    Swal.fire({
      icon: 'success',
      title: 'บันทึกสำเร็จ!',
      text: 'ประกาศรับสมัครนิสิตถูกบันทึกแล้ว',
      confirmButtonText: 'ตกลง'
    }).then(() => {
      navigate('/student-info');
    });
  };

  const handleCancel = () => {
    navigate('/student-info'); // กดยกเลิกกลับหน้า Home
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
        <h5 className="text-white fw-bold m-0">CSIT Competency System</h5>
        <div className="ms-auto d-flex align-items-center">
          <span className="text-white me-3">{user?.fullName}</span>
          <button className="btn btn-light btn-sm" onClick={() => navigate('/login')}>ออกจากระบบ</button>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          minHeight: 'calc(100vh - 70px)',
          paddingTop: '30px',
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            width: '90%',
            maxWidth: '600px',
          }}
        >
          <h3 className="text-center mb-4">สร้างประกาศรับสมัครนิสิต</h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label>ชื่อประกาศ</label>
              <input
                type="text"
                className="form-control"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-3">
              <label>รายละเอียดงาน</label>
              <textarea
                className="form-control"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="4"
                required
              />
            </div>
            <div className="mb-3">
              <label>วันที่ทำงาน</label>
              <input
                type="text"
                className="form-control"
                name="workDate"
                value={formData.workDate}
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-3">
              <label>ชั้นปีที่สมัครได้</label>
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
            <div className="mb-3">
              <label>สาขาที่เกี่ยวข้อง</label>
              <select
                className="form-select"
                name="department"
                value={formData.department}
                onChange={handleChange}
                required
              >
                <option value="">เลือกสาขา</option>
                <option value="วิทยาการคอมพิวเตอร์">วิทยาการคอมพิวเตอร์</option>
                <option value="เทคโนโลยีสารสนเทศ">เทคโนโลยีสารสนเทศ</option>
              </select>
            </div>

            {/* ปุ่ม บันทึกและยกเลิก */}
            <div className="d-flex justify-content-between mt-4">
              <button type="submit" className="btn btn-primary w-45">บันทึกประกาศ</button>
              <button type="button" className="btn btn-secondary w-45" onClick={handleCancel}>ยกเลิก</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddAnnouncementPage;
