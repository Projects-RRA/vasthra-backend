require("dotenv").config();
const express = require("express");
const cors = require("cors");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const db = require("./config/db");
const cookieParser = require("cookie-parser");

const app = express();
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json()); // Parse JSON requests
app.use(cookieParser());
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/order", orderRoutes);

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
