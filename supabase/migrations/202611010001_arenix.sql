CREATE SCHEMA IF NOT EXISTS arenix;
REVOKE ALL ON SCHEMA arenix FROM PUBLIC;

CREATE TABLE IF NOT EXISTS arenix.users (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','organizer','manager','scorer')),
  active boolean NOT NULL DEFAULT true,
  session_version integer NOT NULL DEFAULT 0,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS arenix.teams (
  id uuid PRIMARY KEY,
  manager_id uuid NOT NULL REFERENCES arenix.users(id),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS teams_manager_idx ON arenix.teams(manager_id);
CREATE TABLE IF NOT EXISTS arenix.tournaments (
  id uuid PRIMARY KEY,
  organizer_id uuid NOT NULL REFERENCES arenix.users(id),
  slug text NOT NULL UNIQUE,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tournaments_organizer_idx ON arenix.tournaments(organizer_id);
CREATE TABLE IF NOT EXISTS arenix.audit (
  id uuid PRIMARY KEY,
  tournament_id uuid REFERENCES arenix.tournaments(id),
  actor_id uuid NOT NULL REFERENCES arenix.users(id),
  action text NOT NULL,
  details jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_tournament_time_idx ON arenix.audit(tournament_id, created_at DESC);
ALTER TABLE arenix.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE arenix.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE arenix.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE arenix.audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA arenix FROM PUBLIC;
-- No browser policies: all database access goes through the NestJS API.
-- Production should use a dedicated backend-only login with grants on this schema.
-- The schema owner bypasses RLS; Nest enforces role/ownership rules.
