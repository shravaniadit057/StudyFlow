const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Task = require("./models/Task");
const User = require("./models/User");

async function runDeduplication() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB Atlas.");

  const user = await User.findOne({ email: "sauadit3121@gmail.com" }).lean();
  if (!user) {
    throw new Error("User sauadit3121@gmail.com not found!");
  }
  console.log(`Authenticated user ID: ${user._id} (${user.name})`);

  // Fetch all tasks for user
  const allTasks = await Task.find({ user: user._id }).sort({ createdAt: 1, _id: 1 }).lean();
  console.log(`Initial total tasks for user: ${allTasks.length}`);

  // Safety check: Back up all tasks to file
  const backupPath = path.join(__dirname, "tasks_backup_pre_dedup.json");
  fs.writeFileSync(backupPath, JSON.stringify(allTasks, null, 2), "utf8");
  console.log(`Saved pre-deduplication backup of ${allTasks.length} tasks to ${backupPath}`);

  // Group by clientTaskId (or title if clientTaskId is missing)
  const groupMap = new Map();
  for (const t of allTasks) {
    const key = t.clientTaskId ? `clientTaskId:${t.clientTaskId}` : `title:${(t.title || t.name).trim()}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key).push(t);
  }

  console.log(`Distinct task groups identified: ${groupMap.size}`);

  const toRetain = [];
  const toDelete = [];

  for (const [key, group] of groupMap.entries()) {
    // Sort ascending by createdAt, then _id
    group.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return String(a._id).localeCompare(String(b._id));
    });

    // Retain the earliest-created document
    const canonical = group[0];
    toRetain.push(canonical);

    // Any extra copies are marked for deletion
    for (let i = 1; i < group.length; i++) {
      toDelete.push(group[i]._id);
    }
  }

  console.log(`Canonical documents to retain: ${toRetain.length}`);
  console.log(`Redundant duplicate documents to remove: ${toDelete.length}`);

  // Strict validation before executing delete
  if (toRetain.length !== 24) {
    throw new Error(`Safety check failed: expected exactly 24 canonical tasks, found ${toRetain.length}. Aborting.`);
  }
  if (toDelete.length !== 69) {
    throw new Error(`Safety check failed: expected exactly 69 duplicate tasks to delete, found ${toDelete.length}. Aborting.`);
  }

  console.log("Validation passed! Proceeding with safe deletion of the 69 redundant duplicate documents...");

  const deleteResult = await Task.deleteMany({
    _id: { $in: toDelete },
    user: user._id, // Extra safety: ensure only this user's records are deleted
  });

  console.log(`Delete operation result: deletedCount = ${deleteResult.deletedCount}`);

  // Verification
  const remainingTasks = await Task.find({ user: user._id }).sort({ createdAt: 1 }).lean();
  console.log(`\n--- POST-CLEANUP VERIFICATION ---`);
  console.log(`Total remaining tasks for user: ${remainingTasks.length}`);

  const uniqueClientTaskIds = new Set(remainingTasks.map((t) => t.clientTaskId));
  console.log(`Unique clientTaskId count: ${uniqueClientTaskIds.size}`);

  const clientTaskIdCounts = {};
  for (const t of remainingTasks) {
    clientTaskIdCounts[t.clientTaskId] = (clientTaskIdCounts[t.clientTaskId] || 0) + 1;
  }
  const duplicateClientTaskIds = Object.entries(clientTaskIdCounts).filter(([_, count]) => count > 1);
  console.log(`Duplicate clientTaskIds: ${duplicateClientTaskIds.length}`);

  const otherUserTasks = await Task.find({ user: { $ne: user._id } }).lean();
  console.log(`Tasks belonging to other users: ${otherUserTasks.length}`);

  if (remainingTasks.length === 24 && uniqueClientTaskIds.size === 24 && duplicateClientTaskIds.length === 0 && otherUserTasks.length === 0) {
    console.log("\n SUCCESS: Database deduplication completed cleanly and perfectly verified.");
  } else {
    console.error("\n WARNING: Counts did not match expectations.");
  }

  process.exit(0);
}

runDeduplication().catch((err) => {
  console.error("Deduplication error:", err);
  process.exit(1);
});

