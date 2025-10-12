const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: ["http://localhost:5173"], credentials: true }));

const pool = require("./db");
app.get("/api/health", async (req, res) => {
  try {
    const [r] = await pool.query("SELECT 1 AS ok");
    res.json({ ok: true, db: r[0].ok });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.use("/api", require("./routes/auth"));        // ✅ mount
app.use("/api/competency", require("./routes/competencyRoutes"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
