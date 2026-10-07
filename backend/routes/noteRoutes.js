const express = require("express");
const NoteFolder = require("../models/NoteFolder");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authMiddleware);

// GET /api/notes
router.get("/", async (req, res) => {
  try {
    const folders = await NoteFolder.find({ user: req.user.id }).sort({ createdAt: 1 });
    res.json(folders);
  } catch (error) {
    console.error("Fetch note folders error:", error);
    res.status(500).json({ error: "ServerError", message: "Failed to fetch folders." });
  }
});

// POST /api/notes
router.post("/", async (req, res) => {
  try {
    const { subject, icon, color, notesList, materialsList, clientFolderId } = req.body;
    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: "ValidationError", message: "Folder subject is required." });
    }

    const folder = new NoteFolder({
      user: req.user.id,
      subject: subject.trim(),
      icon: icon || "📚",
      color: color || "#E3EEFF",
      notesList: notesList || [],
      materialsList: materialsList || [],
      clientFolderId: clientFolderId || null,
    });

    const saved = await folder.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("Create note folder error:", error);
    res.status(400).json({ error: "ValidationError", message: "Failed to create folder." });
  }
});

// PUT /api/notes/:id
router.put("/:id", async (req, res) => {
  try {
    const folder = await NoteFolder.findById(req.params.id);
    if (!folder) {
      return res.status(404).json({ error: "NotFound", message: "Folder not found." });
    }
    if (folder.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Forbidden", message: "Unauthorized." });
    }

    const { subject, icon, color, notesList, materialsList } = req.body;
    if (subject !== undefined) folder.subject = subject.trim();
    if (icon !== undefined) folder.icon = icon;
    if (color !== undefined) folder.color = color;
    if (notesList !== undefined) folder.notesList = notesList;
    if (materialsList !== undefined) folder.materialsList = materialsList;

    const updated = await folder.save();
    res.json(updated);
  } catch (error) {
    console.error("Update note folder error:", error);
    res.status(400).json({ error: "ValidationError", message: "Failed to update folder." });
  }
});

// DELETE /api/notes/:id
router.delete("/:id", async (req, res) => {
  try {
    const folder = await NoteFolder.findById(req.params.id);
    if (!folder) {
      return res.status(404).json({ error: "NotFound", message: "Folder not found." });
    }
    if (folder.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Forbidden", message: "Unauthorized." });
    }

    await NoteFolder.findByIdAndDelete(req.params.id);
    res.json({ message: "Folder deleted successfully", id: req.params.id });
  } catch (error) {
    console.error("Delete note folder error:", error);
    res.status(400).json({ error: "ValidationError", message: "Failed to delete folder." });
  }
});

// POST /api/notes/bulk-sync
router.post("/bulk-sync", async (req, res) => {
  try {
    const { folders } = req.body;
    if (!Array.isArray(folders)) {
      return res.status(400).json({ error: "ValidationError", message: "folders must be an array." });
    }

    const migrated = [];
    for (const f of folders) {
      if (!f.subject) continue;
      const clientFolderId = String(f.id || "");

      let existing = await NoteFolder.findOne({ user: req.user.id, subject: f.subject.trim() });
      if (!existing && clientFolderId) {
        existing = await NoteFolder.findOne({ user: req.user.id, clientFolderId });
      }

      if (existing) {
        existing.icon = f.icon || existing.icon;
        existing.color = f.color || existing.color;
        existing.notesList = f.notesList || existing.notesList;
        existing.materialsList = f.materialsList || existing.materialsList;
        await existing.save();
        migrated.push(existing);
      } else {
        const newFolder = new NoteFolder({
          user: req.user.id,
          subject: f.subject.trim(),
          icon: f.icon || "📚",
          color: f.color || "#E3EEFF",
          notesList: f.notesList || [],
          materialsList: f.materialsList || [],
          clientFolderId: clientFolderId || null,
        });
        const saved = await newFolder.save();
        migrated.push(saved);
      }
    }

    res.json({ success: true, count: migrated.length, folders: migrated });
  } catch (error) {
    console.error("Bulk sync notes error:", error);
    res.status(500).json({ error: "ServerError", message: "Failed to sync notes." });
  }
});

module.exports = router;
