const db = require('../models/competencyModel');

// ฟังก์ชันเพิ่มข้อมูลสมรรถนะนิสิต
exports.addCompetency = (req, res) => {
  const { studentId, name, gpa, department, subject1, subject2, subject3, subject4, subject5, subject6, year, grade, hardSkill, softSkill, projectFile, activityFile } = req.body;

  const sql = `
    INSERT INTO competencies 
    (studentId, name, gap, department, subject1, subject2, subject3, subject4, subject5, subject6, year, grade, hardSkill, softSkill, projectFile, activityFile)
    VALUES 
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [studentId, name, gpa, department, subject1, subject2, subject3, subject4, subject5, subject6, year, grade, hardSkill, softSkill, projectFile, activityFile], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Failed to add data');
    } else {
      res.status(201).json({ message: 'Data added successfully', result });
    }
  });
};

// ฟังก์ชันดึงข้อมูลสมรรถนะนิสิต
exports.getCompetencies = (req, res) => {
  const sql = 'SELECT * FROM competencies';

  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Failed to fetch data');
    } else {
      res.status(200).json(result);
    }
  });
};
