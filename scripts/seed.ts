import "dotenv/config";
import { database } from "../apps/api/src/db.js";
import { seed } from "./sample.js";
if (process.env.NODE_ENV === "production")
  throw new Error("Sample account seeding is disabled in production.");
const db = database();
try {
  await seed(db);
  console.log(
    "Sample data ready. Accounts: organizer@arenix.test, manager@arenix.test, scorer@arenix.test, admin@arenix.test. Password: ArenixDemo!2026. Local development only. Existing accounts are preserved.",
  );
} finally {
  await db.close();
}
