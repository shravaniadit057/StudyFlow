const express = require("express");
const PomodoroSession = require("../models/PomodoroSession");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authMiddleware);

// GET /api/pomodoro
router.get("/", async (req, res) => {
  try {
    const sessions = await PomodoroSession.find({ user: req.user.id }).sort({ completedAt: -1 });
    res.json(sessions);
  } catch (error) {
    console.error("Fetch pomodoro sessions error:", error);
    res.status(500).json({ error: "ServerError", message: "Failed to fetch sessions." });
  }
});

// POST /api/pomodoro
router.post("/", async (req, res) => {
  try {
    const { type, duration, completedAt, subject, clientSessionId } = req.body;
    if (!completedAt) {
      return res.status(400).json({ error: "ValidationError", message: "completedAt timestamp is required." });
    }

    const session = new PomodoroSession({
      user: req.user.id,
      type: type || "focus",
      duration: duration || 25,
      completedAt,
      subject: subject || "",
      clientSessionId: clientSessionId || null,
    });

    const saved = await session.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("Create pomodoro session error:", error);
    res.status(400).json({ error: "ValidationError", message: "Failed to create session." });
  }
});

// POST /api/pomodoro/bulk-sync
router.post("/bulk-sync", async (req, res) => {
  try {
    const { sessions } = req.body;
    if (!Array.isArray(sessions)) {
      return res.status(400).json({ error: "ValidationError", message: "sessions must be an array." });
    }

    const migrated = [];
    for (const s of sessions) {
      if (!s.completedAt) continue;
      const clientSessionId = String(s.id || "");

      let existing = null;
      if (clientSessionId) {
        existing = await PomodoroSession.findOne({ user: req.user.id, clientSessionId });
      }
      if (!existing) {
        existing = await PomodoroSession.findOne({ user: req.user.id, completedAt: s.completedAt });
      }

      if (!existing) {
        const newSession = new PomodoroSession({
          user: req.user.id,
          type: s.type || "focus",
          duration: s.duration || 25,
          completedAt: s.completedAt,
          subject: s.subject || "",
          clientSessionId: clientSessionId || null,
        });
        const saved = await newSession.save();
        migrated.push(saved);
      } else {
        migrated.push(existing);
      }
    }

    res.json({ success: true, count: migrated.length, sessions: migrated });
  } catch (error) {
    console.error("Bulk sync pomodoro sessions error:", error);
    res.status(500).json({ error: "ServerError", message: "Failed to sync sessions." });
  }
});

module.exports = router;
