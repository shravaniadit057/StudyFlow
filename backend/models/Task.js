const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    subject: {
      type: String,
      default: "",
      trim: true,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: String,
      default: null,
    },
    dueDate: {
      type: String,
      default: "",
    },
    dueTime: {
      type: String,
      default: "12:00",
    },
    reminder: {
      type: Number,
      default: null,
    },
    clientTaskId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: prevents duplicate tasks for the same user and clientTaskId
taskSchema.index(
  { user: 1, clientTaskId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientTaskId: { $type: "string" } },
  }
);

module.exports = mongoose.model("Task", taskSchema);