# Database Guide

M & A uses Drizzle ORM over PostgreSQL in production. Development can instead use a file-backed JSON store with the same table-like row shapes. See [README-PROD.md](README-PROD.md) before configuring production data.

## Database Modes

### PostgreSQL

The app connects through `pg.Pool` and Drizzle. `DATABASE_URL` is required when `NODE_ENV=production`, and is also used by Drizzle Kit through `drizzle.config.ts`.

### Local JSON (development only)

Set `LOCAL_JSON_DB=true` while `NODE_ENV` is not `production`. Data is written to `.local-db/database.json`; rendered exports are placed under `.local-db/exports/`. Both paths are ignored by Git.

The local store writes updates through a serialized in-process queue and an atomic temporary-file rename. It is intended for a single developer process, not multi-process access, concurrent serverless instances, or production durability. Production always selects PostgreSQL regardless of `LOCAL_JSON_DB`.

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

The current repository workflow uses `push`; generated SQL migration files are not committed (`/drizzle/` is ignored). If the team adopts versioned migrations, update the repository ignore/configuration and release process together rather than assuming a migration history already exists.

Useful commands:

```bash
npx drizzle-kit push
npx drizzle-kit studio
npx drizzle-kit generate
```

`generate` alone does not apply a schema change. Follow the Drizzle Kit workflow selected by the team and commit migration artifacts if moving to a migration-history-based process.

## Demo Seed

`ensureSeed()` is called by application routes/pages. When the database has no property rows, it adds sample properties, property DNA, sample campaigns/assets, brand defaults, and generation telemetry. Once properties exist, it does not automatically replace or refresh demo data. Seeded data is useful for preview but should be reviewed before production use.

Do not run destructive seed/reset commands against production unless the data loss is intended and backed up.

## Back Up and Reset Local Data

Stop the development server before manually copying or removing the local database. To reset a local JSON preview, remove `.local-db/database.json`; the next request initializes a new demo database. Removing `.local-db/` also removes saved export files.

For PostgreSQL, use the database provider's backup/snapshot tooling or `pg_dump`/`pg_restore` under an approved retention policy. There is no in-app backup/restore feature.

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| `DATABASE_URL is required` | Missing `.env` value or deployment secret | Configure `DATABASE_URL` and restart/redeploy. |
| PostgreSQL connection refused | Server, credentials, firewall, or host/port mismatch | Check database availability and the connection string. |
| `relation does not exist` | Schema was not applied to this database | Confirm `DATABASE_URL`, then run `npx drizzle-kit push`. |
| Local JSON file is invalid | Interrupted/manual edit or unsupported schema version | Preserve a copy before attempting recovery; local JSON is development-only. |
| Drizzle connects to the wrong database | Wrong `DATABASE_URL` loaded by `.env`/shell | Check the active environment and target before running `push`. |
| Export reports unsupported mode | The route requires local JSON mode | Production needs a shared media-storage implementation; see [README-PROD.md](README-PROD.md). |
