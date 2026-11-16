import { readFileSync } from "node:fs";
import { rootCertificates } from "node:tls";
import type { PoolConfig } from "pg";

export function connectionOptions(
  env: NodeJS.ProcessEnv = process.env,
): PoolConfig {
  if (!env.DATABASE_URL?.trim()) {
    throw new Error(
      "Add your Supabase Session pooler URI and DATABASE_PASSWORD to .env, then run npm run db:setup.",
    );
  }
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname)
      throw new Error();
  } catch {
    throw new Error(
      "DATABASE_URL must be a PostgreSQL URI copied from Supabase Connect. Check the macOS setup guide.",
    );
  }
  if (env.DATABASE_PASSWORD)
    url.password = encodeURIComponent(env.DATABASE_PASSWORD);
  let password: string;
  try {
    password = decodeURIComponent(url.password);
  } catch {
    throw new Error(
      "Put the database password in DATABASE_PASSWORD rather than manually encoding it in DATABASE_URL.",
    );
  }
  if (!password || /YOUR[-_ ]PASSWORD/i.test(password)) {
    throw new Error(
      "Set DATABASE_PASSWORD to your Supabase database password in .env.",
    );
  }
  if (
    /PROJECT[-_]REF|POOLER[-_]HOST|\[|\]/i.test(url.hostname + url.username)
  ) {
    throw new Error(
      "Replace the example DATABASE_URL with the Session pooler URI from your own Supabase project.",
    );
  }
  // node-postgres lets URI SSL parameters override its ssl object. Keep TLS
  // verification under this configuration's control, including copied URIs.
  for (const key of ["sslcert", "sslkey", "sslrootcert"]) {
    if (url.searchParams.has(key))
      throw new Error(
        "Set the certificate path in DATABASE_CA_FILE rather than DATABASE_URL.",
      );
  }
  url.searchParams.delete("sslmode");
  url.searchParams.delete("ssl");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  let ca: string | undefined;
  if (env.DATABASE_CA_FILE?.trim()) {
    try {
      ca = readFileSync(env.DATABASE_CA_FILE, "utf8");
    } catch {
      throw new Error(
        "Cannot read DATABASE_CA_FILE. Save the Supabase root certificate as supabase-ca.crt in the project folder, or correct its path in .env.",
      );
    }
  }
  return {
    connectionString: url.toString(),
    max: 5,
    connectionTimeoutMillis: 10000,
    ssl:
      loopback && !ca
        ? false
        : {
            rejectUnauthorized: false,
            ...(ca ? { ca: [...rootCertificates, ca] } : {}),
          },
  };
}