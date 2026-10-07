const mongoose = require("mongoose");

const noteFolderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    clientFolderId: {
      type: String,
      default: null,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    icon: {
      type: String,
      default: "📚",
    },
    color: {
      type: String,
      default: "#E3EEFF",
    },
    notesList: [
      {
        id: { type: String },
        text: { type: String },
        createdAt: { type: String },
      },
    ],
    materialsList: [
      {
        id: { type: String },
        name: { type: String },
        type: { type: String },
        size: { type: Number },
        uploadedAt: { type: String },
        category: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("NoteFolder", noteFolderSchema);
