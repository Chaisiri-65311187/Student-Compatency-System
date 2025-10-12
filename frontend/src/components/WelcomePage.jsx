// src/components/WelcomePage.jsx
import React from "react";
import { Link } from "react-router-dom";

const WelcomePage = () => {
  return (
    <div className="min-vh-100" style={{ background: "linear-gradient(180deg,#f7f7fb 0%,#eef1f7 100%)" }}>
      {/* Top Bar */}
      <div
        className="d-flex align-items-center px-3"
        style={{
          position: "sticky",
          top: 0,
          left: 0,
          width: "100%",
          height: 72,
          background: "linear-gradient(90deg, #6f42c1, #8e5cff)",
          boxShadow: "0 4px 14px rgba(111,66,193,.22)",
          zIndex: 10,
        }}
      >
        <img
          src="/src/assets/csit.jpg"
          alt="CSIT Logo"
          className="rounded-3"
          style={{ height: 40, width: 40, objectFit: "cover" }}
        />
        <h5 className="text-white fw-semibold m-0 ms-3">CSIT Competency System</h5>
      </div>

      {/* Hero */}
      <div className="container-xxl">
        <div className="row justify-content-center">
          <div className="col-12 col-md-9 col-lg-7">
            <div
              className="card border-0 shadow-sm rounded-4 mx-auto my-5"
              style={{ backdropFilter: "blur(6px)", background: "rgba(255,255,255,.95)" }}
            >
              <div className="card-body text-center p-4 p-lg-5">
                <h1 className="fw-bold mb-3" style={{ fontSize: "2.25rem" }}>
                  ยินดีต้อนรับ
                </h1>
                <p className="text-secondary mb-4">
                  ระบบสมรรถนะของนิสิตสาขา <strong>วิทยาการคอมพิวเตอร์</strong> และ <strong>เทคโนโลยีสารสนเทศ</strong>
                </p>

                <div className="d-grid gap-3 mt-2">
                  <Link to="/login" className="text-decoration-none">
                    <button className="btn btn-primary btn-lg welcome-cta w-100 rounded-3">
                      เข้าสู่ระบบ
                    </button>
                  </Link>

                  {/* ถ้าอนาคตมีปุ่มอื่นก็เพิ่มได้ที่นี่
                  <Link to="/about" className="text-decoration-none">
                    <button className="btn btn-outline-secondary btn-lg w-100 rounded-3">เกี่ยวกับระบบ</button>
                  </Link>
                  */}
                </div>

                <div className="mt-4 small text-muted">
                  หากพบปัญหาในการเข้าสู่ระบบ กรุณาติดต่อผู้ดูแลระบบภาควิชา
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Local styles */}
      <style>{`
        .welcome-cta{
          background: linear-gradient(135deg,#6f42c1,#8e5cff);
          border: none;
          box-shadow: 0 10px 24px rgba(111,66,193,.25);
          transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
        }
        .welcome-cta:hover{
          transform: translateY(-1px);
          box-shadow: 0 14px 30px rgba(111,66,193,.28);
          opacity: .95;
        }
        .welcome-cta:active{
          transform: translateY(0);
          box-shadow: 0 8px 18px rgba(111,66,193,.22);
        }
      `}</style>
    </div>
  );
};

export default WelcomePage;
