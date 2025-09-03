const express = require('express');
const router = express.Router();
const competencyController = require('../controllers/competencyController');

// POST: เพิ่มข้อมูลสมรรถนะนิสิต
router.post('/add', competencyController.addCompetency);

// GET: ดึงข้อมูลสมรรถนะนิสิตทั้งหมด
router.get('/get', competencyController.getCompetencies);

module.exports = router;
