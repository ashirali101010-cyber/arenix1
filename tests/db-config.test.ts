import { describe, expect, it } from "vitest";
import { connectionOptions } from "../apps/api/src/db-config.js";

const remote =
  "postgresql://postgres.test-project:[YOUR-PASSWORD]@example.pooler.supabase.com:5432/postgres";
describe("hosted database configuration", () => {
  it("accepts the copied URI and safely encodes a separate password", () => {
    const password = "p@ss:/?#&% words";
    const config = connectionOptions({
      DATABASE_URL: remote,
      DATABASE_PASSWORD: password,
    });
    expect(decodeURIComponent(new URL(config.connectionString!).password)).toBe(
      password,
    );
    expect(new URL(config.connectionString!).hostname).toBe(
      "example.pooler.supabase.com",
    );
    expect(config.ssl).toMatchObject({ rejectUnauthorized: true });
  });
  it("keeps verification enabled when the copied URI requests weaker SSL", () => {
    const config = connectionOptions({
      DATABASE_URL: remote + "?sslmode=disable&ssl=false",
      DATABASE_PASSWORD: "test-password",
    });
    expect(config.ssl).toMatchObject({ rejectUnauthorized: true });
    expect(new URL(config.connectionString!).searchParams.has("sslmode")).toBe(
      false,
    );
    expect(new URL(config.connectionString!).searchParams.has("ssl")).toBe(
      false,
    );
  });
  it("accepts an already completed PostgreSQL URI", () => {
    expect(
      connectionOptions({
        DATABASE_URL: "postgresql://u:pass@example.com:5432/postgres",
      }).ssl,
    ).toMatchObject({ rejectUnauthorized: true });
  });
  it("explains missing settings without printing credentials", () => {
    expect(() => connectionOptions({})).toThrow(/Session pooler/);
    expect(() =>
      connectionOptions({
        DATABASE_URL: "https://secret:password@example.com",
      }),
    ).toThrow(/PostgreSQL URI/);
    expect(() => connectionOptions({ DATABASE_URL: remote })).toThrow(
      /DATABASE_PASSWORD/,
    );
    expect(() =>
      connectionOptions({
        DATABASE_URL:
          "postgresql://postgres.PROJECT_REF@POOLER_HOST:5432/postgres",
        DATABASE_PASSWORD: "test",
      }),
    ).toThrow(/own Supabase project/);
  });
  it("reports a missing certificate and rejects conflicting certificate parameters", () => {
    expect(() =>
      connectionOptions({
        DATABASE_URL: remote,
        DATABASE_PASSWORD: "test",
        DATABASE_CA_FILE: "./missing-test-certificate.crt",
      }),
    ).toThrow(/Cannot read DATABASE_CA_FILE/);
    expect(() =>
      connectionOptions({
        DATABASE_URL: remote + "?sslrootcert=other.crt",
        DATABASE_PASSWORD: "test",
      }),
    ).toThrow(/DATABASE_CA_FILE rather than/);
  });
});
