// src/components/AddAnnouncementPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';

const AddAnnouncementPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    seats: 1,
    workDate: '',
    year: '',
    department: '',
    status: 'open',
    location: '',
    deadline: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ✅ ส่งข้อมูลจริงไป backend
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const API = import.meta.env.VITE_API_BASE || "http://localhost:5000";
      const res = await fetch(`${API}/api/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          teacher: user?.full_name || user?.username || "Guest",
        }),
      });

      if (!res.ok) throw new Error("ไม่สามารถบันทึกข้อมูลได้");
      await Swal.fire({
        icon: 'success',
        title: 'บันทึกสำเร็จ!',
        text: 'ประกาศรับสมัครนิสิตถูกบันทึกแล้ว',
        confirmButtonText: 'ตกลง',
      });
      navigate('/student-info');

    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: err.message,
      });
    }
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
      if (result.isConfirmed) navigate('/student-info');
    });
  };

  return (
    <div className="bg-light min-vh-100">
      {/* Top Bar */}
      <nav className="navbar navbar-expand-lg" style={{ backgroundColor: '#6f42c1', height: '80px' }}>
        <div className="container-fluid">
          <img src="/src/assets/csit.jpg" alt="Logo" style={{ height: '50px', marginRight: '10px' }} />
          <span className="navbar-brand text-white fw-bold">CSIT Competency System</span>
          <div className="ms-auto d-flex align-items-center">
            <span className="text-white me-3">{user?.full_name || 'Guest'}</span>
            <button className="btn btn-light btn-sm" onClick={() => navigate('/login')}>ออกจากระบบ</button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container py-5 d-flex justify-content-center">
        <div className="card shadow-lg w-100" style={{ maxWidth: '650px', borderRadius: '15px' }}>
          <div className="card-body p-4">
            <h3 className="card-title text-center mb-4">สร้างประกาศรับสมัครนิสิต</h3>
            <form onSubmit={handleSubmit}>
              
              {/* ชื่อประกาศ */}
              <div className="mb-3">
                <label className="form-label">ชื่อประกาศ</label>
                <input
                  type="text"
                  className="form-control"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="กรอกชื่อประกาศ..."
                  required
                />
              </div>

              {/* รายละเอียดงาน */}
              <div className="mb-3">
                <label className="form-label">รายละเอียดงาน</label>
                <textarea
                  className="form-control"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="4"
                  placeholder="กรอกรายละเอียดงาน..."
                  required
                />
              </div>

              {/* จำนวนที่รับ */}
              <div className="mb-3">
                <label className="form-label">จำนวนที่รับ</label>
                <input
                  type="number"
                  className="form-control"
                  name="seats"
                  value={formData.seats}
                  onChange={handleChange}
                  placeholder="กรอกจำนวนที่รับ"
                  min="1"
                  required
                />
              </div>

              {/* วันที่ทำงาน */}
              <div className="mb-3">
                <label className="form-label">วันที่ทำงาน</label>
                <input
                  type="date"
                  className="form-control"
                  name="workDate"
                  value={formData.workDate}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* วันปิดรับสมัคร */}
              <div className="mb-3">
                <label className="form-label">วันปิดรับสมัคร</label>
                <input
                  type="date"
                  className="form-control"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                />
              </div>

              {/* สถานที่ทำงาน */}
              <div className="mb-3">
                <label className="form-label">สถานที่ทำงาน</label>
                <input
                  type="text"
                  className="form-control"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="เช่น ห้องแลบ 204 หรือ ทำงานจากบ้าน"
                />
              </div>

              {/* สถานะ */}
              <div className="mb-3">
                <label className="form-label">สถานะประกาศ</label>
                <select
                  className="form-select"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="open">เปิดรับ</option>
                  <option value="closed">ปิดรับ</option>
                  <option value="archived">เก็บถาวร</option>
                </select>
              </div>

              {/* ชั้นปี */}
              <div className="mb-3">
                <label className="form-label">ชั้นปีที่สมัครได้</label>
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

              {/* สาขา */}
              <div className="mb-3">
                <label className="form-label">สาขาที่เกี่ยวข้อง</label>
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
                  <option value="ไม่จำกัด">ไม่จำกัด</option>
                </select>
              </div>

              {/* ปุ่ม */}
              <div className="d-flex justify-content-between mt-4">
                <button type="submit" className="btn btn-primary w-100 me-2">ส่งข้อมูล</button>
                <button type="button" className="btn btn-secondary w-100" onClick={handleCancel}>ยกเลิก</button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddAnnouncementPage;
