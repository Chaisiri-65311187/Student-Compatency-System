import React, { useState } from 'react';
import { useCompetency } from '../contexts/CompetencyContext'; // ใช้ CompetencyContext
import { useAuth } from '../contexts/AuthContext'; // ใช้ AuthContext
import { useNavigate } from 'react-router-dom';

const StudentInfoPage = () => {
    const { user } = useAuth(); // ดึงข้อมูลผู้ใช้จาก AuthContext
    const { competencyData } = useCompetency(); // ดึงข้อมูลสมรรถนะนิสิตจาก CompetencyContext
    const navigate = useNavigate();

    // กรองข้อมูลด้วยตัวกรอง
    const [filters, setFilters] = useState({
        departments: [], // สาขาที่เลือก
        years: [], // ชั้นปีที่เลือก
    });

    // ตรวจสอบว่าเป็นอาจารย์หรือไม่ ถ้าไม่ใช่จะไม่สามารถเข้าถึงหน้านี้ได้
    if (user?.role !== 'teacher') {
        navigate('/home'); // ถ้าไม่ใช่อาจารย์จะนำทางกลับไปที่หน้า HomePage
        return null; // หยุดการแสดงผล
    }

    // ฟังก์ชันกรองข้อมูลสมรรถนะนิสิตตามตัวกรอง
    const filteredData = competencyData.filter((item) => {
        const matchesDepartment = filters.departments.length ? filters.departments.includes(item.department) : true;
        const matchesYear = filters.years.length ? filters.years.includes(item.year.toString()) : true;
        return matchesDepartment && matchesYear;
    });

    // ฟังก์ชันเปลี่ยนแปลงตัวกรอง
    const handleFilterChange = (e) => {
        const { name, value, checked } = e.target;
        if (checked) {
            // ถ้าทำการเลือก checkbox
            setFilters((prevFilters) => ({
                ...prevFilters,
                [name]: [...prevFilters[name], value], // เพิ่มค่าเข้าไปใน array
            }));
        } else {
            // ถ้า uncheck checkbox
            setFilters((prevFilters) => ({
                ...prevFilters,
                [name]: prevFilters[name].filter((item) => item !== value), // ลบค่าที่ถูกเลือก
            }));
        }
    };

    return (
        <div style={{ backgroundColor: '#f4f7fa', minHeight: '100vh' }}>
            {/* Top Bar */}
            <div className="d-flex align-items-center p-3" style={{ height: '70px', backgroundColor: '#6f42c1' }}>
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

            <div className="d-flex">
                {/* Sidebar */}
                <div className="p-4" style={{ width: '250px', backgroundColor: '#ffffff', boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)' }}>
                    <h5 className="mb-4">ตัวกรอง</h5>

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
                            justifyContent: 'center',  // จัดตำแหน่งแนวนอน
                            alignItems: 'flex-start',  // จัดตำแหน่งให้เริ่มที่ด้านบน
                            minHeight: '100vh',  // ให้มีความสูงเต็มหน้าจอ
                            paddingTop: '10px',  // เพิ่มช่องว่างด้านบนเล็กน้อยเพื่อไม่ให้เนื้อหาติดขอบ
                        }}
                    >
                        <div
                            style={{
                                backgroundColor: 'white',
                                padding: '20px',
                                borderRadius: '10px',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                                width: '80%',  // ใช้ขนาดเต็มของ container
                                maxWidth: '400px',  // ขนาดสูงสุดไม่เกิน 500px
                            }}
                        >
                            <h2 className="text-center mb-4">ข้อมูลสมรรถนะของนิสิต</h2>
                        </div>
                    </div>

                    {/* แสดงข้อมูลนิสิตในรูปแบบการ์ด */}
                    <div className="row g-4">
                        {filteredData.map((item, index) => (
                            <div key={index} className="col-md-4">
                                <div className="card shadow-lg border-light rounded-3">
                                    <div className="card-body">
                                        <h5 className="card-title text-center">{item.studentId}</h5>
                                        <p><strong>ชื่อ:</strong> {item.name}</p>
                                        <p><strong>สาขา:</strong> {item.department}</p>
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
        </div>
    );
};

export default StudentInfoPage;
