export type Role = "admin" | "organizer" | "manager" | "scorer";
export type Format = "round_robin" | "knockout" | "groups";
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  sessionVersion: number;
}
export interface Player {
  name: string;
  number: number;
}
export interface Team {
  id: string;
  name: string;
  shortName: string;
  color: string;
  managerId: string;
  roster: Player[];
}
export interface Registration {
  id: string;
  team: Team;
  status: "pending" | "approved" | "rejected";
  decisionAt?: string;
  decidedBy?: string;
}
export interface Venue {
  id: string;
  name: string;
}
export interface Slot {
  id: string;
  start: string;
  end: string;
}
export interface Match {
  id: string;
  round: number;
  stage: "league" | "group" | "knockout";
  group?: string;
  homeId: string | null;
  awayId: string | null;
  homeFrom?: string;
  awayFrom?: string;
  nextMatchId?: string;
  nextSide?: "homeId" | "awayId";
  status: "scheduled" | "final" | "bye";
  homeScore: number | null;
  awayScore: number | null;
  penaltyHome?: number;
  penaltyAway?: number;
  winnerId: string | null;
  scorerId?: string;
  venueId?: string;
  slotId?: string;
  version: number;
}
export interface TournamentConfig {
  name: string;
  sport: "football" | "futsal";
  format: Format;
  startDate: string;
  endDate: string;
  deadline: string;
  maxTeams: number;
  minRoster: number;
  maxRoster: number;
  restMinutes: number;
  groupCount: number;
  description: string;
}
export interface Correction {
  id: string;
  matchId: string;
  requestedBy: string;
  reason: string;
  homeScore: number;
  awayScore: number;
  penaltyHome?: number;
  penaltyAway?: number;
  version: number;
  status: "pending" | "approved" | "rejected";
}
export interface Tournament {
  id: string;
  organizerId: string;
  slug: string;
  config: TournamentConfig;
  status: "registration" | "draft" | "published" | "completed";
  venues: Venue[];
  slots: Slot[];
  registrations: Registration[];
  matches: Match[];
  drawSeed?: string;
  seedOrder: string[];
  corrections: Correction[];
  createdAt: string;
}
export interface Standing {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  difference: number;
  points: number;
  rank: number;
}
export interface Audit {
  id: string;
  tournamentId: string | null;
  actorId: string;
  actorName?: string;
  action: string;
  details: unknown;
  createdAt: string;
}
