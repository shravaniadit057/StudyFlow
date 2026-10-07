const mongoose = require("mongoose");

const userDataSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    profile: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    studyDays: {
      type: [String],
      default: [],
    },
    streakMeta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    motivations: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    notifications: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    firedReminders: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("UserData", userDataSchema);
