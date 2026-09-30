# Production Deployment Guide

This document covers deployment of M & A Creative Arena to a production-capable Next.js host. Read [README-DB.md](README-DB.md) for schema and migration details, and [README-API.md](README-API.md) for the full endpoint inventory.

## Production Requirements

- Node.js 20+ and npm 10+
- A reachable PostgreSQL database
- A deployment platform that supports the Next.js App Router and server-side route handlers
- `DATABASE_URL` configured in the deployment environment before the build
- An access-control layer before exposing the application publicly

The app initializes the PostgreSQL pool in `src/db/index.ts`; `DATABASE_URL` is mandatory in production. `LOCAL_JSON_DB` is intentionally ignored when `NODE_ENV=production`.

## Pre-deployment Checklist

1. Provision a production PostgreSQL database and a restricted database role.
2. Configure `DATABASE_URL` as a platform secret. Use a pooled URL for serverless runtime traffic when your provider recommends one.
3. Apply the schema using [README-DB.md](README-DB.md) before serving production traffic.
4. Run dependency installation, lint, typecheck, and a production build in CI.
5. Add authentication/authorization and restrict write APIs before public launch. No auth middleware is included in this repository.
6. Confirm `/api/health` returns HTTP 200 and `{ "ok": true }` after deployment.
7. Verify database backups and restore procedures.
8. Decide how production media exports will be stored. Current persistent PNG/JPEG and campaign ZIP endpoints are local-JSON-only and return HTTP 501 in PostgreSQL mode.

## Environment Variables

| Variable | Required | Production behavior |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string for the app and Drizzle Kit. Keep it in the host's secret manager. |
| `LOCAL_JSON_DB` | No | Ignored in production. It is only a development storage selector. |
| `OPENROUTER_API_KEY` | No | Enables OpenRouter model discovery and optional hosted copy refinement. |
| `OPENROUTER_MODEL` | No | Default OpenRouter model slug when the model choice is automatic; defaults to `openai/gpt-4o-mini`. |
| `NODE_ENV` | Platform-managed | Set to `production` by standard Next.js production builds/runtimes; do not use it to enable local JSON mode. |

Copy `.env.example` only for local work. Do not commit `.env` or paste production credentials into scripts, tickets, or documentation.

## Build and Run

CI or a deployment build environment:

```bash
npm ci
npm run lint
npm run typecheck
npm run build
```

Start the production server with:

```bash
npm run start
```

The default Next.js port is `3000`; platforms commonly provide a `PORT` variable. Follow the host's Next.js deployment adapter/runtime instructions where applicable.

## Vercel (Example)

1. Create a PostgreSQL database (for example, Neon) and prepare its connection string.
2. Import the repository as a Next.js project.
3. Configure `DATABASE_URL` in the Vercel project environment variables before deploying. Add `OPENROUTER_API_KEY` only if hosted models are required.
4. Apply the schema to that same database using the migration steps in [README-DB.md](README-DB.md). Do this as a controlled operator/CI step, not on each application request.
5. Deploy and verify `/api/health`.

For serverless hosting, use the provider's pooled runtime connection endpoint when advised. For schema changes, use a controlled migration connection and review the proposed DDL before applying it.

## Railway, Render, or Other Node Hosts

1. Provision PostgreSQL in the same region/network as the application where possible.
2. Deploy from the repository using the platform's supported Next.js build/runtime configuration.
3. Set `DATABASE_URL` as a secret environment variable on the web service.
4. Apply the schema to the configured database before switching traffic to the new version.
5. Confirm logs, health checks, database connectivity, and backup configuration.

Do not use `.local-db/` as persistent storage on an ephemeral container filesystem.

## Docker and Reverse Proxies

The repository does not include a maintained Dockerfile or Compose deployment. If you package it yourself, use a supported Node LTS image, install from the lockfile, build in a separate build stage, and provide `DATABASE_URL` at runtime. Do not bake secrets into image layers. Put the service behind HTTPS at a reverse proxy or managed ingress.

## Data Seeding

On the first request, `ensureSeed()` inserts sample properties, related campaign data, and generation telemetry when the properties table is empty. Existing databases with properties are not reseeded automatically. Review [README-DB.md](README-DB.md) before clearing or seeding a production database; demo data should generally be removed from production.

## Production Limitations and Security

- **Authentication:** no login, session, role, or authorization middleware is present. API endpoints can read and mutate data. Restrict access at the application/ingress layer until authentication is implemented.
- **Media exports:** persistent asset exports and campaign ZIP assembly currently use `.local-db/exports/` and only operate in local JSON mode. Implement shared object storage and update these handlers before relying on exports in production.
- **Local JSON:** the JSON store is development-only and unsuitable for multiple processes or replicas.
- **Video:** reel deliverables are storyboards; there is no MP4 renderer configured.
- **Telemetry:** generation rows are application activity records, not a substitute for infrastructure monitoring or provider latency measurements.
- **Privacy:** property briefs, image references, generated copy, and telemetry may contain sensitive business information. Define retention, access, and backup policies for the deployment.

## Release Checklist

- [ ] `DATABASE_URL` points to the intended production database.
- [ ] Schema changes have been reviewed and applied before application rollout.
- [ ] `npm run lint`, `npm run typecheck`, and `npm run build` pass in CI.
- [ ] Authentication and authorization protect all pages and write endpoints.
- [ ] Database backups and restore steps are tested.
- [ ] HTTPS, logs, health checks, and resource limits are configured.
- [ ] Media export behavior is understood and production storage is implemented if required.
- [ ] Demo records and sample imagery have been reviewed for production use.
