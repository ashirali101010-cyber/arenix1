import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import type { Database, Sql } from "../apps/api/src/db.js";
import type { Format, Tournament } from "../packages/core/types.js";
export async function testDatabase(): Promise<Database> {
  const pg = new PGlite();
  const raw: Sql = {
    query: async (sql, params) => {
      const result: any = await pg.query(sql, params);
      return { rows: result.rows, rowCount: result.affectedRows };
    },
  };
  // pg.query accepts a single statement; migration uses the native exec path.
  await pg.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202611010001_arenix.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  let tail = Promise.resolve();
  async function serial<T>(fn: () => Promise<T>) {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => (release = resolve));
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }
  return {
    query: (sql, params) => serial(() => raw.query(sql, params)),
    transaction: (fn) =>
      serial(async () => {
        await pg.exec("BEGIN");
        try {
          const result = await fn(raw);
          await pg.exec("COMMIT");
          return result;
        } catch (e) {
          await pg.exec("ROLLBACK");
          throw e;
        }
      }),
    close: () => pg.close(),
  };
}
export function tournament(n = 8, format: Format = "round_robin"): Tournament {
  return {
    id: "t",
    slug: "test",
    organizerId: "owner",
    config: {
      name: "Test",
      sport: "football",
      format,
      startDate: "2026-01-01T00:00:00Z",
      endDate: "2027-01-01T00:00:00Z",
      deadline: "2025-12-31T00:00:00Z",
      maxTeams: 32,
      minRoster: 1,
      maxRoster: 30,
      restMinutes: 60,
      groupCount: n >= 8 ? 4 : 2,
      description: "",
    },
    status: "draft",
    venues: Array.from({ length: 4 }, (_, i) => ({
      id: `v${i}`,
      name: `Venue ${i}`,
    })),
    slots: Array.from({ length: 600 }, (_, i) => ({
      id: `s${i}`,
      start: new Date(Date.UTC(2026, 0, 1, i * 2)).toISOString(),
      end: new Date(Date.UTC(2026, 0, 1, i * 2 + 1)).toISOString(),
    })),
    registrations: Array.from({ length: n }, (_, i) => ({
      id: `r${i}`,
      status: "approved",
      team: {
        id: `team-${String(i).padStart(2, "0")}`,
        name: `Team ${i}`,
        shortName: `T${i}`,
        color: "#b6f36b",
        managerId: "m",
        roster: [{ name: "A Player", number: 1 }],
      },
    })),
    matches: [],
    corrections: [],
    seedOrder: Array.from(
      { length: n },
      (_, i) => `team-${String(i).padStart(2, "0")}`,
    ),
    createdAt: "",
  };
}
