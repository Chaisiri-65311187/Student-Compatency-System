import React from 'react';
import { Link } from 'react-router-dom';

const WelcomePage = () => {
  return (
    <div style={{ backgroundColor: '#f4f7fa', minHeight: '100vh' }}>
      {/* Top Bar */}
      <div
        className="d-flex align-items-center p-3"
        style={{
          position: 'fixed', // ทำให้ Top Bar อยู่ด้านบน
          top: '0',
          left: '0',
          width: '100%',
          height: '80px',
          backgroundColor: '#6f42c1',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
          zIndex: '999', // ทำให้ Top Bar อยู่ข้างบนสุด
        }}
      >
        <img
          src="/src/assets/csit.jpg"
          alt="Logo"
          style={{ height: '50px', marginLeft: '10px', marginRight: '10px' }}
        />
        <h5 className="text-white fw-bold m-0" style={{ marginLeft: '10px' }}>CSIT Competency System</h5>
      </div>

      {/* เนื้อหากลางหน้า */}
      <div
        className="d-flex flex-column justify-content-center align-items-center"
        style={{
          paddingTop: '120px', // เพิ่มพื้นที่ด้านบนเพื่อไม่ให้เนื้อหาถูกปิดด้วย Top Bar
          minHeight: 'calc(100vh - 80px)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            padding: '40px',
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            width: '100%',
            maxWidth: '500px',
          }}
        >
          <h1 className="display-4 fw-bold mb-3" style={{ fontSize: '3rem' }}>
            ยินดีต้อนรับ
          </h1>
          <p className="text-secondary fs-5 mb-5">
            ระบบสมรรถนะของนิสิตสาขาวิทยาการคอมพิวเตอร์ และ <br /> เทคโนโลยีสารสนเทศ
          </p>
          <Link to="/login">
            <button
              className="btn btn-dark btn-lg px-4"
              style={{
                fontSize: '1.25rem',
                padding: '15px 30px',
                borderRadius: '25px',
                transition: 'all 0.3s ease-in-out',
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = '#5a2d9b')}
              onMouseOut={(e) => (e.target.style.backgroundColor = '#6f42c1')}
            >
              เข้าสู่ระบบ
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
