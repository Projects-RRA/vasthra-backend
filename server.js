require("dotenv").config();
const express = require("express");
const cors = require("cors");
const userRoutes = require("./routes/userRoutes");
const db = require("./config/db");

const app = express();
app.use(cors());
app.use(express.json()); // Parse JSON requests
app.use("/api/users", userRoutes);

app.get("/", (req, res) => {
  res.send("Vasthra API is running...");
});

app.get('/testdb', async (req, res) => {
  try {
      const [rows] = await db.execute('SELECT 1');
      res.json({ success: true, message:"Connection Succesfull", rows });
  } catch (error) {
      console.error('Test DB error:', error);
      res.status(500).json({ error: 'Test DB error', details: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
