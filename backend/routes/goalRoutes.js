const express = require("express");
const Goal = require("../models/Goal");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authMiddleware);

// GET /api/goals
router.get("/", async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(goals);
  } catch (error) {
    console.error("Fetch goals error:", error);
    res.status(500).json({ error: "ServerError", message: "Failed to fetch goals." });
  }
});

// POST /api/goals
router.post("/", async (req, res) => {
  try {
    const { title, description, category, dueDate, progress, clientGoalId } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "ValidationError", message: "Goal title is required." });
    }

    const goal = new Goal({
      user: req.user.id,
      title: title.trim(),
      description: description || "",
      category: category || "Academic",
      dueDate: dueDate || "",
      progress: typeof progress === "number" ? Math.min(100, Math.max(0, progress)) : 0,
      clientGoalId: clientGoalId || null,
    });

    const saved = await goal.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("Create goal error:", error);
    res.status(400).json({ error: "ValidationError", message: "Failed to create goal." });
  }
});

// PUT /api/goals/:id
router.put("/:id", async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) {
      return res.status(404).json({ error: "NotFound", message: "Goal not found." });
    }
    if (goal.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Forbidden", message: "Unauthorized." });
    }

    const { title, description, category, dueDate, progress } = req.body;
    if (title !== undefined) goal.title = title.trim();
    if (description !== undefined) goal.description = description;
    if (category !== undefined) goal.category = category;
    if (dueDate !== undefined) goal.dueDate = dueDate;
    if (progress !== undefined) goal.progress = Math.min(100, Math.max(0, Number(progress) || 0));

    const updated = await goal.save();
    res.json(updated);
  } catch (error) {
    console.error("Update goal error:", error);
    res.status(400).json({ error: "ValidationError", message: "Failed to update goal." });
  }
});

// DELETE /api/goals/:id
router.delete("/:id", async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) {
      return res.status(404).json({ error: "NotFound", message: "Goal not found." });
    }
    if (goal.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Forbidden", message: "Unauthorized." });
    }

    await Goal.findByIdAndDelete(req.params.id);
    res.json({ message: "Goal deleted successfully", id: req.params.id });
  } catch (error) {
    console.error("Delete goal error:", error);
    res.status(400).json({ error: "ValidationError", message: "Failed to delete goal." });
  }
});

// POST /api/goals/bulk-sync
router.post("/bulk-sync", async (req, res) => {
  try {
    const { goals } = req.body;
    if (!Array.isArray(goals)) {
      return res.status(400).json({ error: "ValidationError", message: "goals must be an array." });
    }

    const migrated = [];
    for (const g of goals) {
      if (!g.title) continue;
      const clientGoalId = String(g.id || "");

      let existing = null;
      if (clientGoalId) {
        existing = await Goal.findOne({ user: req.user.id, clientGoalId });
      }
      if (!existing) {
        existing = await Goal.findOne({ user: req.user.id, title: g.title.trim() });
      }

      if (existing) {
        existing.description = g.description !== undefined ? g.description : existing.description;
        existing.category = g.category || existing.category;
        existing.dueDate = g.dueDate || existing.dueDate;
        existing.progress = g.progress !== undefined ? g.progress : existing.progress;
        await existing.save();
        migrated.push(existing);
      } else {
        const newGoal = new Goal({
          user: req.user.id,
          title: g.title.trim(),
          description: g.description || "",
          category: g.category || "Academic",
          dueDate: g.dueDate || "",
          progress: g.progress || 0,
          clientGoalId: clientGoalId || null,
        });
        const saved = await newGoal.save();
        migrated.push(saved);
      }
    }

    res.json({ success: true, count: migrated.length, goals: migrated });
  } catch (error) {
    console.error("Bulk sync goals error:", error);
    res.status(500).json({ error: "ServerError", message: "Failed to sync goals." });
  }
});

module.exports = router;
