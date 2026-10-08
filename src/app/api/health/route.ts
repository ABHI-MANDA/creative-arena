import { db, isLocalJsonDb } from "@/db";
import { sql } from "drizzle-orm";
import { readLocalDatabase } from "@/db/local-json";

import { getTopEndpoints } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (isLocalJsonDb) {
      await readLocalDatabase((database) => database.schemaVersion);
      return Response.json({ ok: true, storage: "local-json", metrics: getTopEndpoints() });
    }
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, storage: "neon-postgres", metrics: getTopEndpoints() });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
