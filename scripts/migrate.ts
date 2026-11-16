import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import { database } from "../apps/api/src/db.js";
const db = database();
try {
  await db.query(
    "CREATE TABLE IF NOT EXISTS public.arenix_migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
  );
  const folder = new URL("../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(folder))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (
      (
        await db.query(
          "SELECT name FROM public.arenix_migrations WHERE name=$1",
          [name],
        )
      ).rows.length
    )
      continue;
    const sql = await readFile(new URL(name, folder), "utf8");
    await db.transaction(async (tx) => {
      await tx.query(sql);
      await tx.query("INSERT INTO public.arenix_migrations(name) VALUES($1)", [
        name,
      ]);
    });
    console.log(`Applied ${name}`);
  }
} finally {
  await db.close();
}
