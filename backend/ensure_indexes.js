const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Task = require("./models/Task");

async function checkAndBuildIndexes() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB Atlas.");

  console.log("Calling Task.init() to ensure all schema indexes are synchronized...");
  await Task.init();

  const collection = mongoose.connection.collection("tasks");
  const indexes = await collection.indexes();
  console.log("Current indexes on 'tasks' collection:");
  console.log(JSON.stringify(indexes, null, 2));

  const hasCompoundIndex = indexes.some(
    (idx) => idx.key && idx.key.user === 1 && idx.key.clientTaskId === 1 && idx.unique === true
  );

  if (hasCompoundIndex) {
    console.log("SUCCESS: Unique compound index { user: 1, clientTaskId: 1 } exists and is active!");
  } else {
    console.error("FAILED: Unique compound index was not found!");
    process.exit(1);
  }

  process.exit(0);
}

checkAndBuildIndexes().catch((err) => {
  console.error("Index sync error:", err);
  process.exit(1);
});

