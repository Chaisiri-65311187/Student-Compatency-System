// backend/db.js
const mysql = require("mysql2/promise");

// ✅ สร้าง pool ที่รองรับ async/await และใช้ .query() ได้
const pool = mysql.createPool({
  host: "localhost",
  user: "root",              
  password: "",              
  database: "student_competency", 
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
