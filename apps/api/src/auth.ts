import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Database, Sql } from "./db.js";
import { audit } from "./db.js";
import type { Role, User } from "../../../packages/core/types.js";
export const identity = (r: any): User => ({
  id: r.id,
  email: r.email,
  name: r.name,
  role: r.role,
  active: r.active,
  sessionVersion: r.session_version,
});
export const signupSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z
      .string()
      .trim()
      .email()
      .max(200)
      .transform((v) => v.toLowerCase()),
    password: z
      .string()
      .min(8)
      .max(72)
      .refine(
        (s) => Buffer.byteLength(s, "utf8") <= 72,
        "Password must be at most 72 UTF-8 bytes.",
      ),
    role: z.enum(["organizer", "manager", "scorer"]),
  })
  .strict();
export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .transform((v) => v.toLowerCase()),
    password: z.string().min(1).max(200),
  })
  .strict();
export class Auth {
  secret: string;
  private dummyHash = bcrypt.hashSync("not-a-valid-account-password", 12);
  private limits = new Map<string, { count: number; until: number }>();
  constructor(public db: Database) {
    this.secret = process.env.JWT_SECRET || "";
    if (this.secret.length < 32 || this.secret.startsWith("replace-"))
      throw new Error("Set JWT_SECRET to at least 32 random characters.");
  }
  throttle(ip: string) {
    const now = Date.now();
    for (const [key, entry] of this.limits)
      if (entry.until < now) this.limits.delete(key);
    const current = this.limits.get(ip) || { count: 0, until: now + 60000 };
    current.count++;
    this.limits.set(ip, current);
    if (current.count > 20)
      throw new HttpException(
        "Too many authentication attempts. Try again in one minute.",
        429,
      );
  }
  async signup(body: unknown) {
    const input = signupSchema.parse(body),
      id = randomUUID(),
      hash = await bcrypt.hash(input.password, 12);
    try {
      await this.db.transaction(async (sql) => {
        await sql.query(
          "INSERT INTO arenix.users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)",
          [id, input.name, input.email, hash, input.role],
        );
        await audit(sql, id, null, "account.registered", { role: input.role });
      });
    } catch (e: any) {
      if (e.code === "23505")
        throw new BadRequestException("Unable to register this email address.");
      throw e;
    }
    return { message: "Account created. Sign in to continue." };
  }
  async login(body: unknown) {
    const input = loginSchema.parse(body);
    const result = await this.db.transaction(async (sql) => {
      const row = (
        await sql.query(
          "SELECT * FROM arenix.users WHERE email=$1 FOR UPDATE",
          [input.email],
        )
      ).rows[0];
      if (!row) {
        await bcrypt.compare(input.password, this.dummyHash);
        return { error: "Invalid email or password.", code: 401 };
      }
      if (row.locked_until && new Date(row.locked_until).getTime() > Date.now())
        return {
          error: "Account locked. Try again after 15 minutes.",
          code: 423,
        };
      const valid = await bcrypt.compare(input.password, row.password_hash);
      if (!valid) {
        const failed = row.locked_until ? 1 : row.failed_attempts + 1;
        await sql.query(
          "UPDATE arenix.users SET failed_attempts=$2,locked_until=CASE WHEN $2 >= 5 THEN now()+interval '15 minutes' ELSE NULL END WHERE id=$1",
          [row.id, failed],
        );
        return {
          error:
            failed >= 5
              ? "Account locked. Try again after 15 minutes."
              : "Invalid email or password.",
          code: failed >= 5 ? 423 : 401,
        };
      }
      if (!row.active)
        return { error: "This account is deactivated.", code: 403 };
      await sql.query(
        "UPDATE arenix.users SET failed_attempts=0,locked_until=NULL WHERE id=$1",
        [row.id],
      );
      return { user: identity(row) };
    });
    if (result.error) throw new HttpException(result.error, result.code!);
    const user = result.user!;
    const token = jwt.sign(
      { sub: user.id, sv: user.sessionVersion },
      this.secret,
      {
        expiresIn: "30m",
        algorithm: "HS256",
        issuer: "arenix",
        audience: "arenix-web",
      },
    );
    return { token, user };
  }
  async user(token?: string): Promise<User> {
    if (!token) throw new UnauthorizedException("Please sign in.");
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
        issuer: "arenix",
        audience: "arenix-web",
      }) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException("Your session expired. Sign in again.");
    }
    const row = (
      await this.db.query("SELECT * FROM arenix.users WHERE id::text=$1", [
        payload.sub,
      ])
    ).rows[0];
    if (!row || row.session_version !== payload.sv)
      throw new UnauthorizedException("Your session is no longer valid.");
    if (!row.active)
      throw new ForbiddenException("This account is deactivated.");
    return identity(row);
  }
  async logout(user: User) {
    await this.db.query(
      "UPDATE arenix.users SET session_version=session_version+1 WHERE id=$1",
      [user.id],
    );
  }
}
export function role(user: User, ...roles: Role[]) {
  if (!roles.includes(user.role))
    throw new ForbiddenException("Your role cannot perform this action.");
}
