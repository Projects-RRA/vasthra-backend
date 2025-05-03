const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
/*
  POST: /register - To Register New user
*/
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

/*
  POST: /login - For the login
*/
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const [users] = await db.execute("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

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
    res.json({
      message: "Login successful",
      user: { id: user.id, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("Database error during login:", error);
    res.status(500).json({ error: "Database error", details: error.message });
  }
});

/*
  GET: /me - To get the info about the logged in user including the Address
*/
router.get("/me", authMiddleware, async (req, res) => {
  try {
    // Fetch user details
    const [users] = await db.execute(
      "SELECT id, name, email, role, phone FROM users WHERE id = ?",
      [req.user.userId]
    );

    if (!users.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const userInfo = users[0];

    // Fetch user addresses
    const [addresses] = await db.execute(
      "SELECT id, street, city, state, country, postal_code, landmark FROM addresses WHERE user_id = ?",
      [req.user.userId]
    );

    res.json({ userInfo, addresses });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/*
  PUT: /me - To update the name and phone number.
*/
router.put("/me", authMiddleware, async (req, res) => {
  try {
    const { name, phone } = req.body;

    // ✅ Validate input
    if (!name || !phone) {
      return res
        .status(400)
        .json({ error: "Name and phone number are required" });
    }

    // ✅ Update only name and phone in the database
    await db.execute("UPDATE users SET name = ?, phone = ? WHERE id = ?", [
      name,
      phone,
      req.user.userId,
    ]);

    res.json({ message: "User details updated successfully" });
  } catch (error) {
    console.error("Error updating user details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/*
  POST: /addresses - To add a new address.
*/
router.post("/addresses", authMiddleware, async (req, res) => {
  try {
    const { street, city, state, country, postal_code, landmark } = req.body;

    if (!street || !city || !state || !country || !postal_code || !landmark) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const [result] = await db.execute(
      "INSERT INTO addresses (user_id, street, city, state, country, postal_code, landmark) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [req.user.userId, street, city, state, country, postal_code, landmark]
    );

    const newAddress = {
      id: result.insertId,
      user_id: req.user.userId,
      street,
      city,
      state,
      country,
      postal_code,
      landmark,
    };

    res
      .status(201)
      .json({ message: "Address added successfully", address: newAddress });
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/*
  PUT: /addresses/:id - To update a existing address.
*/
router.put("/addresses/:id", authMiddleware, async (req, res) => {
  const addressId = req.params.id;
  const userId = req.user.userId;
  const { street, city, state, country, postal_code, landmark } = req.body;

  // Check for required fields
  if (!street || !city || !state || !country || !postal_code || !landmark) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Check if the address belongs to the logged-in user
    const [addressRows] = await db.execute(
      "SELECT * FROM addresses WHERE id = ? AND user_id = ?",
      [addressId, userId]
    );

    if (addressRows.length === 0) {
      return res
        .status(404)
        .json({ error: "Address not found or not owned by user" });
    }

    // Perform the update
    await db.execute(
      "UPDATE addresses SET street = ?, city = ?, state = ?,  postal_code=?, landmark=? WHERE id = ?",
      [street, city, state, postal_code, landmark, addressId]
    );

    const [updatedRows] = await db.execute(
      "SELECT * FROM addresses WHERE id = ?",
      [addressId]
    );

    res
      .status(200)
      .json({
        message: "Address updated successfully",
        address: updatedRows[0],
      });
  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/*
  DELETE: /addresses/:id - To delete a existing address.
*/
router.delete("/addresses/:id", authMiddleware, async (req, res) => {
  try {
    const addressId = req.params.id;

    // ✅ Delete address if it belongs to the logged-in user
    const [result] = await db.execute(
      "DELETE FROM addresses WHERE id = ? AND user_id = ?",
      [addressId, req.user.userId]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: "Address not found or unauthorized" });
    }

    res.json({ message: "Address deleted successfully" });
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/*
  PUT: /update-password - To dupdate the password.
*/
router.put("/update-password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  try {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Step 1: Get user from DB
    const [users] = await db.execute(
      "SELECT password_hash FROM users WHERE id = ?",
      [req.user.userId]
    );

    if (!users.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];

    // Step 2: Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Step 3: Check new password strength
    const passwordRegex = /^(?=.*[A-Z])(?=.*[\W_]).{6,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(422).json({
        error:
          "Password must be at least 6 characters long, include 1 uppercase letter & 1 special character",
      });
    }

    // Step 4: Match new & confirm
    if (newPassword !== confirmPassword) {
      return res
        .status(400)
        .json({ error: "New and confirm password do not match" });
    }

    // Step 5: Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.execute("UPDATE users SET password_hash = ? WHERE id = ?", [
      hashedPassword,
      req.user.userId,
    ]);

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/*
  POST: /logout - For logout.
*/
router.post("/logout", (req, res) => {
  res.clearCookie("authToken"); // 🔥 Remove the token
  res.json({ message: "Logged out successfully" });
});

module.exports = router;
