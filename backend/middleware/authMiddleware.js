const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log(`[AUTH_MIDDLEWARE] ${req.method} ${req.originalUrl || req.url} -> AuthHeader: ${authHeader || "NONE"}`);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "No authentication token provided.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "studyflow_super_secure_jwt_secret_token_2026_production"
    );
    req.user = decoded; // { id, email, name }
    next();
  } catch (error) {
    return res.status(401).json({
      error: "InvalidToken",
      message: "Session expired or token invalid. Please log in again.",
    });
  }
};

module.exports = authMiddleware;
