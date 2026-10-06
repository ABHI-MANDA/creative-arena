import "dotenv/config";
import { Pool } from "pg";
import { ensureSeed } from "./seed";

const rawDbUrl = process.env.DATABASE_URL?.trim();

if (!rawDbUrl) {
  console.error("DATABASE_URL is missing in environment.");
  process.exit(1);
}

const databaseUrl =
  /[?&]sslmode=(require|prefer|verify-ca)(&|$)/i.test(rawDbUrl) && !rawDbUrl.includes("uselibpqcompat=")
    ? `${rawDbUrl}${rawDbUrl.includes("?") ? "&" : "?"}uselibpqcompat=true`
    : rawDbUrl;

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

async function initDb() {
  console.log("Connecting to Neon PostgreSQL...");
  const client = await pool.connect();
  
  try {
    console.log("Creating database tables if not exist...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        property_type TEXT NOT NULL,
        price TEXT NOT NULL,
        audience TEXT NOT NULL DEFAULT '',
        amenities TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        objective TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'samples',
        source_url TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS property_images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL DEFAULT 'photo',
        sort INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS property_dna (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id UUID NOT NULL UNIQUE REFERENCES properties(id) ON DELETE CASCADE,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        preset TEXT NOT NULL,
        preset_label TEXT NOT NULL DEFAULT '',
        platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
        options JSONB NOT NULL DEFAULT '[]'::jsonb,
        direction JSONB,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        platform TEXT NOT NULL,
        aspect TEXT NOT NULL DEFAULT '4:5',
        title TEXT NOT NULL DEFAULT '',
        payload JSONB NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        checks JSONB NOT NULL DEFAULT '[]'::jsonb,
        status TEXT NOT NULL DEFAULT 'review',
        approved BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS generations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kind TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'success',
        duration_ms INTEGER NOT NULL DEFAULT 0,
        cost_cents INTEGER NOT NULL DEFAULT 0,
        campaign_id UUID,
        property_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL
      );
    `);

    console.log("Database schema successfully created/verified!");
  } finally {
    client.release();
  }

  console.log("Seeding initial data into remote PostgreSQL...");
  const seeded = await ensureSeed();
  console.log("Seeding result:", seeded ? "SUCCESS" : "ALREADY SEEDED OR FAILED");

  await pool.end();
}

initDb().catch((err) => {
  console.error("Migration/Seeding failed:", err);
  process.exit(1);
});
