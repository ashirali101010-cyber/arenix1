import type {
  Match,
  Slot,
  Standing,
  Team,
  Tournament,
  Venue,
} from "./types.js";

export class RuleError extends Error {}
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RuleError(message);
}
const blank = (
  id: string,
  round: number,
  stage: Match["stage"],
  homeId: string | null,
  awayId: string | null,
  group?: string,
): Match => ({
  id,
  round,
  stage,
  homeId,
  awayId,
  group,
  status: "scheduled",
  homeScore: null,
  awayScore: null,
  winnerId: null,
  version: 0,
});

export function shuffled<T>(items: T[], seed: string): T[] {
  let state = 2166136261;
  for (const ch of seed) state = Math.imul(state ^ ch.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = Math.floor((state / 4294967296) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function roundRobin(ids: string[], group?: string): Match[] {
  assert(ids.length >= 2, "At least two teams are required.");
  const ring: (string | null)[] = [...ids];
  if (ring.length % 2) ring.push(null);
  const matches: Match[] = [];
  for (let round = 1; round < ring.length; round++) {
    for (let i = 0; i < ring.length / 2; i++) {
      const a = ring[i],
        b = ring[ring.length - 1 - i];
      if (a && b)
        matches.push(
          blank(
            `${group || "league"}-r${round}-m${i + 1}`,
            round,
            group ? "group" : "league",
            round % 2 ? a : b,
            round % 2 ? b : a,
            group,
          ),
        );
    }
    ring.splice(1, 0, ring.pop()!);
  }
  return matches;
}

export function knockout(ids: string[], prefix = "ko"): Match[] {
  assert(ids.length >= 2, "At least two teams are required.");
  const size = 2 ** Math.ceil(Math.log2(ids.length));
  let seeds = [1, 2];
  while (seeds.length < size) {
    const sum = seeds.length * 2 + 1;
    seeds = seeds.flatMap((s) => [s, sum - s]);
  }
  const matches: Match[] = [];
  for (let round = 1, count = size / 2; count >= 1; round++, count /= 2) {
    for (let i = 0; i < count; i++) {
      const m = blank(
        `${prefix}-r${round}-m${i + 1}`,
        round,
        "knockout",
        round === 1 ? ids[seeds[i * 2] - 1] || null : null,
        round === 1 ? ids[seeds[i * 2 + 1] - 1] || null : null,
      );
      if (round > 1) {
        m.homeFrom = `${prefix}-r${round - 1}-m${i * 2 + 1}`;
        m.awayFrom = `${prefix}-r${round - 1}-m${i * 2 + 2}`;
      }
      if (count > 1) {
        m.nextMatchId = `${prefix}-r${round + 1}-m${Math.floor(i / 2) + 1}`;
        m.nextSide = i % 2 ? "awayId" : "homeId";
      }
      if (round === 1 && (!m.homeId || !m.awayId)) {
        m.status = "bye";
        m.winnerId = m.homeId || m.awayId;
      }
      matches.push(m);
    }
  }
  advance(matches);
  return matches;
}

export function advance(matches: Match[]) {
  for (const m of matches)
    if (
      (m.status === "final" || m.status === "bye") &&
      m.nextMatchId &&
      m.nextSide
    ) {
      const next = matches.find((x) => x.id === m.nextMatchId)!;
      if (next[m.nextSide] !== m.winnerId) {
        next[m.nextSide] = m.winnerId;
        next.version++;
      }
    }
}

export function generate(t: Tournament, order: string[]): Match[] {
  const approved = t.registrations
    .filter((r) => r.status === "approved")
    .map((r) => r.team.id);
  assert(
    approved.length >= 4,
    "Approve at least four teams before generating fixtures.",
  );
  assert(
    order.length === approved.length &&
      new Set(order).size === order.length &&
      order.every((id) => approved.includes(id)),
    "Seed order must include every approved team exactly once.",
  );
  if (t.config.format === "round_robin") return roundRobin(order);
  if (t.config.format === "knockout") return knockout(order);
  const count = t.config.groupCount;
  assert(
    [2, 4, 8, 16].includes(count) && count * 2 <= order.length,
    "Use 2, 4, 8, or 16 groups with at least two teams per group.",
  );
  const groups: string[][] = Array.from({ length: count }, () => []);
  order.forEach((id, i) => {
    const row = Math.floor(i / count);
    groups[row % 2 ? count - 1 - (i % count) : i % count].push(id);
  });
  return groups.flatMap((g, i) => roundRobin(g, String.fromCharCode(65 + i)));
}

const slotTimes = new WeakMap<
  Slot,
  { sourceStart: string; sourceEnd: string; start: number; end: number }
>();
function times(slot: Slot) {
  let parsed = slotTimes.get(slot);
  if (
    !parsed ||
    parsed.sourceStart !== slot.start ||
    parsed.sourceEnd !== slot.end
  ) {
    parsed = {
      sourceStart: slot.start,
      sourceEnd: slot.end,
      start: Date.parse(slot.start),
      end: Date.parse(slot.end),
    };
    slotTimes.set(slot, parsed);
  }
  return parsed;
}
const overlaps = (a: Slot, b: Slot, gap = 0) =>
  times(a).start < times(b).end + gap * 60000 &&
  times(b).start < times(a).end + gap * 60000;
export function participants(
  m: Match,
  matches: Match[],
  seen = new Set<string>(),
): Set<string> {
  if (seen.has(m.id)) return new Set();
  seen.add(m.id);
  const ids = new Set([m.homeId, m.awayId].filter(Boolean) as string[]);
  for (const source of [m.homeFrom, m.awayFrom]) {
    const prev = matches.find((x) => x.id === source);
    if (prev) for (const id of participants(prev, matches, seen)) ids.add(id);
  }
  return ids;
}
export function placementError(
  match: Match,
  venueId: string,
  slotId: string,
  matches: Match[],
  venues: Venue[],
  slots: Slot[],
  gap: number,
): string | null {
  const slot = slots.find((s) => s.id === slotId);
  if (!slot || !venues.some((v) => v.id === venueId))
    return "Choose an existing venue and time slot.";
  const people = participants(match, matches);
  for (const other of matches) {
    if (other.id === match.id || other.status === "bye" || !other.slotId)
      continue;
    const occupied = slots.find((s) => s.id === other.slotId)!;
    if (other.venueId === venueId && overlaps(slot, occupied))
      return "The venue is already booked during this time.";
    const shared = [...participants(other, matches)].some((id) =>
      people.has(id),
    );
    if (shared && overlaps(slot, occupied, gap))
      return "A team overlaps another match or needs more rest.";
    if (
      [match.homeFrom, match.awayFrom].includes(other.id) &&
      Date.parse(slot.start) < Date.parse(occupied.end) + gap * 60000
    )
      return "A knockout round must follow its feeder match and rest period.";
    if (
      [other.homeFrom, other.awayFrom].includes(match.id) &&
      Date.parse(occupied.start) < Date.parse(slot.end) + gap * 60000
    )
      return "A feeder match must finish before its next round and rest period.";
  }
  return null;
}

export function schedule(t: Tournament): string[] {
  const slots = [...t.slots].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  );
  for (const m of t.matches)
    if (m.status !== "final") {
      delete m.venueId;
      delete m.slotId;
    }
  const unplaced: string[] = [];
  type Range = { start: number; end: number };
  const ranges = new Map(t.slots.map((s) => [s.id, times(s)]));
  const collides = (a: Range, b: Range, gap = 0) =>
    a.start < b.end + gap && b.start < a.end + gap;
  const venueBusy = new Map<string, Range[]>(),
    teamBusy = new Map<string, Range[]>();
  const people = new Map(
    t.matches.map((m) => [m.id, [...participants(m, t.matches)]]),
  );
  const reserve = (m: Match, slot: Slot) => {
    const range = ranges.get(slot.id)!;
    venueBusy.set(m.venueId!, [...(venueBusy.get(m.venueId!) || []), range]);
    for (const id of people.get(m.id)!)
      teamBusy.set(id, [...(teamBusy.get(id) || []), range]);
  };
  for (const m of t.matches)
    if (m.status === "final" && m.slotId)
      reserve(
        m,
        t.slots.find((s) => s.id === m.slotId)!,
      );
  for (const m of t.matches) {
    if (m.status === "bye" || m.status === "final") continue;
    const dependencies = [m.homeFrom, m.awayFrom].filter(Boolean);
    if (
      dependencies.some((id) => {
        const x = t.matches.find((p) => p.id === id)!;
        return x.status !== "bye" && !x.slotId;
      })
    ) {
      unplaced.push(m.id);
      continue;
    }
    const earliest = Math.max(
      0,
      ...dependencies.map((id) => {
        const prev = t.matches.find((p) => p.id === id)!;
        return prev.status === "bye"
          ? 0
          : Date.parse(t.slots.find((s) => s.id === prev.slotId)!.end) +
              t.config.restMinutes * 60000;
      }),
    );
    let found = false;
    for (const slot of slots) {
      const range = ranges.get(slot.id)!;
      if (
        range.start < earliest ||
        people
          .get(m.id)!
          .some((id) =>
            teamBusy
              .get(id)
              ?.some((busy) =>
                collides(range, busy, t.config.restMinutes * 60000),
              ),
          )
      )
        continue;
      for (const v of t.venues)
        if (!venueBusy.get(v.id)?.some((busy) => collides(range, busy))) {
          m.venueId = v.id;
          m.slotId = slot.id;
          reserve(m, slot);
          found = true;
          break;
        }
      if (found) break;
    }
    if (!found) unplaced.push(m.id);
  }
  return unplaced;
}

export function standings(ids: string[], matches: Match[]): Standing[] {
  const table = new Map(
    ids.map((teamId) => [
      teamId,
      {
        teamId,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        difference: 0,
        points: 0,
        rank: 0,
      },
    ]),
  );
  const finals = matches.filter(
    (m) => m.status === "final" && table.has(m.homeId!) && table.has(m.awayId!),
  );
  for (const m of finals) {
    const h = table.get(m.homeId!)!,
      a = table.get(m.awayId!)!;
    h.played++;
    a.played++;
    h.goalsFor += m.homeScore!;
    h.goalsAgainst += m.awayScore!;
    a.goalsFor += m.awayScore!;
    a.goalsAgainst += m.homeScore!;
    if (m.homeScore! > m.awayScore!) {
      h.won++;
      h.points += 3;
      a.lost++;
    } else if (m.homeScore! < m.awayScore!) {
      a.won++;
      a.points += 3;
      h.lost++;
    } else {
      h.drawn++;
      a.drawn++;
      h.points++;
      a.points++;
    }
  }
  const rows = [...table.values()];
  rows.forEach((r) => (r.difference = r.goalsFor - r.goalsAgainst));
  const basic = (a: Standing, b: Standing) =>
    b.points - a.points ||
    b.difference - a.difference ||
    b.goalsFor - a.goalsFor;
  rows.sort(basic);
  for (let i = 0; i < rows.length;) {
    let end = i + 1;
    while (end < rows.length && basic(rows[i], rows[end]) === 0) end++;
    if (end - i > 1) {
      const tied = rows.slice(i, end),
        mini = new Map(tied.map((r) => [r.teamId, { p: 0, d: 0, f: 0 }]));
      for (const m of finals)
        if (mini.has(m.homeId!) && mini.has(m.awayId!)) {
          const h = mini.get(m.homeId!)!,
            a = mini.get(m.awayId!)!,
            hs = m.homeScore!,
            as = m.awayScore!;
          h.p += hs > as ? 3 : hs === as ? 1 : 0;
          a.p += as > hs ? 3 : hs === as ? 1 : 0;
          h.d += hs - as;
          a.d += as - hs;
          h.f += hs;
          a.f += as;
        }
      tied.sort((a, b) => {
        const x = mini.get(a.teamId)!,
          y = mini.get(b.teamId)!;
        return (
          y.p - x.p ||
          y.d - x.d ||
          y.f - x.f ||
          a.teamId.localeCompare(b.teamId)
        );
      });
      rows.splice(i, tied.length, ...tied);
    }
    i = end;
  }
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export function tables(t: Tournament): Record<string, Standing[]> {
  if (t.config.format !== "groups")
    return {
      Overall: standings(
        t.seedOrder,
        t.matches.filter((m) => m.stage === "league"),
      ),
    };
  const groups = [
    ...new Set(
      t.matches.filter((m) => m.stage === "group").map((m) => m.group!),
    ),
  ].sort();
  return Object.fromEntries(
    groups.map((g) => {
      const ms = t.matches.filter((m) => m.group === g);
      const ids = [...new Set(ms.flatMap((m) => [m.homeId!, m.awayId!]))];
      return [`Group ${g}`, standings(ids, ms)];
    }),
  );
}

export function qualify(t: Tournament) {
  if (
    t.config.format !== "groups" ||
    t.matches.some((m) => m.stage === "knockout")
  )
    return;
  const groups = t.matches.filter((m) => m.stage === "group");
  if (!groups.length || groups.some((m) => m.status !== "final")) return;
  const ranking = Object.values(tables(t));
  // Pair A1 with B2, B1 with A2, C1 with D2, D1 with C2, etc.
  const pairs: string[] = [];
  for (let i = 0; i < ranking.length; i += 2)
    pairs.push(
      ranking[i][0].teamId,
      ranking[i + 1][1].teamId,
      ranking[i + 1][0].teamId,
      ranking[i][1].teamId,
    );
  const ko = knockout(pairs, "finals");
  // Replace seeded first-round pairings with the explicit cross-group draw.
  ko.filter((m) => m.round === 1).forEach((m, i) => {
    m.homeId = pairs[i * 2];
    m.awayId = pairs[i * 2 + 1];
  });
  t.matches.push(...ko);
}

export function saveResult(
  t: Tournament,
  matchId: string,
  result: {
    homeScore: number;
    awayScore: number;
    penaltyHome?: number;
    penaltyAway?: number;
    version: number;
  },
  correction = false,
) {
  const m = t.matches.find((x) => x.id === matchId);
  assert(m, "Match not found.");
  assert(
    m.version === result.version,
    "This match changed. Refresh before saving.",
  );
  assert(
    m.homeId && m.awayId && m.status !== "bye",
    "Both teams must be known before entering a result.",
  );
  assert(
    correction || m.status !== "final",
    "Submitted results require an approved correction.",
  );
  for (const score of [result.homeScore, result.awayScore])
    assert(
      Number.isInteger(score) && score >= 0 && score <= 99,
      "Scores must be whole numbers from 0 to 99.",
    );
  if (correction) {
    if (m.stage === "group")
      assert(
        !t.matches.some((x) => x.stage === "knockout"),
        "Group results are locked after knockout qualification.",
      );
    let next = t.matches.find((x) => x.id === m.nextMatchId);
    while (next) {
      assert(
        next.status !== "final",
        "A later round already has a result. Reverse it through an administrative review before correcting this match.",
      );
      next = t.matches.find((x) => x.id === next!.nextMatchId);
    }
  }
  if (m.stage === "knockout" && result.homeScore === result.awayScore) {
    assert(
      Number.isInteger(result.penaltyHome) &&
        Number.isInteger(result.penaltyAway) &&
        result.penaltyHome! >= 0 &&
        result.penaltyAway! >= 0 &&
        result.penaltyHome! <= 99 &&
        result.penaltyAway! <= 99 &&
        result.penaltyHome !== result.penaltyAway,
      "A drawn knockout needs a decisive penalty shootout.",
    );
    m.winnerId =
      result.penaltyHome! > result.penaltyAway! ? m.homeId : m.awayId;
    m.penaltyHome = result.penaltyHome;
    m.penaltyAway = result.penaltyAway;
  } else {
    m.winnerId =
      result.homeScore > result.awayScore
        ? m.homeId
        : result.homeScore < result.awayScore
          ? m.awayId
          : null;
    delete m.penaltyHome;
    delete m.penaltyAway;
  }
  m.homeScore = result.homeScore;
  m.awayScore = result.awayScore;
  m.status = "final";
  m.version++;
  advance(t.matches);
  qualify(t);
  const finals = t.matches.filter((x) => x.stage === "knockout");
  t.status = finals.length
    ? finals.every((x) => x.status === "final" || x.status === "bye")
      ? "completed"
      : "published"
    : t.matches.every((x) => x.status === "final")
      ? "completed"
      : "published";
}

export function publicTournament(t: Tournament) {
  return {
    ...t,
    matches: t.matches.map(({ scorerId, ...match }) => match),
    corrections: [],
    registrations: t.registrations
      .filter((r) => r.status === "approved")
      .map((r) => ({
        id: r.id,
        status: r.status,
        team: {
          id: r.team.id,
          name: r.team.name,
          shortName: r.team.shortName,
          color: r.team.color,
          managerId: "",
          roster: [],
        },
      })),
    organizerId: "",
    standings: tables(t),
  };
}
