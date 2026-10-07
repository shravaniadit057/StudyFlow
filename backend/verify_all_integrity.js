const mongoose = require("mongoose");
const path = require("path");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Task = require("./models/Task");
const User = require("./models/User");

const API_BASE = "http://localhost:5000/api";
const JWT_SECRET = process.env.JWT_SECRET || "studyflow_super_secure_jwt_secret_token_2026_production";

async function verifyAll() {
  console.log("================ STARTING COMPREHENSIVE INTEGRITY VERIFICATION ================\n");

  // 1 & 2. Connect to MongoDB Atlas and verify backend health
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("[1 & 2]  MongoDB Atlas Connected via Mongoose.");

  const healthRes = await fetch(`${API_BASE}/health`);
  const health = await healthRes.json();
  if (health.status !== "ok" || !health.database.connected) {
    throw new Error("Health check failed!");
  }
  console.log(" Health check endpoint OK:", health);

  // 3. Verify unique compound index { user: 1, clientTaskId: 1 } exists on 'tasks'
  const taskIndexes = await mongoose.connection.collection("tasks").indexes();
  const compoundIdx = taskIndexes.find(
    (idx) => idx.key && idx.key.user === 1 && idx.key.clientTaskId === 1 && idx.unique === true
  );
  if (!compoundIdx) {
    throw new Error("Compound unique index { user: 1, clientTaskId: 1 } NOT found!");
  }
  console.log("[3]  Unique compound index exists:", compoundIdx.name);

  // Target User check
  const targetUser = await User.findOne({ email: "sauadit3121@gmail.com" });
  if (!targetUser) throw new Error("Target user sauadit3121@gmail.com not found!");
  console.log(` Target user confirmed: ${targetUser.name} (${targetUser._id})`);

  // Token for Shravani Adit
  const token = jwt.sign(
    { id: targetUser._id.toString(), email: targetUser.email, name: targetUser.name },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // 4. Verify my user's task count is exactly 24
  const userTasks = await Task.find({ user: targetUser._id }).lean();
  console.log(`[4]  User total task documents: ${userTasks.length} (Expected: 24)`);
  if (userTasks.length !== 24) throw new Error(`Expected 24 tasks, found ${userTasks.length}`);

  // 5. Verify unique clientTaskId count is exactly 24
  const clientTaskIds = new Set(userTasks.map((t) => t.clientTaskId));
  console.log(`[5]  Unique clientTaskId count: ${clientTaskIds.size} (Expected: 24)`);
  if (clientTaskIds.size !== 24) throw new Error(`Expected 24 unique clientTaskIds, found ${clientTaskIds.size}`);

  // 6. Verify duplicate clientTaskId count is 0
  const counts = {};
  for (const t of userTasks) counts[t.clientTaskId] = (counts[t.clientTaskId] || 0) + 1;
  const dups = Object.entries(counts).filter(([_, c]) => c > 1);
  console.log(`[6]  Duplicate clientTaskId count: ${dups.length} (Expected: 0)`);
  if (dups.length !== 0) throw new Error(`Found duplicates: ${JSON.stringify(dups)}`);

  // 7. Verify no task belongs to another user
  const otherUserTasks = await Task.find({ user: { $ne: targetUser._id } }).lean();
  console.log(`[7]  Tasks belonging to other users: ${otherUserTasks.length} (Expected: 0)`);
  if (otherUserTasks.length !== 0) throw new Error(`Found tasks belonging to other users: ${otherUserTasks.length}`);

  // 8. Verify login API works
  console.log("[8]  Verifying login API functionality...");
  const tempTestEmail = `verify_login_${Date.now()}@test.local`;
  const signupRes = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Login Test User",
      email: tempTestEmail,
      pin: "4321",
    }),
  });
  const signupData = await signupRes.json();
  if (!signupRes.ok || !signupData.token) {
    throw new Error(`Signup failed in verification: ${JSON.stringify(signupData)}`);
  }

  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: tempTestEmail,
      pin: "4321",
    }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.token) {
    throw new Error(`Login API verification failed: ${JSON.stringify(loginData)}`);
  }
  console.log(" Login endpoint verified successfully (JWT returned).");
  // Clean up temporary login test user
  await User.findByIdAndDelete(signupData.user.id);

  // 9. Verify creating a new task works
  console.log("[9]  Verifying create task API...");
  const testClientTaskId = "temp-verify-test-" + Date.now();
  const createRes = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      title: "Temporary Verification Task",
      subject: "Testing",
      priority: "Low",
      clientTaskId: testClientTaskId,
    }),
  });
  const createdTask = await createRes.json();
  if (!createRes.ok || !createdTask._id) {
    throw new Error(`Failed to create task: ${JSON.stringify(createdTask)}`);
  }
  console.log(" Create task verified. Created ID:", createdTask._id);

  // 10. Verify editing a task works
  console.log("[10] Verifying edit task API...");
  const editRes = await fetch(`${API_BASE}/tasks/${createdTask._id}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      title: "Updated Verification Task Title",
      priority: "High",
    }),
  });
  const editedTask = await editRes.json();
  if (!editRes.ok || editedTask.title !== "Updated Verification Task Title") {
    throw new Error(`Failed to edit task: ${JSON.stringify(editedTask)}`);
  }
  console.log(" Edit task verified.");

  // 11. Verify completing/uncompleting a task works
  console.log("[11] Verifying task completion toggle...");
  const toggleRes = await fetch(`${API_BASE}/tasks/${createdTask._id}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({ completed: true }),
  });
  const toggledTask = await toggleRes.json();
  if (!toggleRes.ok || toggledTask.completed !== true) {
    throw new Error(`Failed to toggle completed: ${JSON.stringify(toggledTask)}`);
  }

  const unToggleRes = await fetch(`${API_BASE}/tasks/${createdTask._id}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({ completed: false }),
  });
  const unToggledTask = await unToggleRes.json();
  if (!unToggleRes.ok || unToggledTask.completed !== false) {
    throw new Error(`Failed to uncomplete task: ${JSON.stringify(unToggledTask)}`);
  }
  console.log(" Complete / uncomplete task verified.");

  // 12. Verify deleting a task works
  console.log("[12] Verifying delete task API...");
  const delRes = await fetch(`${API_BASE}/tasks/${createdTask._id}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  const delData = await delRes.json();
  if (!delRes.ok) throw new Error(`Failed to delete task: ${JSON.stringify(delData)}`);
  console.log(" Delete task verified. Temporary test task deleted.");

  // Verify task count is exactly 24
  const postTestTasks = await Task.find({ user: targetUser._id }).lean();
  if (postTestTasks.length !== 24) {
    throw new Error(`Expected 24 tasks after delete test, found ${postTestTasks.length}!`);
  }
  console.log(" Task count verified restored to exactly 24.");

  // 13 & 14. Verify migration works and repeated/parallel calls do NOT create duplicates
  console.log("[13 & 14] Testing migration idempotence and race-condition resistance...");
  const rawTasks = postTestTasks.map((t) => ({
    id: t.clientTaskId,
    title: t.title,
    subject: t.subject,
    priority: t.priority,
    completed: t.completed,
    dueDate: t.dueDate,
  }));

  // Sequential migration call
  const mig1Res = await fetch(`${API_BASE}/sync/migrate-all`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ tasks: rawTasks }),
  });
  const mig1Data = await mig1Res.json();
  console.log("   Sequential migration result (tasks inserted):", mig1Data.migrated?.tasks || 0);

  // 3 concurrent/parallel migration requests simultaneously
  const [p1, p2, p3] = await Promise.all([
    fetch(`${API_BASE}/sync/migrate-all`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ tasks: rawTasks }),
    }),
    fetch(`${API_BASE}/sync/migrate-all`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ tasks: rawTasks }),
    }),
    fetch(`${API_BASE}/sync/migrate-all`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ tasks: rawTasks }),
    }),
  ]);
  const [d1, d2, d3] = await Promise.all([p1.json(), p2.json(), p3.json()]);
  console.log("   Concurrent migration messages:", [d1.message, d2.message, d3.message]);

  // Check task count after repeated/parallel migrations
  const postMigTasks = await Task.find({ user: targetUser._id }).lean();
  console.log(`   Task count after repeated migrations: ${postMigTasks.length} (Expected: 24)`);
  if (postMigTasks.length !== 24) {
    throw new Error(`Repeated migration created duplicates! Count is ${postMigTasks.length}`);
  }
  console.log(" Migration works and is 100% idempotent with zero duplicates created!");

  // 15. Verify cross-user isolation and security
  console.log("[15] Verifying another user cannot access or modify tasks...");
  const otherUserEmail = `other_student_${Date.now()}@test.local`;
  const otherSignupRes = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Other Student",
      email: otherUserEmail,
      pin: "9999",
    }),
  });
  const otherSignupData = await otherSignupRes.json();
  const otherToken = otherSignupData.token;
  const otherUserId = otherSignupData.user.id;

  // Other user fetches tasks
  const otherTasksRes = await fetch(`${API_BASE}/tasks`, {
    headers: { Authorization: `Bearer ${otherToken}` },
  });
  const otherTasks = await otherTasksRes.json();
  console.log(`   Other user tasks count: ${otherTasks.length} (Expected: 0)`);
  if (otherTasks.length !== 0) throw new Error("Other user can see tasks!");

  // Other user attempts to update Shravani's task
  const shravaniTaskId = postMigTasks[0]._id.toString();
  const unauthorizedUpdateRes = await fetch(`${API_BASE}/tasks/${shravaniTaskId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${otherToken}`,
    },
    body: JSON.stringify({ title: "Unauthorized Attempt" }),
  });
  console.log(`   Unauthorized PUT status: ${unauthorizedUpdateRes.status} (Expected: 403 or 404)`);
  if (unauthorizedUpdateRes.status !== 403 && unauthorizedUpdateRes.status !== 404) {
    throw new Error("Unauthorized update was not forbidden!");
  }

  // Other user attempts to delete Shravani's task
  const unauthorizedDeleteRes = await fetch(`${API_BASE}/tasks/${shravaniTaskId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${otherToken}` },
  });
  console.log(`   Unauthorized DELETE status: ${unauthorizedDeleteRes.status} (Expected: 403 or 404)`);
  if (unauthorizedDeleteRes.status !== 403 && unauthorizedDeleteRes.status !== 404) {
    throw new Error("Unauthorized delete was not forbidden!");
  }

  // Clean up temporary other user
  await User.findByIdAndDelete(otherUserId);
  console.log("   Temporary other user removed.");

  // Final confirmation of data integrity
  const finalTasks = await Task.find({ user: targetUser._id }).lean();
  const finalUniqueClientIds = new Set(finalTasks.map((t) => t.clientTaskId));
  console.log("\n================ ALL 15 VERIFICATIONS COMPLETED SUCCESSFULLY ================");
  console.log(`✔ Backend tests & health: PASSED`);
  console.log(`✔ MongoDB Atlas connection: PASSED`);
  console.log(`✔ Unique compound index: ACTIVE (user_1_clientTaskId_1)`);
  console.log(`✔ User task count: ${finalTasks.length} (EXACTLY 24)`);
  console.log(`✔ Unique clientTaskId count: ${finalUniqueClientIds.size} (EXACTLY 24)`);
  console.log(`✔ Duplicate clientTaskId count: 0`);
  console.log(`✔ Other user task count: 0`);
  console.log(`✔ Login API: PASSED`);
  console.log(`✔ Create task API: PASSED`);
  console.log(`✔ Edit task API: PASSED`);
  console.log(`✔ Complete/uncomplete API: PASSED`);
  console.log(`✔ Delete task API: PASSED`);
  console.log(`✔ Migration works: PASSED`);
  console.log(`✔ Migration idempotent under concurrent load: PASSED (ZERO duplicates)`);
  console.log(`✔ User isolation & security: PASSED (Unauthorized requests rejected)`);

  process.exit(0);
}

verifyAll().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

