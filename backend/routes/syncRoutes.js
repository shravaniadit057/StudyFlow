const express = require("express");
const Task = require("../models/Task");
const NoteFolder = require("../models/NoteFolder");
const Goal = require("../models/Goal");
const PomodoroSession = require("../models/PomodoroSession");
const UserData = require("../models/UserData");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authMiddleware);

// GET /api/sync/all - fast single endpoint to fetch all user data
router.get("/all", async (req, res) => {
  try {
    const userId = req.user.id;
    const [tasks, notes, goals, pomodoroSessions, userData] = await Promise.all([
      Task.find({ user: userId }).sort({ createdAt: -1 }),
      NoteFolder.find({ user: userId }).sort({ createdAt: 1 }),
      Goal.find({ user: userId }).sort({ createdAt: -1 }),
      PomodoroSession.find({ user: userId }).sort({ completedAt: -1 }),
      UserData.findOne({ user: userId }),
    ]);

    res.json({
      tasks: tasks || [],
      notes: notes || [],
      goals: goals || [],
      pomodoroSessions: pomodoroSessions || [],
      userData: userData || {},
    });
  } catch (error) {
    console.error("Sync all error:", error);
    res.status(500).json({ error: "ServerError", message: "Failed to fetch user data." });
  }
});

const inProgressUserMigrations = new Set();

// POST /api/sync/migrate-all - safely migrate all localStorage data without duplicate loss
router.post("/migrate-all", async (req, res) => {
  const userId = req.user.id;

  // In-flight guard: prevent concurrent migration requests for the same user
  if (inProgressUserMigrations.has(userId)) {
    return res.json({
      success: true,
      message: "Migration is already in progress for this user. Concurrent call skipped.",
      migrated: {
        tasks: 0,
        notes: 0,
        goals: 0,
        pomodoroSessions: 0,
      },
    });
  }

  inProgressUserMigrations.add(userId);

  try {
    const {
      tasks = [],
      notes = [],
      goals = [],
      pomodoroSessions = [],
      studyDays = [],
      streakMeta = {},
      settings = {},
      profile = {},
      motivations = [],
      notifications = [],
      firedReminders = [],
    } = req.body;

    let tasksCount = 0;
    let notesCount = 0;
    let goalsCount = 0;
    let sessionsCount = 0;

    // 1. Migrate Tasks safely and idempotently
    if (Array.isArray(tasks) && tasks.length > 0) {
      for (const item of tasks) {
        const title = (item.title || item.name || "").trim();
        if (!title) continue;

        const clientTaskId = String(item.id || item.clientTaskId || "").trim();
        let existing = null;
        if (clientTaskId) {
          existing = await Task.findOne({ user: userId, clientTaskId });
        }
        if (!existing) {
          existing = await Task.findOne({ user: userId, title, dueDate: item.dueDate || "" });
        }

        if (!existing) {
          try {
            const newTask = new Task({
              user: userId,
              title,
              name: title,
              subject: (item.subject || "").trim(),
              priority: item.priority || "Medium",
              completed: Boolean(item.completed),
              completedAt: item.completedAt || null,
              dueDate: item.dueDate || "",
              dueTime: item.dueTime || "12:00",
              reminder: item.reminder !== undefined && item.reminder !== null ? Number(item.reminder) : null,
              clientTaskId: clientTaskId || null,
            });
            await newTask.save();
            tasksCount++;
          } catch (taskErr) {
            if (taskErr.code === 11000) {
              console.log(`Task "${title}" [${clientTaskId}] already exists for user ${userId}, skipped.`);
            } else {
              throw taskErr;
            }
          }
        }
      }
    }

    // 2. Migrate Notes safely and idempotently
    if (Array.isArray(notes) && notes.length > 0) {
      for (const f of notes) {
        if (!f.subject) continue;
        const clientFolderId = String(f.id || f.clientFolderId || "").trim();
        let existing = null;
        if (clientFolderId) {
          existing = await NoteFolder.findOne({ user: userId, clientFolderId });
        }
        if (!existing) {
          existing = await NoteFolder.findOne({ user: userId, subject: f.subject.trim() });
        }

        if (!existing) {
          try {
            const newFolder = new NoteFolder({
              user: userId,
              subject: f.subject.trim(),
              icon: f.icon || "📚",
              color: f.color || "#E3EEFF",
              notesList: f.notesList || [],
              materialsList: f.materialsList || [],
              clientFolderId: clientFolderId || null,
            });
            await newFolder.save();
            notesCount++;
          } catch (folderErr) {
            if (folderErr.code === 11000) {
              console.log(`Folder "${f.subject}" already exists for user ${userId}, skipped.`);
            } else {
              throw folderErr;
            }
          }
        }
      }
    }

    // 3. Migrate Goals safely and idempotently
    if (Array.isArray(goals) && goals.length > 0) {
      for (const g of goals) {
        if (!g.title) continue;
        const clientGoalId = String(g.id || g.clientGoalId || "").trim();
        let existing = null;
        if (clientGoalId) {
          existing = await Goal.findOne({ user: userId, clientGoalId });
        }
        if (!existing) {
          existing = await Goal.findOne({ user: userId, title: g.title.trim() });
        }

        if (!existing) {
          try {
            const newGoal = new Goal({
              user: userId,
              title: g.title.trim(),
              description: g.description || "",
              category: g.category || "Academic",
              dueDate: g.dueDate || "",
              progress: g.progress || 0,
              clientGoalId: clientGoalId || null,
            });
            await newGoal.save();
            goalsCount++;
          } catch (goalErr) {
            if (goalErr.code === 11000) {
              console.log(`Goal "${g.title}" already exists for user ${userId}, skipped.`);
            } else {
              throw goalErr;
            }
          }
        }
      }
    }

    // 4. Migrate Pomodoro Sessions safely and idempotently
    if (Array.isArray(pomodoroSessions) && pomodoroSessions.length > 0) {
      for (const s of pomodoroSessions) {
        if (!s.completedAt) continue;
        const clientSessionId = String(s.id || s.clientSessionId || "").trim();
        let existing = null;
        if (clientSessionId) {
          existing = await PomodoroSession.findOne({ user: userId, clientSessionId });
        }
        if (!existing) {
          existing = await PomodoroSession.findOne({ user: userId, completedAt: s.completedAt });
        }

        if (!existing) {
          try {
            const newSession = new PomodoroSession({
              user: userId,
              type: s.type || "focus",
              duration: s.duration || 25,
              completedAt: s.completedAt,
              subject: s.subject || "",
              clientSessionId: clientSessionId || null,
            });
            await newSession.save();
            sessionsCount++;
          } catch (sessionErr) {
            if (sessionErr.code === 11000) {
              console.log(`Session at ${s.completedAt} already exists for user ${userId}, skipped.`);
            } else {
              throw sessionErr;
            }
          }
        }
      }
    }

    // 5. Migrate User Data / Metadata
    await UserData.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          settings,
          profile,
          studyDays,
          streakMeta,
          motivations,
          notifications,
          firedReminders,
        },
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Data migrated successfully to MongoDB Atlas",
      migrated: {
        tasks: tasksCount,
        notes: notesCount,
        goals: goalsCount,
        pomodoroSessions: sessionsCount,
      },
    });
  } catch (error) {
    console.error("Migration error:", error);
    res.status(500).json({ error: "ServerError", message: "Failed to migrate data." });
  } finally {
    inProgressUserMigrations.delete(userId);
  }
});

module.exports = router;
