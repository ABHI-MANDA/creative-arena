import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export const isLocalJsonDb =
  process.env.LOCAL_JSON_DB?.trim() === "true" || !process.env.DATABASE_URL?.trim();

function normalizeDatabaseUrl(url?: string): string {
  const trimmed = url?.trim();
  if (!trimmed) return "postgresql://unused:unused@127.0.0.1:1/local_json_mode";
  if (/[?&]sslmode=(require|prefer|verify-ca)(&|$)/i.test(trimmed) && !trimmed.includes("uselibpqcompat=")) {
    const sep = trimmed.includes("?") ? "&" : "?";
    return `${trimmed}${sep}uselibpqcompat=true`;
  }
  return trimmed;
}

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    ssl: databaseUrl.includes("neon.tech") || databaseUrl.includes("sslmode=")
      ? { rejectUnauthorized: false }
      : undefined,
  });

globalForDb.__arenaNextJsPostgresqlPool = pool;

export const db = drizzle(pool);
