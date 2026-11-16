// Explicit review mode only. Production always uses DATABASE_URL and Supabase PostgreSQL.
// Runs a temporary, in-memory PostgreSQL instance through the same Nest API.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { testDatabase } from "../tests/helpers.js";
import { seed } from "./sample.js";
import { createApp } from "../apps/api/src/main.js";
process.env.JWT_SECRET = randomBytes(48).toString("hex");
process.env.NODE_ENV = "development";
process.env.APP_ORIGIN = "http://127.0.0.1:5180";
process.env.ARENIX_REVIEW = "true";
const db = await testDatabase();
await seed(db);
const app = await createApp(db);
await app.listen(3001, "127.0.0.1");
console.log(
  "REVIEW MODE: temporary in-memory PostgreSQL. Changes disappear when stopped. Not a Supabase service. API ready at http://127.0.0.1:3001.",
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, async () => {
    await app.close();
    await db.close();
    process.exit(0);
  });
