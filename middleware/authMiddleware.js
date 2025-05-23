const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {

    
    const token = req.cookies.authToken; // ✅ Get token from cookies
    
    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // ✅ Attach user data to request
        next();
    } catch (error) {
        return res.status(403).json({ error: "Invalid or expired token" });
    }
};

module.exports = authMiddleware;
