const express = require("express");
const Task = require("../models/Task");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Apply auth to all task routes
router.use(authMiddleware);

// GET /api/tasks - fetch all tasks for the logged in user
router.get("/", async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error("Fetch tasks error:", error);
    res.status(500).json({ error: "ServerError", message: "Failed to fetch tasks." });
  }
});

// POST /api/tasks - create a new task
router.post("/", async (req, res) => {
  try {
    const { title, name, subject, priority, completed, completedAt, dueDate, dueTime, reminder, clientTaskId } = req.body;
    const taskTitle = (title || name || "").trim();

    if (!taskTitle) {
      return res.status(400).json({ error: "ValidationError", message: "Task title/name is required." });
    }

    const task = new Task({
      user: req.user.id,
      title: taskTitle,
      name: taskTitle,
      subject: (subject || "").trim(),
      priority: priority || "Medium",
      completed: Boolean(completed),
      completedAt: completedAt || null,
      dueDate: dueDate || "",
      dueTime: dueTime || "12:00",
      reminder: reminder !== undefined && reminder !== null ? Number(reminder) : null,
      clientTaskId: clientTaskId || null,
    });

    const savedTask = await task.save();
    res.status(201).json(savedTask);
  } catch (error) {
    if (error.code === 11000) {
      try {
        if (req.body.clientTaskId) {
          const existing = await Task.findOne({ user: req.user.id, clientTaskId: req.body.clientTaskId });
          if (existing) {
            return res.status(200).json(existing);
          }
        }
      } catch (lookupErr) {
        console.error("Lookup existing duplicate task error:", lookupErr);
      }
      return res.status(409).json({
        error: "DuplicateTask",
        message: "A task with this clientTaskId already exists for this user.",
      });
    }
    console.error("Create task error:", error);
    res.status(400).json({ error: "ValidationError", message: "Failed to create task." });
  }
});

const mongoose = require("mongoose");

// PUT /api/tasks/:id - update a task
router.put("/:id", async (req, res) => {
  try {
    let task = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      task = await Task.findById(req.params.id);
    }
    if (!task) {
      task = await Task.findOne({ user: req.user.id, clientTaskId: req.params.id });
    }

    if (!task) {
      return res.status(404).json({ error: "NotFound", message: "Task not found." });
    }

    if (task.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Forbidden", message: "You are not authorized to update this task." });
    }

    const { title, name, subject, priority, completed, completedAt, dueDate, dueTime, reminder } = req.body;

    if (title !== undefined || name !== undefined) {
      const newTitle = (title || name || "").trim();
      if (newTitle) {
        task.title = newTitle;
        task.name = newTitle;
      }
    }

    if (subject !== undefined) task.subject = subject.trim();
    if (priority !== undefined) task.priority = priority;
    if (completed !== undefined) {
      task.completed = Boolean(completed);
      if (task.completed && !task.completedAt) {
        task.completedAt = completedAt || new Date().toISOString();
      } else if (!task.completed) {
        task.completedAt = null;
      }
    }
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (dueTime !== undefined) task.dueTime = dueTime;
    if (reminder !== undefined) task.reminder = reminder !== null ? Number(reminder) : null;

    const updatedTask = await task.save();
    res.json(updatedTask);
  } catch (error) {
    console.error("Update task error:", error);
    res.status(400).json({ error: "ValidationError", message: "Failed to update task." });
  }
});

// DELETE /api/tasks/:id - delete a task
router.delete("/:id", async (req, res) => {
  try {
    let task = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      task = await Task.findById(req.params.id);
    }
    if (!task) {
      task = await Task.findOne({ user: req.user.id, clientTaskId: req.params.id });
    }

    if (!task) {
      return res.status(404).json({ error: "NotFound", message: "Task not found." });
    }

    if (task.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Forbidden", message: "You are not authorized to delete this task." });
    }

    await Task.findByIdAndDelete(task._id);
    res.json({ message: "Task deleted successfully", id: task._id });
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(400).json({ error: "ValidationError", message: "Failed to delete task." });
  }
});

// POST /api/tasks/bulk-sync - safely migrate tasks from localStorage without duplicates
router.post("/bulk-sync", async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error: "ValidationError", message: "tasks must be an array." });
    }

    const migrated = [];
    for (const item of tasks) {
      const taskTitle = (item.title || item.name || "").trim();
      if (!taskTitle) continue;

      const clientTaskId = String(item.id || "");

      // Check if already migrated
      let existing = null;
      if (clientTaskId) {
        existing = await Task.findOne({ user: req.user.id, clientTaskId });
      }
      if (!existing) {
        existing = await Task.findOne({
          user: req.user.id,
          title: taskTitle,
          dueDate: item.dueDate || "",
        });
      }

      if (existing) {
        // Update existing
        existing.subject = item.subject || existing.subject;
        existing.priority = item.priority || existing.priority;
        existing.completed = item.completed !== undefined ? Boolean(item.completed) : existing.completed;
        existing.dueTime = item.dueTime || existing.dueTime;
        existing.reminder = item.reminder !== undefined ? item.reminder : existing.reminder;
        await existing.save();
        migrated.push(existing);
      } else {
        // Create new
        try {
          const newTask = new Task({
            user: req.user.id,
            title: taskTitle,
            name: taskTitle,
            subject: (item.subject || "").trim(),
            priority: item.priority || "Medium",
            completed: Boolean(item.completed),
            completedAt: item.completedAt || null,
            dueDate: item.dueDate || "",
            dueTime: item.dueTime || "12:00",
            reminder: item.reminder !== undefined && item.reminder !== null ? Number(item.reminder) : null,
            clientTaskId: clientTaskId || null,
          });
          const saved = await newTask.save();
          migrated.push(saved);
        } catch (saveErr) {
          if (saveErr.code === 11000) {
            const found = await Task.findOne({ user: req.user.id, clientTaskId });
            if (found) migrated.push(found);
          } else {
            throw saveErr;
          }
        }
      }
    }

    res.json({ success: true, count: migrated.length, tasks: migrated });
  } catch (error) {
    console.error("Bulk sync tasks error:", error);
    res.status(500).json({ error: "ServerError", message: "Failed to migrate tasks." });
  }
});

module.exports = router;