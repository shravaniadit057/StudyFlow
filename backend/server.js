const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5000",
  "http://127.0.0.1:5173",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`[API ${req.method}] ${req.url} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.json({
    status: "ok",
    database: {
      connected: dbState === 1,
      state: states[dbState] || "unknown",
      readyState: dbState,
    },
    timestamp: new Date().toISOString(),
  });
});

// Middleware to guard database routes if DB is not connected
const requireDb = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: "DatabaseUnavailable",
      message: "MongoDB Atlas is currently connecting or unreachable. Check your Atlas Network Access (IP Whitelist).",
    });
  }
  next();
};

// Mount API routes
app.use("/api/auth", requireDb, require("./routes/authRoutes"));
app.use("/api/tasks", requireDb, require("./routes/taskRoutes"));
app.use("/api/notes", requireDb, require("./routes/noteRoutes"));
app.use("/api/goals", requireDb, require("./routes/goalRoutes"));
app.use("/api/pomodoro", requireDb, require("./routes/pomodoroRoutes"));
app.use("/api/user-data", requireDb, require("./routes/userDataRoutes"));
app.use("/api/sync", requireDb, require("./routes/syncRoutes"));

app.get("/", (req, res) => {
  res.send("StudyFlow Backend API is running!");
});

// Global 404 handler for unmatched API routes
app.use("/api", (req, res) => {
  res.status(404).json({ error: "NotFound", message: `API route ${req.originalUrl} not found.` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    error: err.name || "ServerError",
    message: err.message || "An unexpected server error occurred.",
  });
});

// Robust MongoDB connection with retry loop
const connectWithRetry = () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI environment variable is missing!");
    return;
  }

  console.log("Connecting to MongoDB Atlas...");
  mongoose
    .connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    })
    .then(() => {
      console.log("MongoDB Atlas connected successfully!");
    })
    .catch((error) => {
      console.error("MongoDB Atlas connection failed:", error.message);
      console.log("Retrying connection in 10 seconds...");
      setTimeout(connectWithRetry, 10000);
    });
};

connectWithRetry();

// Start Express server
const server = app.listen(PORT, () => {
  console.log(`StudyFlow backend running on http://localhost:${PORT}`);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception thrown:", err);
});

module.exports = { app, server };