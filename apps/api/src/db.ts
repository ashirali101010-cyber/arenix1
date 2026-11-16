import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { NotFoundException } from "@nestjs/common";
import type { Audit, Team, Tournament } from "../../../packages/core/types.js";
import { connectionOptions } from "./db-config.js";

export interface Sql {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: any[]; rowCount?: number | null }>;
}
export interface Database extends Sql {
  transaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export function database(): Database {
  const pool = new Pool(connectionOptions());
  return {
    query: (sql, params) => pool.query(sql, params),
    transaction: async (fn) => {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const result = await fn(c);
        await c.query("COMMIT");
        return result;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    },
    close: () => pool.end(),
  };
}
export async function audit(
  sql: Sql,
  actorId: string,
  tournamentId: string | null,
  action: string,
  details: unknown,
) {
  await sql.query(
    "INSERT INTO arenix.audit(id,actor_id,tournament_id,action,details) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), actorId, tournamentId, action, JSON.stringify(details)],
  );
}
export class Repository {
  constructor(public db: Database) {}
  async list(): Promise<Tournament[]> {
    return (
      await this.db.query(
        "SELECT data FROM arenix.tournaments ORDER BY updated_at DESC",
      )
    ).rows.map((r) => r.data);
  }
  async get(id: string): Promise<Tournament> {
    const r = await this.db.query(
      "SELECT data FROM arenix.tournaments WHERE id::text=$1 OR slug=$1",
      [id],
    );
    if (!r.rows[0]) throw new NotFoundException("Tournament not found.");
    return r.rows[0].data;
  }
  async mutate<T>(
    id: string,
    actorId: string,
    action: string,
    fn: (t: Tournament, sql: Sql) => Promise<T> | T,
  ): Promise<{ tournament: Tournament; result: T }> {
    return this.db.transaction(async (sql) => {
      const r = await sql.query(
        "SELECT data FROM arenix.tournaments WHERE id::text=$1 FOR UPDATE",
        [id],
      );
      if (!r.rows[0]) throw new NotFoundException("Tournament not found.");
      const t: Tournament = r.rows[0].data;
      const before = JSON.parse(JSON.stringify(t));
      const result = await fn(t, sql);
      await sql.query(
        "UPDATE arenix.tournaments SET data=$2,updated_at=now() WHERE id=$1",
        [id, JSON.stringify(t)],
      );
      await audit(sql, actorId, id, action, { before, after: t });
      return { tournament: t, result };
    });
  }
  async teams(managerId?: string): Promise<Team[]> {
    return (
      await this.db.query(
        `SELECT data FROM arenix.teams ${managerId ? "WHERE manager_id=$1" : ""} ORDER BY created_at DESC`,
        managerId ? [managerId] : [],
      )
    ).rows.map((r) => r.data);
  }
  async audits(id?: string): Promise<Audit[]> {
    return (
      await this.db.query(
        `SELECT a.id,a.tournament_id AS "tournamentId",a.actor_id AS "actorId",u.name AS "actorName",a.action,a.details,a.created_at AS "createdAt" FROM arenix.audit a JOIN arenix.users u ON u.id=a.actor_id ${id ? "WHERE a.tournament_id=$1" : ""} ORDER BY a.created_at DESC LIMIT 200`,
        id ? [id] : [],
      )
    ).rows;
  }
}
