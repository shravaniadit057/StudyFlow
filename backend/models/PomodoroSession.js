const mongoose = require("mongoose");

const pomodoroSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    clientSessionId: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      default: "focus",
    },
    duration: {
      type: Number,
      default: 25,
    },
    completedAt: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("PomodoroSession", pomodoroSessionSchema);
