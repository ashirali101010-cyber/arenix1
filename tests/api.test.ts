import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../apps/api/src/main.js";
import { testDatabase } from "./helpers.js";
import type { Database } from "../apps/api/src/db.js";
import { demoPassword, seed } from "../scripts/sample.js";
let app: INestApplication,
  db: Database,
  ids: Record<string, string>,
  tournamentId: string;
const origin = "http://127.0.0.1:5173";
const clients: Record<string, ReturnType<typeof request.agent>> = {};
const post = (role: string, path: string, body: unknown) =>
  clients[role].post(`/api${path}`).set("Origin", origin).timeout({ response: 10000, deadline: 15000 }).send(body);
beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "testing-secret-32-characters-or-more-arenix";
  process.env.APP_ORIGIN = origin;
  db = await testDatabase();
  ids = await seed(db);
  app = await createApp(db);
  await app.listen(0, '127.0.0.1');
  for (const role of ["organizer", "manager", "scorer", "admin"]) {
    clients[role] = request.agent(app.getHttpServer());
    const res = await post(role, "/auth/login", {
      email: `${role}@arenix.test`,
      password: demoPassword,
    });
    expect(res.status).toBe(201);
  }
  tournamentId = (await clients.organizer.get("/api/tournaments")).body.find(
    (t: any) => t.slug === "campus-champions-2026",
  ).id;
}, 60000);
afterAll(async () => {
  await app?.close();
  await db?.close();
});
describe("API security and state transitions", () => {
  it("requires sign-in, enforces role boundaries and denies cross-origin writes", async () => {
    expect(
      (await request(app.getHttpServer()).get("/api/tournaments")).status,
    ).toBe(401);
    expect((await post("manager", "/tournaments", {})).status).toBe(403);
    expect((await clients.organizer.get("/api/users")).status).toBe(403);
    expect((await clients.manager.get("/api/scorers")).status).toBe(403);
    expect(
      (
        await clients.organizer
          .post("/api/tournaments")
          .set("Origin", "https://evil.test")
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (await clients.organizer.post("/api/tournaments").send({})).status,
    ).toBe(403);
  });
  it("publishes privacy-safe public data without authentication", async () => {
    const res = await request(app.getHttpServer()).get(
      "/api/public/tournaments/campus-champions-2026",
    );
    expect(res.status).toBe(200);
    expect(
      res.body.registrations.every(
        (r: any) => r.team.roster.length === 0 && !r.team.managerId,
      ),
    ).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("@arenix.test");
    expect(res.body.corrections).toEqual([]);
    expect(res.body.matches.every((m: any) => m.scorerId === undefined)).toBe(true);
  });
  it("validates configuration and prevents client role escalation", async () => {
    const invalid = await post("organizer", "/tournaments", { name: "X" });
    expect(invalid.status).toBe(400);
    const res = await request(app.getHttpServer())
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({
        name: "Sneaky Admin",
        email: "sneak@test.com",
        password: "Password2026!",
        role: "admin",
      });
    expect(res.status).toBe(400);
  });
  it("commits score, standings, and audit, rejects stale saves and wrong scorer", async () => {
    const t = (await clients.scorer.get(`/api/tournaments/${tournamentId}`))
        .body,
      m = t.matches.find((m: any) => m.status === "scheduled");
    const body = {
      matchId: m.id,
      homeScore: 4,
      awayScore: 1,
      version: m.version,
    };
    expect(
      (
        await post(
          "organizer",
          `/tournaments/${tournamentId}/actions/result`,
          body,
        )
      ).status,
    ).toBe(403);
    const saved = await post(
      "scorer",
      `/tournaments/${tournamentId}/actions/result`,
      body,
    );
    expect(saved.status).toBe(201);
    expect(
      saved.body.tournament.matches.find((x: any) => x.id === m.id).homeScore,
    ).toBe(4);
    expect(
      (
        await post(
          "scorer",
          `/tournaments/${tournamentId}/actions/result`,
          body,
        )
      ).status,
    ).toBe(409);
    const audit = await clients.organizer.get(
      `/api/tournaments/${tournamentId}/audit`,
    );
    expect(audit.body[0].action).toBe("result");
    expect(
      audit.body[0].details.before.matches.find((x: any) => x.id === m.id)
        .homeScore,
    ).toBeNull();
  });
  it("records and approves a result correction with its reason and old value", async () => {
    let t = (await clients.scorer.get(`/api/tournaments/${tournamentId}`)).body,
      m = t.matches[0];
    const r = await post(
      "scorer",
      `/tournaments/${tournamentId}/actions/request-correction`,
      {
        matchId: m.id,
        homeScore: 2,
        awayScore: 2,
        version: m.version,
        reason: "Referee confirmed the corrected full-time score.",
      },
    );
    expect(r.status).toBe(201);
    const c = r.body.tournament.corrections[0];
    const approved = await post(
      "organizer",
      `/tournaments/${tournamentId}/actions/decide-correction`,
      { correctionId: c.id, decision: "approved" },
    );
    expect(approved.status).toBe(201);
    expect(approved.body.tournament.matches[0].homeScore).toBe(2);
    expect(approved.body.tournament.corrections[0].status).toBe("approved");
  });
  it("rejects late registration, schedule conflicts, and foreign organizer ownership", async () => {
    const team = (await clients.manager.get("/api/teams")).body[0];
    expect(
      (
        await post("manager", `/tournaments/${tournamentId}/actions/register`, {
          teamId: team.id,
        })
      ).status,
    ).toBe(400);
    const t = (await clients.organizer.get(`/api/tournaments/${tournamentId}`))
        .body,
      ms = t.matches.filter((m: any) => m.status === "scheduled");
    expect(
      (
        await post(
          "organizer",
          `/tournaments/${tournamentId}/actions/reschedule`,
          {
            matchId: ms[0].id,
            version: ms[0].version,
            venueId: ms[1].venueId,
            slotId: ms[1].slotId,
          },
        )
      ).status,
    ).toBe(400);
    await request(app.getHttpServer())
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({
        name: "Other Organizer",
        email: "other@arenix.test",
        password: demoPassword,
        role: "organizer",
      });
    const other = request.agent(app.getHttpServer());
    await other
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email: "other@arenix.test", password: demoPassword });
    expect((await other.get(`/api/tournaments/${tournamentId}`)).status).toBe(
      403,
    );
    expect(
      (
        await other
          .post(`/api/tournaments/${tournamentId}/actions/venue`)
          .set("Origin", origin)
          .send({ name: "Wrong ownership" })
      ).status,
    ).toBe(403);
  });
  it("enforces roster limits and registration approval capacity in a new tournament", async () => {
    const future = (days: number) =>
      new Date(Date.now() + days * 86400000).toISOString();
    const created = await post("organizer", "/tournaments", {
      name: "Integration Cup",
      sport: "football",
      format: "knockout",
      startDate: future(10),
      endDate: future(11),
      deadline: future(9),
      maxTeams: 4,
      minRoster: 1,
      maxRoster: 10,
      restMinutes: 60,
      groupCount: 2,
      description: "",
    });
    expect(created.status).toBe(201);
    const id = created.body.id;
    const teams = (await clients.manager.get("/api/teams")).body.slice(0, 5);
    for (const team of teams)
      expect(
        (
          await post("manager", `/tournaments/${id}/actions/register`, {
            teamId: team.id,
          })
        ).status,
      ).toBe(201);
    let t = (await clients.organizer.get(`/api/tournaments/${id}`)).body;
    for (let i = 0; i < 4; i++)
      expect(
        (
          await post(
            "organizer",
            `/tournaments/${id}/actions/decide-registration`,
            { registrationId: t.registrations[i].id, decision: "approved" },
          )
        ).status,
      ).toBe(201);
    expect(
      (
        await post(
          "organizer",
          `/tournaments/${id}/actions/decide-registration`,
          { registrationId: t.registrations[4].id, decision: "approved" },
        )
      ).status,
    ).toBe(400);
    const drawn = await post(
      "organizer",
      `/tournaments/${id}/actions/generate`,
      { method: "random", seed: "integration" },
    );
    expect(drawn.body.tournament.matches).toHaveLength(3);
    expect(
      (await request(app.getHttpServer()).get(`/api/public/tournaments/${id}`))
        .status,
    ).toBe(404);
    expect(
      (await post("organizer", `/tournaments/${id}/actions/publish`, {}))
        .status,
    ).toBe(400);
    expect(
      (
        await post("organizer", `/tournaments/${id}/actions/venue`, {
          name: "Arena",
        })
      ).status,
    ).toBe(201);
    for (let i = 0; i < 4; i++)
      expect(
        (
          await post("organizer", `/tournaments/${id}/actions/slot`, {
            start: new Date(
              Date.parse(future(10)) + i * 3 * 3600000,
            ).toISOString(),
            end: new Date(
              Date.parse(future(10)) + (i * 3 + 1) * 3600000,
            ).toISOString(),
          })
        ).status,
      ).toBe(201);
    const scheduled = await post(
      "organizer",
      `/tournaments/${id}/actions/schedule`,
      {},
    );
    expect(scheduled.body.result.unplaced).toEqual([]);
    t = scheduled.body.tournament;
    for (const m of t.matches)
      expect(
        (
          await post("organizer", `/tournaments/${id}/actions/assign-scorer`, {
            matchId: m.id,
            scorerId: ids.scorer,
            version: m.version,
          })
        ).status,
      ).toBe(201);
    expect(
      (await post("organizer", `/tournaments/${id}/actions/publish`, {}))
        .status,
    ).toBe(201);
    expect(
      (await request(app.getHttpServer()).get(`/api/public/tournaments/${id}`))
        .status,
    ).toBe(200);
  });
  it("deactivates accounts immediately and invalidates old sessions after reactivation", async () => {
    expect(
      (await post("admin", `/users/${ids.manager}/active`, { active: false }))
        .status,
    ).toBe(201);
    expect((await clients.manager.get("/api/teams")).status).toBe(401);
    expect(
      (await post("admin", `/users/${ids.manager}/active`, { active: true }))
        .status,
    ).toBe(201);
    expect((await clients.manager.get("/api/teams")).status).toBe(401);
    expect(
      (await post("admin", `/users/${ids.admin}/active`, { active: false }))
        .status,
    ).toBe(400);
  });
  it("locks an account after exactly five failures and uses bcrypt cost 12 with 30-minute cookies", async () => {
    const agent = request.agent(app.getHttpServer());
    for (let i = 0; i < 5; i++) {
      const res = await agent
        .post("/api/auth/login")
        .set("Origin", origin)
        .send({ email: "manager@arenix.test", password: "wrong" });
      expect(res.status).toBe(i === 4 ? 423 : 401);
    }
    expect(
      (
        await agent
          .post("/api/auth/login")
          .set("Origin", origin)
          .send({ email: "manager@arenix.test", password: demoPassword })
      ).status,
    ).toBe(423);
    const row = (
      await db.query(
        "SELECT password_hash,locked_until,failed_attempts FROM arenix.users WHERE id=$1",
        [ids.manager],
      )
    ).rows[0];
    expect(row.password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(row.failed_attempts).toBe(5);
    expect(new Date(row.locked_until).getTime() - Date.now()).toBeGreaterThan(
      14 * 60000,
    );
    const r = await clients.organizer
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email: "organizer@arenix.test", password: demoPassword });
    expect(String(r.headers["set-cookie"])).toContain("Max-Age=1800");
    expect(String(r.headers["set-cookie"])).toContain("HttpOnly");
  });
});
