const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const competencyRoutes = require('./routes/competencyRoutes');

// ตั้งค่า middlewares
app.use(cors());
app.use(bodyParser.json());

// เส้นทาง API
app.use('/api/competency', competencyRoutes);

// เริ่มต้นเซิร์ฟเวอร์
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
