const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, name: user.name },
    process.env.JWT_SECRET || "studyflow_super_secure_jwt_secret_token_2026_production",
    { expiresIn: "30d" }
  );
};

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, pin } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "ValidationError", message: "Name is required." });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ error: "ValidationError", message: "Email is required." });
    }

    if (!pin || !/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({ error: "ValidationError", message: "PIN must be exactly 4 digits." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });

    if (existing) {
      return res.status(400).json({
        error: "UserExists",
        message: "An account with this email already exists. Please log in.",
      });
    }

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      pin: String(pin),
      profile: {
        username: name.trim().replace(/\s+/g, "_"),
        email: normalizedEmail,
      },
    });

    await user.save();
    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        settings: user.settings,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "ServerError", message: "Failed to create account." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, pin } = req.body;

    if (!pin || !/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({ error: "ValidationError", message: "Please provide a valid 4-digit PIN." });
    }

    let user = null;

    if (email && email.trim()) {
      user = await User.findOne({ email: email.trim().toLowerCase() });
    }

    if (!user) {
      // If user not found by email, check if there's a user matching the PIN
      const users = await User.find();
      for (const u of users) {
        const isMatch = await u.comparePin(String(pin));
        if (isMatch) {
          user = u;
          break;
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        error: "InvalidCredentials",
        message: "Invalid email or PIN. Please try again.",
      });
    }

    const isMatch = await user.comparePin(String(pin));
    if (!isMatch) {
      return res.status(401).json({
        error: "InvalidCredentials",
        message: "Incorrect PIN. Please try again.",
      });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        settings: user.settings,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "ServerError", message: "Failed to log in." });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-pin");
    if (!user) {
      return res.status(404).json({ error: "NotFound", message: "User not found." });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        settings: user.settings,
      },
    });
  } catch (error) {
    console.error("Auth me error:", error);
    res.status(500).json({ error: "ServerError", message: "Failed to get user profile." });
  }
});

// PUT /api/auth/profile
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { name, profile, settings } = req.body;
    const update = {};

    if (name) update.name = name.trim();
    if (profile) update.profile = profile;
    if (settings) update.settings = settings;

    const user = await User.findByIdAndUpdate(req.user.id, { $set: update }, { new: true }).select("-pin");

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        settings: user.settings,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "ServerError", message: "Failed to update profile." });
  }
});

module.exports = router;
