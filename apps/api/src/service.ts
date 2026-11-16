import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import type { Team, Tournament, User } from "../../../packages/core/types.js";
import {
  assert,
  generate,
  placementError,
  publicTournament,
  saveResult,
  schedule,
  shuffled,
  tables,
} from "../../../packages/core/engine.js";
import { Repository, audit } from "./db.js";
import { identity, role } from "./auth.js";

const date = z.string().datetime({ offset: true });
export const configSchema = z
  .object({
    name: z.string().trim().min(3).max(100),
    sport: z.enum(["football", "futsal"]),
    format: z.enum(["round_robin", "knockout", "groups"]),
    startDate: date,
    endDate: date,
    deadline: date,
    maxTeams: z.number().int().min(4).max(32),
    minRoster: z.number().int().min(1).max(30),
    maxRoster: z.number().int().min(1).max(30),
    restMinutes: z.number().int().min(0).max(1440),
    groupCount: z.number().int().min(2).max(16),
    description: z.string().trim().max(1000).default(""),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      Date.parse(v.startDate) >= Date.parse(v.endDate) ||
      Date.parse(v.deadline) > Date.parse(v.startDate) ||
      v.minRoster > v.maxRoster
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Check dates and roster limits: deadline must precede start, start must precede end, minimum roster cannot exceed maximum.",
      });
  });
export const teamSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    shortName: z
      .string()
      .trim()
      .min(2)
      .max(4)
      .transform((s) => s.toUpperCase()),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    roster: z
      .array(
        z
          .object({
            name: z.string().trim().min(2).max(80),
            number: z.number().int().min(1).max(99),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict()
  .refine(
    (t) => new Set(t.roster.map((p) => p.number)).size === t.roster.length,
    "Squad numbers must be unique.",
  );
const scoreSchema = z.object({
  matchId: z.string().min(1).max(100),
  homeScore: z.number().int().min(0).max(99),
  awayScore: z.number().int().min(0).max(99),
  penaltyHome: z.number().int().min(0).max(99).optional(),
  penaltyAway: z.number().int().min(0).max(99).optional(),
  version: z.number().int().nonnegative(),
});
export class Service {
  constructor(public repo: Repository) {}
  owner(t: Tournament, u: User) {
    role(u, "organizer");
    if (t.organizerId !== u.id)
      throw new ForbiddenException(
        "This tournament belongs to another organizer.",
      );
  }
  async list(u: User) {
    return (await this.repo.list())
      .filter(
        (t) =>
          u.role === "admin" ||
          t.organizerId === u.id ||
          (u.role === "manager" &&
            (t.status === "registration" ||
              t.registrations.some((r) => r.team.managerId === u.id))) ||
          (u.role === "scorer" && t.matches.some((m) => m.scorerId === u.id)),
      )
      .map((t) => ({ ...this.visible(t, u), standings: tables(t) }));
  }
  visible(t: Tournament, u: User): Tournament {
    if (u.role === "admin" || t.organizerId === u.id) return t;
    return {
      ...t,
      registrations: t.registrations
        .filter((r) => r.status === "approved" || r.team.managerId === u.id)
        .map((r) => ({
          ...r,
          team: {
            ...r.team,
            roster: r.team.managerId === u.id ? r.team.roster : [],
            managerId: r.team.managerId === u.id ? u.id : "",
          },
        })),
      corrections: t.corrections.filter((c) => c.requestedBy === u.id),
    };
  }
  async detail(id: string, u: User) {
    const t = await this.repo.get(id);
    if (
      t.organizerId !== u.id &&
      u.role !== "admin" &&
      !(
        (u.role === "manager" &&
          (t.status === "registration" ||
            t.registrations.some((r) => r.team.managerId === u.id))) ||
        (u.role === "scorer" && t.matches.some((m) => m.scorerId === u.id))
      )
    )
      throw new ForbiddenException();
    return { ...this.visible(t, u), standings: tables(t) };
  }
  async create(input: unknown, u: User) {
    role(u, "organizer");
    const config = configSchema.parse(input);
    assert(
      Date.parse(config.deadline) > Date.now(),
      "Registration deadline must be in the future.",
    );
    const id = randomUUID(),
      slug = `${
        config.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "tournament"
      }-${id.slice(0, 6)}`;
    const t: Tournament = {
      id,
      slug,
      organizerId: u.id,
      config,
      status: "registration",
      venues: [],
      slots: [],
      registrations: [],
      matches: [],
      seedOrder: [],
      corrections: [],
      createdAt: new Date().toISOString(),
    };
    await this.repo.db.transaction(async (sql) => {
      await sql.query(
        "INSERT INTO arenix.tournaments(id,organizer_id,slug,data) VALUES($1,$2,$3,$4)",
        [id, u.id, slug, JSON.stringify(t)],
      );
      await audit(sql, u.id, id, "tournament.created", { config });
    });
    return t;
  }
  async createTeam(input: unknown, u: User) {
    role(u, "manager");
    const data = teamSchema.parse(input),
      team: Team = { ...data, id: randomUUID(), managerId: u.id };
    await this.repo.db.transaction(async (sql) => {
      await sql.query(
        "INSERT INTO arenix.teams(id,manager_id,data) VALUES($1,$2,$3)",
        [team.id, u.id, JSON.stringify(team)],
      );
      await audit(sql, u.id, null, "team.created", {
        teamId: team.id,
        name: team.name,
      });
    });
    return team;
  }
  async editTeam(id: string, input: unknown, u: User) {
    role(u, "manager");
    const data = teamSchema.parse(input);
    return this.repo.db.transaction(async (sql) => {
      const row = (
        await sql.query(
          "SELECT data FROM arenix.teams WHERE id::text=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!row) throw new NotFoundException();
      if (row.data.managerId !== u.id) throw new ForbiddenException();
      const team = { ...data, id, managerId: u.id };
      await sql.query("UPDATE arenix.teams SET data=$2 WHERE id=$1", [
        id,
        JSON.stringify(team),
      ]);
      await audit(sql, u.id, null, "team.updated", {
        before: row.data,
        after: team,
      });
      return team;
    });
  }
  async action(id: string, action: string, input: unknown, u: User) {
    const result = await this.repo.mutate(id, u.id, action, async (t, sql) => {
      if (action === "register") {
        role(u, "manager");
        const { teamId } = z
          .object({ teamId: z.string().uuid() })
          .strict()
          .parse(input);
        assert(
          t.status === "registration" &&
            Date.now() <= Date.parse(t.config.deadline),
          "Registration is closed.",
        );
        const row = (
          await sql.query(
            "SELECT data FROM arenix.teams WHERE id=$1 FOR UPDATE",
            [teamId],
          )
        ).rows[0];
        assert(row, "Team not found.");
        const team: Team = row.data;
        if (team.managerId !== u.id)
          throw new ForbiddenException("You can register only your own team.");
        assert(
          !t.registrations.some((r) => r.team.id === teamId),
          "This team already has a registration.",
        );
        assert(
          team.roster.length >= t.config.minRoster &&
            team.roster.length <= t.config.maxRoster,
          `Roster must contain ${t.config.minRoster} to ${t.config.maxRoster} players.`,
        );
        t.registrations.push({ id: randomUUID(), team, status: "pending" });
        return;
      }
      if (action === "result" || action === "request-correction") {
        role(u, "scorer");
        assert(
          t.status === "published" || t.status === "completed",
          "Fixtures must be published first.",
        );
        const data = (
          action === "result"
            ? scoreSchema.strict()
            : scoreSchema
                .extend({ reason: z.string().trim().min(10).max(500) })
                .strict()
        ).parse(input);
        const m = t.matches.find((x) => x.id === data.matchId);
        assert(m, "Match not found.");
        if (m.scorerId !== u.id)
          throw new ForbiddenException(
            "Only the assigned scorer can submit this result.",
          );
        assert(
          m.slotId && m.venueId,
          "Schedule the match before entering a result.",
        );
        if (action === "result") {
          const count = t.matches.length;
          saveResult(t, data.matchId, data);
          if (t.matches.length > count) return { unplaced: schedule(t) };
          return;
        }
        assert(
          m.status === "final" && m.version === data.version,
          "Refresh the submitted match before requesting a correction.",
        );
        assert(
          !t.corrections.some(
            (c) => c.matchId === m.id && c.status === "pending",
          ),
          "A correction is already pending.",
        );
        t.corrections.push({
          ...data,
          reason: (data as any).reason,
          id: randomUUID(),
          requestedBy: u.id,
          status: "pending",
        });
        return;
      }
      this.owner(t, u);
      if (action === "decide-registration") {
        const data = z
          .object({
            registrationId: z.string().uuid(),
            decision: z.enum(["approved", "rejected"]),
          })
          .strict()
          .parse(input);
        assert(
          t.status === "registration",
          "Registrations are locked after the draw.",
        );
        const r = t.registrations.find((x) => x.id === data.registrationId);
        assert(r, "Registration not found.");
        if (data.decision === "approved")
          assert(
            t.registrations.filter(
              (x) => x.status === "approved" && x.id !== r.id,
            ).length < t.config.maxTeams,
            "Tournament capacity is full.",
          );
        r.status = data.decision;
        r.decidedBy = u.id;
        r.decisionAt = new Date().toISOString();
        return;
      }
      if (action === "venue") {
        const data = z
          .object({ name: z.string().trim().min(2).max(80) })
          .strict()
          .parse(input);
        assert(
          !t.venues.some(
            (v) => v.name.toLowerCase() === data.name.toLowerCase(),
          ),
          "Venue name already exists.",
        );
        t.venues.push({ id: randomUUID(), name: data.name });
        return;
      }
      if (action === "slot") {
        const data = z.object({ start: date, end: date }).strict().parse(input);
        assert(
          Date.parse(data.end) > Date.parse(data.start) &&
            Date.parse(data.end) - Date.parse(data.start) <= 24 * 3600000,
          "A slot must be positive and no longer than 24 hours.",
        );
        assert(
          Date.parse(data.start) >= Date.parse(t.config.startDate) &&
            Date.parse(data.end) <= Date.parse(t.config.endDate),
          "The slot must be inside tournament dates.",
        );
        assert(
          !t.slots.some((s) => s.start === data.start && s.end === data.end),
          "This slot already exists.",
        );
        t.slots.push({ id: randomUUID(), ...data });
        return;
      }
      if (action === "generate") {
        const data = z
          .object({
            method: z.enum(["random", "manual"]),
            seed: z.string().min(1).max(100).optional(),
            order: z.array(z.string().uuid()).max(32).optional(),
          })
          .strict()
          .parse(input);
        assert(
          t.status === "registration" || t.status === "draft",
          "Published draws cannot be regenerated.",
        );
        const ids = t.registrations
          .filter((r) => r.status === "approved")
          .map((r) => r.team.id);
        if (data.method === "random") {
          t.drawSeed = data.seed || randomBytes(8).toString("hex");
          t.seedOrder = shuffled(ids, t.drawSeed);
        } else {
          assert(data.order, "Provide an ordered list of approved teams.");
          t.seedOrder = data.order;
          delete t.drawSeed;
        }
        t.matches = generate(t, t.seedOrder);
        t.status = "draft";
        t.corrections = [];
        return;
      }
      if (action === "schedule") {
        z.object({}).strict().parse(input);
        assert(
          t.status === "draft",
          "Automatic scheduling is available for draft fixtures.",
        );
        assert(
          t.venues.length && t.slots.length,
          "Add venues and time slots first.",
        );
        return { unplaced: schedule(t) };
      }
      if (action === "reschedule") {
        const data = z
          .object({
            matchId: z.string(),
            venueId: z.string().uuid(),
            slotId: z.string().uuid(),
            version: z.number().int(),
          })
          .strict()
          .parse(input);
        const m = t.matches.find((x) => x.id === data.matchId);
        assert(m, "Match not found.");
        assert(
          m.status === "scheduled" && m.version === data.version,
          "Only an unchanged, unplayed match can be rescheduled.",
        );
        const error = placementError(
          m,
          data.venueId,
          data.slotId,
          t.matches,
          t.venues,
          t.slots,
          t.config.restMinutes,
        );
        assert(!error, error || "Schedule conflict.");
        m.venueId = data.venueId;
        m.slotId = data.slotId;
        m.version++;
        return;
      }
      if (action === "assign-scorer") {
        const data = z
          .object({
            matchId: z.string(),
            scorerId: z.string().uuid(),
            version: z.number().int(),
          })
          .strict()
          .parse(input);
        const m = t.matches.find((x) => x.id === data.matchId);
        assert(m && m.status === "scheduled", "Choose an unplayed match.");
        assert(m.version === data.version, "The match changed. Refresh first.");
        const scorer = (
          await sql.query(
            "SELECT id FROM arenix.users WHERE id=$1 AND role='scorer' AND active=true",
            [data.scorerId],
          )
        ).rows[0];
        assert(scorer, "Choose an active scorer.");
        m.scorerId = data.scorerId;
        m.version++;
        return;
      }
      if (action === "publish") {
        z.object({}).strict().parse(input);
        assert(
          t.status === "draft" && t.matches.length > 0,
          "Generate draft fixtures first.",
        );
        for (const m of t.matches.filter((x) => x.status !== "bye")) {
          assert(
            m.slotId && m.venueId,
            "Schedule every match before publishing.",
          );
          const error = placementError(
            m,
            m.venueId,
            m.slotId,
            t.matches,
            t.venues,
            t.slots,
            t.config.restMinutes,
          );
          assert(!error, error || "Schedule conflict.");
        }
        t.status = "published";
        return;
      }
      if (action === "decide-correction") {
        const data = z
          .object({
            correctionId: z.string().uuid(),
            decision: z.enum(["approved", "rejected"]),
          })
          .strict()
          .parse(input);
        const c = t.corrections.find((x) => x.id === data.correctionId);
        assert(c && c.status === "pending", "Pending correction not found.");
        if (data.decision === "approved") saveResult(t, c.matchId, c, true);
        c.status = data.decision;
        return;
      }
      assert(false, "Unknown action.");
    });
    return {
      tournament: {
        ...this.visible(result.tournament, u),
        standings: tables(result.tournament),
      },
      result: result.result,
    };
  }
  async publicList() {
    return (await this.repo.list())
      .filter((t) => t.status !== "draft")
      .map((t) => ({
        id: t.id,
        slug: t.slug,
        config: t.config,
        status: t.status,
        teams: t.registrations.filter((r) => r.status === "approved").length,
        matches: t.matches.length,
      }));
  }
  async publicDetail(id: string) {
    const t = await this.repo.get(id);
    if (t.status === "draft") throw new NotFoundException();
    return publicTournament(t);
  }
  async users(u: User) {
    role(u, "admin");
    return (
      await this.repo.db.query(
        "SELECT * FROM arenix.users ORDER BY created_at DESC",
      )
    ).rows.map(identity);
  }
  async scorers(u: User) {
    role(u, "organizer", "admin");
    return (
      await this.repo.db.query(
        "SELECT id,name FROM arenix.users WHERE role='scorer' AND active=true ORDER BY name",
      )
    ).rows;
  }
  async active(id: string, body: unknown, u: User) {
    role(u, "admin");
    const { active } = z.object({ active: z.boolean() }).strict().parse(body);
    assert(id !== u.id, "You cannot deactivate your own admin account.");
    await this.repo.db.transaction(async (sql) => {
      const row = (
        await sql.query(
          "UPDATE arenix.users SET active=$2,session_version=session_version+1 WHERE id::text=$1 RETURNING id",
          [id, active],
        )
      ).rows[0];
      if (!row) throw new NotFoundException();
      await audit(
        sql,
        u.id,
        null,
        active ? "account.reactivated" : "account.deactivated",
        { userId: id },
      );
    });
    return { active };
  }
}
