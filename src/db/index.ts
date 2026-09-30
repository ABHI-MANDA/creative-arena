import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export const isLocalJsonDb =
  process.env.NODE_ENV !== "production" && process.env.LOCAL_JSON_DB === "true";

const databaseUrl =
  process.env.DATABASE_URL ??
  (isLocalJsonDb ? "postgresql://unused:unused@127.0.0.1:1/local_json_mode" : undefined);

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
