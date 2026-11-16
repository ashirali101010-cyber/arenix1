import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Database } from "../apps/api/src/db.js";
import type { Role, Team, Tournament } from "../packages/core/types.js";
import { generate, saveResult, schedule } from "../packages/core/engine.js";

export const demoPassword = "ArenixDemo!2026";
export async function seed(db: Database) {
  const names = {
    organizer: "Ahad Sajjad",
    manager: "Hassan Ali",
    scorer: "Ayesha Khan",
    admin: "Arenix Admin",
  };
  const users: Record<string, string> = {};
  const hash = await bcrypt.hash(demoPassword, 12);
  for (const role of ["organizer", "manager", "scorer", "admin"] as Role[]) {
    const email = `${role}@arenix.test`,
      existing = (
        await db.query("SELECT id FROM arenix.users WHERE email=$1", [email])
      ).rows[0];
    const id = existing?.id || randomUUID();
    users[role] = id;
    if (!existing)
      await db.query(
        "INSERT INTO arenix.users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)",
        [id, names[role], email, hash, role],
      );
  }
  if (
    (
      await db.query(
        "SELECT id FROM arenix.tournaments WHERE slug='campus-champions-2026'",
      )
    ).rows.length
  )
    return users;
  const colors = [
    "#b6f36b",
    "#8fa9ff",
    "#ffc16b",
    "#e9a0ef",
    "#66d7cf",
    "#fa897e",
    "#8ac1f4",
    "#d8ce86",
  ];
  const clubs = [
    "Falcons FC",
    "Islamabad United",
    "Thunderbolts",
    "Capital Strikers",
    "Red Wolves",
    "Royal Eagles",
    "Northside Athletic",
    "Campus Rovers",
  ];
  const teams: Team[] = clubs.map((name, i) => ({
    id: randomUUID(),
    name,
    shortName: ["FAL", "ISU", "THU", "CAP", "WOL", "EAG", "NOR", "ROV"][i],
    color: colors[i],
    managerId: users.manager,
    roster: Array.from({ length: 7 }, (_, j) => ({
      name: `Player ${i + 1} ${j + 1}`,
      number: j + 1,
    })),
  }));
  for (const team of teams)
    await db.query(
      "INSERT INTO arenix.teams(id,manager_id,data) VALUES($1,$2,$3)",
      [team.id, team.managerId, JSON.stringify(team)],
    );
  const base = new Date();
  base.setUTCHours(4, 0, 0, 0);
  const at = (hours: number) =>
    new Date(base.getTime() + hours * 3600000).toISOString();
  const t: Tournament = {
    id: randomUUID(),
    slug: "campus-champions-2026",
    organizerId: users.organizer,
    status: "published",
    config: {
      name: "Campus Champions Cup",
      sport: "futsal",
      format: "groups",
      startDate: at(-24),
      endDate: at(24 * 10),
      deadline: at(-48),
      maxTeams: 16,
      minRoster: 5,
      maxRoster: 14,
      restMinutes: 60,
      groupCount: 2,
      description:
        "Eight teams. One campus. Everything to play for. The interdepartmental futsal championship at Foundation University Islamabad.",
    },
    venues: [
      { id: randomUUID(), name: "Main Arena" },
      { id: randomUUID(), name: "Sports Complex" },
    ],
    slots: Array.from({ length: 24 }, (_, i) => ({
      id: randomUUID(),
      start: at(Math.floor(i / 4) * 24 + (i % 4) * 3),
      end: at(Math.floor(i / 4) * 24 + (i % 4) * 3 + 1),
    })),
    registrations: teams.map((team) => ({
      id: randomUUID(),
      team,
      status: "approved",
      decidedBy: users.organizer,
      decisionAt: at(-49),
    })),
    seedOrder: teams.map((x) => x.id),
    drawSeed: "campus-2026",
    matches: [],
    corrections: [],
    createdAt: at(-72),
  };
  t.matches = generate(t, t.seedOrder);
  schedule(t);
  t.matches.forEach((m) => (m.scorerId = users.scorer));
  for (let i = 0; i < 4; i++) {
    const m = t.matches[i];
    saveResult(t, m.id, {
      homeScore: [3, 1, 2, 0][i],
      awayScore: [1, 1, 0, 2][i],
      version: m.version,
    });
  }
  await db.transaction(async (sql) => {
    await sql.query(
      "INSERT INTO arenix.tournaments(id,organizer_id,slug,data) VALUES($1,$2,$3,$4)",
      [t.id, t.organizerId, t.slug, JSON.stringify(t)],
    );
    await sql.query(
      "INSERT INTO arenix.audit(id,tournament_id,actor_id,action,details) VALUES($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        t.id,
        users.organizer,
        "demo.seeded",
        JSON.stringify({
          message: "Synthetic sample tournament with four recorded results.",
        }),
      ],
    );
  });
  const open: Tournament = {
    ...t,
    id: randomUUID(),
    slug: "winter-football-league",
    config: {
      ...t.config,
      name: "Winter Football League",
      sport: "football",
      format: "round_robin",
      startDate: at(24 * 15),
      endDate: at(24 * 25),
      deadline: at(24 * 12),
      maxTeams: 16,
      minRoster: 7,
      maxRoster: 22,
      description:
        "Registration is open for the winter campus football league.",
    },
    status: "registration",
    registrations: [],
    matches: [],
    seedOrder: [],
    venues: [],
    slots: [],
    corrections: [],
  };
  await db.query(
    "INSERT INTO arenix.tournaments(id,organizer_id,slug,data) VALUES($1,$2,$3,$4)",
    [open.id, open.organizerId, open.slug, JSON.stringify(open)],
  );
  return users;
}
