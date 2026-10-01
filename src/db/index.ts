import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export const isLocalJsonDb =
  process.env.LOCAL_JSON_DB === "true" || !process.env.DATABASE_URL?.trim();

const databaseUrl =
  process.env.DATABASE_URL?.trim() || "postgresql://unused:unused@127.0.0.1:1/local_json_mode";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: databaseUrl.includes("neon.tech") || databaseUrl.includes("sslmode=")
      ? { rejectUnauthorized: false }
      : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
