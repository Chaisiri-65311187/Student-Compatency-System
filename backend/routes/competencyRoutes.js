// backend/routes/competencyRoutes.js
const express = require("express");
const router = express.Router();

// ตัวอย่าง route ทดสอบ
router.get("/", (req, res) => {
  res.json({ message: "Competency API ready ✅" });
});

module.exports = router;
