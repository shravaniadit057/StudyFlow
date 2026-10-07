const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    pin: {
      type: String,
      required: true,
    },
    profile: {
      username: { type: String, default: "" },
      bio: { type: String, default: "" },
      phone: { type: String, default: "" },
      avatar: { type: String, default: "" },
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Hash PIN before saving
userSchema.pre("save", async function () {
  if (!this.isModified("pin")) return;
  const salt = await bcrypt.genSalt(10);
  this.pin = await bcrypt.hash(this.pin, salt);
});

// Helper to compare PIN
userSchema.methods.comparePin = async function (enteredPin) {
  return await bcrypt.compare(enteredPin, this.pin);
};

module.exports = mongoose.model("User", userSchema);
