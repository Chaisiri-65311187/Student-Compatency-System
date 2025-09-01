import React from 'react';
import { Link } from 'react-router-dom';

const WelcomePage = () => {
  return (
     <div style={{ backgroundColor: '#FFF8F0', minHeight: '100vh' }}>
      {/* แถบหัวด้านบน */}
      <div
        className="d-flex align-items-center p-2"
        style={{ height: '60px', backgroundColor: '#6f42c1' }}
      >
        <img
          src="/src/assets/csit.jpg"
          alt="Logo"
          style={{ height: '50px', marginLeft: '10px', marginRight: '10px' }}
        />
        <h5 className="text-white fw-bold m-0">CSIT Competency System</h5>
      </div>

      {/* เนื้อหากลางหน้า */}
      <div className="d-flex flex-column justify-content-center align-items-center vh-100">
        <h1 className="display-4 fw-bold mb-3">สมรรถนะนิสิต</h1>
        <p className="text-secondary fs-5 mb-5 text-center">
          สาขาวิทยาการคอมพิวเตอร์ และ<br />เทคโนโลยีสารสนเทศ
        </p>
        <Link to="/login">
          <button className="btn btn-dark btn-lg px-4">Login</button>
        </Link>
      </div>
    </div>
  );
};

export default WelcomePage;
