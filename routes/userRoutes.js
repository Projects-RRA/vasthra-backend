const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    // ✅ Check for missing fields
    if (!name || !email || !password || !phone || !role) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // ✅ Validate password (min length: 6, one uppercase, one special character)
    const passwordRegex = /^(?=.*[A-Z])(?=.*[\W_]).{6,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(422).json({
        error: "Weak password",
        message:
          "Password must be at least 6 characters long, include 1 uppercase letter & 1 special character",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Insert user into DB
    const [result] = await db.execute(
      "INSERT INTO users (name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, ?)",
      [name, email, hashedPassword, phone, role]
    );

    res.status(201).json({ message: "User registered successfully!" });
  } catch (error) {
    // ✅ Handle duplicate email error
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Email already exists" });
    }

    res.status(500).json({
      error: "Database error",
      code: error.code || "UNKNOWN_ERROR",
      details: error.message,
    });
  }
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
  
    console.log("Received login request:", req.body);
  
    try {
      console.log("Executing query:", "SELECT * FROM users WHERE email = ?");
      const [users] = await db.execute("SELECT * FROM users WHERE email = ?", [
        email,
      ]);
  
      console.log("User query result:", users);
  
      if (!Array.isArray(users) || users.length === 0) {
        console.log("User not found or query returned an unexpected structure");
        return res.status(401).json({ error: "Invalid email or password" });
      }
  
      const user = users[0];
  
      const isMatch = await bcrypt.compare(password, user.password_hash);
      console.log("Password match status:", isMatch);
  
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
  
      const token = jwt.sign(
        { userId: user.id, role: user.role }, // Include role in JWT
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );
  
      console.log("Generated token:", token);
  
      res.json({ 
        message: "Login successful", 
        token,
        role: user.role, // Return role in response
        userName: user.name  // Return name in response
      });
    } catch (error) {
      console.error("Database error during login:", error);
      console.error("Error details:", error); // Log full error object
      res.status(500).json({ error: "Database error", details: error.message });
    }
  });
  

module.exports = router;
