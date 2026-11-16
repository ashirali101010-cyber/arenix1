import { describe, expect, it } from "vitest";
import {
  advance,
  generate,
  knockout,
  participants,
  placementError,
  publicTournament,
  qualify,
  roundRobin,
  saveResult,
  schedule,
  shuffled,
  standings,
  tables,
} from "../packages/core/engine.js";
import { tournament } from "./helpers.js";
import type { Match } from "../packages/core/types.js";

describe("fixture generation and scheduling", () => {
  it.each(Array.from({ length: 100 }, (_, i) => i))(
    "validates synthetic tournament %i across 4–32 teams and all formats",
    (trial) => {
      const n = 4 + (trial % 29),
        format = (["round_robin", "knockout", "groups"] as const)[trial % 3],
        t = tournament(n, format);
      t.matches = generate(t, t.seedOrder);
      expect(schedule(t)).toEqual([]);
      const pairs = new Set<string>();
      const resources = new Map<
        string,
        { start: number; end: number; gap: number }[]
      >();
      for (const m of t.matches) {
        if (m.stage !== "knockout") {
          const pair = [m.homeId, m.awayId].sort().join("|");
          expect(pairs.has(pair)).toBe(false);
          pairs.add(pair);
        }
        if (m.status !== "bye") {
          const slot = t.slots.find((s) => s.id === m.slotId)!;
          expect(slot).toBeDefined();
          for (const [key, gap] of [
            [`venue:${m.venueId}`, 0],
            ...[m.homeId, m.awayId]
              .filter(Boolean)
              .map((id) => [`team:${id}`, t.config.restMinutes * 60000]),
          ] as [string, number][]) {
            resources.set(key, [
              ...(resources.get(key) || []),
              { start: Date.parse(slot.start), end: Date.parse(slot.end), gap },
            ]);
          }
          for (const source of [m.homeFrom, m.awayFrom].filter(Boolean)) {
            const prev = t.matches.find((x) => x.id === source)!;
            if (prev.status !== "bye")
              expect(Date.parse(slot.start)).toBeGreaterThanOrEqual(
                Date.parse(t.slots.find((s) => s.id === prev.slotId)!.end) +
                  t.config.restMinutes * 60000,
              );
          }
        }
      }
      for (const times of resources.values()) {
        times.sort((a, b) => a.start - b.start);
        for (let i = 1; i < times.length; i++)
          expect(times[i].start).toBeGreaterThanOrEqual(
            times[i - 1].end + times[i].gap,
          );
      }
      if (format === "round_robin") expect(pairs.size).toBe((n * (n - 1)) / 2);
      if (format === "knockout") {
        expect(t.matches.length).toBe(2 ** Math.ceil(Math.log2(n)) - 1);
        const round1 = t.matches.filter((m) => m.round === 1),
          top = round1.find(
            (m) => m.homeId === t.seedOrder[0] || m.awayId === t.seedOrder[0],
          )!,
          second = round1.find(
            (m) => m.homeId === t.seedOrder[1] || m.awayId === t.seedOrder[1],
          )!;
        let a = top,
          b = second;
        while (
          a.nextMatchId &&
          b.nextMatchId &&
          a.nextMatchId !== b.nextMatchId
        ) {
          a = t.matches.find((m) => m.id === a.nextMatchId)!;
          b = t.matches.find((m) => m.id === b.nextMatchId)!;
        }
        expect(a.round).toBe(Math.ceil(Math.log2(n)) - 1);
      }
    },
    30000,
  );
  it("creates every pair exactly once for 4 through 32 teams", () => {
    for (let n = 4; n <= 32; n++) {
      const ids = Array.from({ length: n }, (_, i) => String(i)),
        ms = roundRobin(ids);
      expect(ms).toHaveLength((n * (n - 1)) / 2);
      for (const id of ids)
        expect(
          ms.filter((m) => m.homeId === id || m.awayId === id),
        ).toHaveLength(n - 1);
    }
  });
  it("reserves venues by real interval and rest for possible knockout participants", () => {
    const t = tournament(4, "knockout");
    t.matches = generate(t, t.seedOrder);
    schedule(t);
    const final = t.matches.at(-1)!;
    expect(participants(final, t.matches).size).toBe(4);
    const first = t.matches[0];
    expect(
      placementError(
        final,
        t.venues[1].id,
        first.slotId!,
        t.matches,
        t.venues,
        t.slots,
        60,
      ),
    ).toMatch(/team|round/i);
    expect(
      placementError(
        first,
        "missing",
        "missing",
        t.matches,
        t.venues,
        t.slots,
        60,
      ),
    ).toMatch(/existing/);
  });
  it("reports insufficient slots, leaves dependent rounds unplaced, and rejects clashes", () => {
    const t = tournament(8, "knockout");
    t.matches = generate(t, t.seedOrder);
    t.slots = t.slots.slice(0, 1);
    t.venues = t.venues.slice(0, 1);
    const unplaced = schedule(t);
    expect(unplaced.length).toBeGreaterThan(0);
    const first = t.matches[0],
      second = t.matches[1];
    expect(
      placementError(
        second,
        first.venueId!,
        first.slotId!,
        t.matches,
        t.venues,
        t.slots,
        60,
      ),
    ).toMatch(/venue/);
  });
  it("reproduces random draws and validates seed and group constraints", () => {
    expect(shuffled([1, 2, 3, 4, 5], "s")).toEqual(
      shuffled([1, 2, 3, 4, 5], "s"),
    );
    expect(shuffled([1, 2, 3, 4, 5], "s")).not.toEqual(
      shuffled([1, 2, 3, 4, 5], "different"),
    );
    const t = tournament();
    expect(() => generate(t, t.seedOrder.slice(1))).toThrow(/every/);
    t.config.format = "groups";
    t.config.groupCount = 3;
    expect(() => generate(t, t.seedOrder)).toThrow(/groups/);
    expect(() => roundRobin(["a"])).toThrow();
    expect(() => knockout(["a"])).toThrow();
    expect(() => generate(tournament(3), ["a"])).toThrow(/four/);
  });
  it("generates and schedules 32 teams within five seconds", () => {
    const t = tournament(32),
      start = performance.now();
    t.matches = generate(t, t.seedOrder);
    schedule(t);
    const ms = performance.now() - start;
    console.log(
      `32-team round robin: ${t.matches.length} matches generated and scheduled in ${ms.toFixed(1)} ms`,
    );
    expect(ms).toBeLessThan(5000);
  });
});
describe("results, standings, and advancement", () => {
  it("scores wins and draws and ranks score difference and goals for", () => {
    const t = tournament(4);
    t.matches = generate(t, t.seedOrder);
    for (const m of t.matches)
      saveResult(t, m.id, { homeScore: 2, awayScore: 1, version: m.version });
    const rows = tables(t).Overall;
    expect(rows.reduce((n, r) => n + r.played, 0)).toBe(12);
    expect(rows.reduce((n, r) => n + r.points, 0)).toBe(18);
    expect(t.status).toBe("completed");
    const m = t.matches[0];
    saveResult(
      t,
      m.id,
      { homeScore: 1, awayScore: 1, version: m.version },
      true,
    );
    expect(tables(t).Overall.reduce((n, r) => n + r.drawn, 0)).toBe(2);
  });
  it("uses head-to-head mini tables for exact ties and a stable fallback", () => {
    const m = (
      id: string,
      h: string,
      a: string,
      hs: number,
      as: number,
    ): Match => ({
      id,
      homeId: h,
      awayId: a,
      round: 1,
      stage: "league",
      status: "final",
      homeScore: hs,
      awayScore: as,
      winnerId: hs > as ? h : a,
      version: 1,
    });
    const ms = [
      m("1", "a", "b", 1, 0),
      m("2", "a", "c", 0, 1),
      m("3", "b", "c", 1, 0),
    ];
    expect(standings(["c", "b", "a"], ms).map((r) => r.teamId)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(standings(["z", "a"], []).map((r) => r.teamId)).toEqual(["a", "z"]);
  });
  it("requires decisive penalties for knockout draws, rejects stale saves, and advances byes", () => {
    const t = tournament(5, "knockout");
    t.matches = generate(t, t.seedOrder);
    expect(t.matches.filter((m) => m.status === "bye")).toHaveLength(3);
    const m = t.matches.find(
      (m) => m.homeId && m.awayId && m.status !== "bye",
    )!;
    expect(() =>
      saveResult(t, m.id, { homeScore: 1, awayScore: 1, version: m.version }),
    ).toThrow(/penalty/);
    const old = m.version;
    saveResult(t, m.id, {
      homeScore: 1,
      awayScore: 1,
      penaltyHome: 3,
      penaltyAway: 4,
      version: m.version,
    });
    expect(m.winnerId).toBe(m.awayId);
    expect(t.matches.find((x) => x.id === m.nextMatchId)![m.nextSide!]).toBe(
      m.awayId,
    );
    expect(() =>
      saveResult(t, m.id, { homeScore: 0, awayScore: 2, version: old }),
    ).toThrow(/changed/);
    expect(() =>
      saveResult(t, m.id, { homeScore: 0, awayScore: 2, version: m.version }),
    ).toThrow(/correction/);
  });
  it("qualifies group winners into cross-group knockout and finishes the tournament", () => {
    const t = tournament(8, "groups");
    t.config.groupCount = 2;
    t.matches = generate(t, t.seedOrder);
    for (const m of [...t.matches])
      saveResult(t, m.id, { homeScore: 2, awayScore: 1, version: m.version });
    const ranking = tables(t),
      ko = t.matches.filter((m) => m.stage === "knockout");
    expect(ko).toHaveLength(3);
    expect(ko[0].homeId).toBe(ranking["Group A"][0].teamId);
    expect(ko[0].awayId).toBe(ranking["Group B"][1].teamId);
    for (const m of ko)
      saveResult(t, m.id, { homeScore: 1, awayScore: 0, version: m.version });
    expect(t.status).toBe("completed");
    expect(() =>
      saveResult(
        t,
        t.matches[0].id,
        { homeScore: 4, awayScore: 0, version: t.matches[0].version },
        true,
      ),
    ).toThrow(/locked/);
  });
  it("preserves finalized schedules, rejects negative scores and protects downstream results", () => {
    const t = tournament(4, "knockout");
    t.matches = generate(t, t.seedOrder);
    schedule(t);
    const m = t.matches[0],
      slot = m.slotId;
    expect(() =>
      saveResult(t, "none", { homeScore: 0, awayScore: 0, version: 0 }),
    ).toThrow(/not found/);
    expect(() =>
      saveResult(t, m.id, { homeScore: -1, awayScore: 0, version: m.version }),
    ).toThrow(/whole/);
    for (const match of t.matches)
      saveResult(t, match.id, {
        homeScore: 3,
        awayScore: 0,
        version: match.version,
      });
    expect(() =>
      saveResult(
        t,
        m.id,
        { homeScore: 0, awayScore: 3, version: m.version },
        true,
      ),
    ).toThrow(/later round/);
    schedule(t);
    expect(m.slotId).toBe(slot);
    const pub = publicTournament(t);
    expect(pub.organizerId).toBe("");
    expect(
      pub.registrations.every(
        (r) => !r.team.managerId && !r.team.roster.length,
      ),
    ).toBe(true);
  });
  it("corrects a knockout before the next result, clears old penalties, and handles unready matches", () => {
    const t = tournament(4, "knockout");
    t.matches = generate(t, t.seedOrder);
    const m = t.matches[0],
      final = t.matches.at(-1)!;
    expect(() =>
      saveResult(t, final.id, {
        homeScore: 1,
        awayScore: 0,
        version: final.version,
      }),
    ).toThrow(/Both/);
    saveResult(t, m.id, {
      homeScore: 1,
      awayScore: 1,
      penaltyHome: 5,
      penaltyAway: 3,
      version: m.version,
    });
    saveResult(
      t,
      m.id,
      { homeScore: 0, awayScore: 1, version: m.version },
      true,
    );
    expect(m.penaltyHome).toBeUndefined();
    expect(final.homeId).toBe(m.awayId);
  });
});
