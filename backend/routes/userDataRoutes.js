const express = require("express");
const UserData = require("../models/UserData");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authMiddleware);

// GET /api/user-data
router.get("/", async (req, res) => {
  try {
    let data = await UserData.findOne({ user: req.user.id });
    if (!data) {
      data = new UserData({ user: req.user.id });
      await data.save();
    }
    res.json(data);
  } catch (error) {
    console.error("Fetch user data error:", error);
    res.status(500).json({ error: "ServerError", message: "Failed to fetch user data." });
  }
});

// PUT /api/user-data
router.put("/", async (req, res) => {
  try {
    const { settings, profile, studyDays, streakMeta, motivations, notifications, firedReminders } = req.body;
    const update = {};

    if (settings !== undefined) update.settings = settings;
    if (profile !== undefined) update.profile = profile;
    if (studyDays !== undefined) update.studyDays = studyDays;
    if (streakMeta !== undefined) update.streakMeta = streakMeta;
    if (motivations !== undefined) update.motivations = motivations;
    if (notifications !== undefined) update.notifications = notifications;
    if (firedReminders !== undefined) update.firedReminders = firedReminders;

    const data = await UserData.findOneAndUpdate(
      { user: req.user.id },
      { $set: update },
      { new: true, upsert: true }
    );

    res.json(data);
  } catch (error) {
    console.error("Update user data error:", error);
    res.status(500).json({ error: "ServerError", message: "Failed to update user data." });
  }
});

module.exports = router;
