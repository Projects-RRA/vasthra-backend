const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

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

  try {
      const [users] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);

      if (!Array.isArray(users) || users.length === 0) {
          return res.status(401).json({ error: "Invalid email or password" });
      }

      const user = users[0];

      // console.log("Users", user)

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
          return res.status(401).json({ error: "Invalid email or password" });
      }

      // ✅ Generate JWT token
      const token = jwt.sign(
          { userId: user.id, role: user.role }, 
          process.env.JWT_SECRET, 
          { expiresIn: "1h" }
      );

      // ✅ Set the token in an HTTP-only cookie
      res.cookie("authToken", token, {
          httpOnly: true, // 🔥 Prevents access via JavaScript (XSS protection)
          secure: process.env.NODE_ENV === "production", // Use secure cookie in production
          sameSite: "strict",
          maxAge: 3600000, // 1 hour
      });

      // ✅ Send user details in response
      res.json({ message: "Login successful", user: { id: user.id, name: user.name, role: user.role } });
  } catch (error) {
      console.error("Database error during login:", error);
      res.status(500).json({ error: "Database error", details: error.message });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
      const [users] = await db.execute("SELECT id, name, email, role FROM users WHERE id = ?", [
          req.user.userId,
      ]);

      if (!users.length) {
          return res.status(404).json({ error: "User not found" });
      }

      res.json({ user: users[0] });
  } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("authToken"); // 🔥 Remove the token
  res.json({ message: "Logged out successfully" });
});

  

module.exports = router;
