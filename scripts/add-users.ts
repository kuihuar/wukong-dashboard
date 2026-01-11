import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import * as db from "../server/db";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Load .env.local first (higher priority)
dotenv.config({ path: path.resolve(projectRoot, ".env.local") });
// Then load .env (lower priority)
dotenv.config({ path: path.resolve(projectRoot, ".env") });

async function addUsers() {
  console.log("Adding users to database...");
  console.log("Database URL:", process.env.DATABASE_URL ? "Configured" : "Not configured");

  // Wait a bit for database connection
  const database = await db.getDb();
  if (!database) {
    console.error("❌ Database connection failed. Please check DATABASE_URL in .env.local");
    process.exit(1);
  }

  const users = [
    {
      openId: "user-001",
      name: "张三",
      email: "zhangsan@example.com",
      loginMethod: "manual",
      role: "admin" as const,
    },
    {
      openId: "user-002",
      name: "李四",
      email: "lisi@example.com",
      loginMethod: "manual",
      role: "user" as const,
    },
  ];

  for (const userData of users) {
    try {
      await db.upsertUser(userData);
      console.log(`✓ Added user: ${userData.name} (${userData.openId}) - Role: ${userData.role}`);
    } catch (error) {
      console.error(`✗ Failed to add user ${userData.name}:`, error);
    }
  }

  console.log("\n✅ Done! Users added successfully.");
  process.exit(0);
}

addUsers().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

