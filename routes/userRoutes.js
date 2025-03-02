const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const router = express.Router();

router.post("/register", async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;

        // console.log("📌 Received registration request:", req.body);

        const hashedPassword = await bcrypt.hash(password, 10);

        // console.log("Executing query:", "INSERT INTO users (name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, ?)");
        const [result] = await db.execute(
            "INSERT INTO users (name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, ?)",
            [name, email, hashedPassword, phone, role]
        );

        // console.log("✅ User registered successfully:", result);

        res.status(201).json({ message: "User registered successfully!" });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "Email already exists" });
    }

    res.status(500).json({ error: "Database error", code: error.code, details: error.message });
    }
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    console.log("Received login request:", req.body);

    try {
        console.log("Executing query:", "SELECT * FROM users WHERE email = ?");
        const [users] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);

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

        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

        console.log("Generated token:", token);

        res.json({ message: "Login successful", token });
    } catch (error) {
        console.error("Database error during login:", error);
        console.error("Error details:", error); //Log full error object
        res.status(500).json({ error: "Database error", details: error.message });
    }
});



module.exports = router;