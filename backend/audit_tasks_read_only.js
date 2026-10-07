const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Task = require("./models/Task");
const User = require("./models/User");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB Atlas.");

  const user = await User.findOne({ email: "sauadit3121@gmail.com" }).lean();
  console.log("User:", user?._id.toString(), user?.name, user?.email);

  const allTasks = await Task.find({ user: user._id }).sort({ createdAt: 1 }).lean();
  console.log(`Total tasks for user: ${allTasks.length}`);

  const byTitle = new Map();
  const byClientId = new Map();

  for (const t of allTasks) {
    const title = t.title || t.name;
    if (!byTitle.has(title)) byTitle.set(title, []);
    byTitle.get(title).push(t);

    const cId = t.clientTaskId || "none";
    if (!byClientId.has(cId)) byClientId.set(cId, []);
    byClientId.get(cId).push(t);
  }

  console.log("\n================ UNIQUE TITLES & OCCURRENCES ================");
  let index = 1;
  for (const [title, list] of byTitle.entries()) {
    console.log(`${index++}. [${list.length} copies] Title: "${title}" | clientTaskId: "${list[0].clientTaskId}" | Subject: "${list[0].subject}" | Due: "${list[0].dueDate}" | Completed: ${list[0].completed}`);
    console.log(`   Timestamps: ${list.map(x => x.createdAt ? x.createdAt.toISOString() : "none").join(", ")}`);
  }

  console.log("\n================ CLIENT TASK ID SUMMARY ================");
  console.log(`Unique clientTaskId values: ${byClientId.size}`);
  let duplicateClientCount = 0;
  for (const [cId, list] of byClientId.entries()) {
    if (list.length > 1) {
      duplicateClientCount++;
      console.log(`Duplicate clientTaskId: "${cId}" (${list.length} copies) -> Title: "${list[0].title}"`);
    }
  }
  console.log(`Number of clientTaskIds with duplicates: ${duplicateClientCount}`);

  // Check other users
  const otherTasks = await Task.find({ user: { $ne: user._id } }).lean();
  console.log(`\nTasks belonging to other users: ${otherTasks.length}`);

  process.exit(0);
}

run().catch(e => {
  console.error("Audit error:", e);
  process.exit(1);
});
