const mysql = require('mysql2');

// ตั้งค่าเชื่อมต่อฐานข้อมูล MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',  // เปลี่ยนให้ตรงกับข้อมูลในเครื่อง
  password: '',
  database: 'competency_system'
});

module.exports = db;
