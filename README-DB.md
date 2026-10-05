# Database Guide

M & A uses Drizzle ORM over PostgreSQL in production (e.g. Neon Serverless Postgres), with an automatic file-backed JSON fallback engine when `DATABASE_URL` is unconfigured or when `LOCAL_JSON_DB=true`. See [README-PROD.md](README-PROD.md) before configuring production data.

## Database Modes

### 1. Automatic Fallback & Resilience Engine

The application checks database readiness at runtime:
- `isLocalJsonDb` evaluates to `true` if `LOCAL_JSON_DB=true` OR if `DATABASE_URL` is not provided.
- This ensures zero-config instant startup for local development, previews, or standalone production deployments without requiring an active PostgreSQL database.

### 2. PostgreSQL (Production & Neon Serverless)

When `DATABASE_URL` is configured:
- Connected via `pg.Pool` with Drizzle ORM.
- **SSL Auto-Detection**: Automatically enables SSL (`rejectUnauthorized: false`) when connecting to Neon Postgres (`neon.tech`) or when `sslmode` is specified in the connection string.
- **Connection Pooling**: Managed with a 10-connection limit, 30s idle timeout, and 10s connection timeout to optimize serverless execution.
- Managed and migrated using Drizzle Kit through `drizzle.config.ts`.

### 3. Local JSON Engine

- Data is persisted to `.local-db/database.json`.
- Assets rendered on client or server exports write to `.local-db/exports/` when in local environment mode.
- Thread-safe atomic file renames and serialized queue writes protect against data corruption.

## Schema Overview

All tables are declared in `src/db/schema.ts`.

| Table | Purpose | Key fields and relationships |
| --- | --- | --- |
| `properties` | Property brief and lifecycle | UUID primary key; name, location, type, price, audience, amenities, description, objective, source, status, creation time |
| `property_images` | Ordered property image references | UUID primary key; `property_id` references properties with cascade delete; URL, label, kind, sort index |
| `property_dna` | Analyzed Creative DNA | UUID primary key; unique `property_id` references properties with cascade delete; typed JSONB DNA; creation time |
| `campaigns` | Campaign plan and selected direction | UUID primary key; `property_id` references properties with cascade delete; preset, platforms JSONB, options/direction JSONB, status, creation time |
| `assets` | Generated copy and visual-ad data | UUID primary key; campaign/property foreign keys cascade on delete; kind, platform, aspect, title, typed payload JSONB, score, QC checks JSONB, status, approval flag, creation time |
| `generations` | Activity and cost telemetry | UUID primary key; kind, model, status, duration, cost in cents, nullable campaign/property UUIDs, creation time |
| `settings` | Brand, template, and campaign preferences | Text primary key and JSONB value; includes brand settings, template library, and selected campaign-model keys |

### Relationship Summary

- A property can have many images, campaigns, and assets.
- A property can have at most one DNA record (`property_dna.property_id` is unique).
- A campaign belongs to a property and can have many assets.
- Deleting a property cascades to its images, DNA, campaigns, and assets through the declared foreign keys.
- Generation `campaign_id` and `property_id` are nullable identifiers without declared foreign-key constraints.
- There is no users/account table in the current schema.

JSONB columns hold application-owned data structures. Their TypeScript types are imported from the creative engine: property DNA, campaign directions/platforms, asset payloads, and QC checks. PostgreSQL does not enforce every nested JSON shape at the database level.

## Apply the Schema

1. Copy `.env.example` to `.env` if needed.
2. Set `DATABASE_URL` to the PostgreSQL database to update.
3. Review the target database carefully, especially before production changes.
4. Run Drizzle Kit from the repository root:

```bash
npx drizzle-kit push
```

The config loads `.env` with `dotenv/config` and requires `DATABASE_URL`. `push` compares the TypeScript schema to the selected database and applies the required changes. Use a reviewed backup and a controlled release window for production schema changes.

Useful commands:

```bash
npx drizzle-kit push
npx drizzle-kit studio
npx drizzle-kit generate
```

## Demo Seed

`ensureSeed()` is called by application routes/pages. When the database has no property rows, it adds sample properties, property DNA, sample campaigns/assets, brand defaults, and generation telemetry. Once properties exist, it does not automatically replace or refresh demo data.

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Database defaults to JSON mode | `DATABASE_URL` is omitted or empty | Set `DATABASE_URL` in environment variables if PostgreSQL mode is desired. |
| Neon SSL connection errors | Standard PG connection without SSL | `src/db/index.ts` automatically applies SSL for `neon.tech` hosts. Ensure URL contains full host parameters. |
| `relation does not exist` | Schema was not applied to this database | Confirm `DATABASE_URL`, then run `npx drizzle-kit push`. |
| Local JSON file is invalid | Interrupted/manual edit or unsupported schema version | Preserve a copy before attempting recovery; local JSON is development/fallback mode. |
| Drizzle connects to the wrong database | Wrong `DATABASE_URL` loaded by `.env`/shell | Check the active environment and target before running `push`. |
| Export reports unsupported mode | The route requires local JSON mode | Production needs a shared media-storage implementation; see [README-PROD.md](README-PROD.md). |
