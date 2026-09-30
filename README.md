# M & A — AI Real Estate Creative Studio

> **AI Real Estate Creative Agent** — turn property photos, project websites and plain-language briefs
> into professional, QC-scored, ready-to-publish property campaigns.

M & A is brief-driven, not prompt-driven. Marketing teams answer a simple creative brief; the platform
extracts a project's **Creative DNA**, proposes **3 creative directions**, composes a full multi-platform
**ad system** (Hero / Feature / Location / Offer / Lifestyle / Story / Reel storyboard), runs an
**11-point Brand Quality Check**, and ships a downloadable **ready-to-post campaign package**.

---

## Table of Contents

- [Feature Overview](#feature-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start (TL;DR)](#quick-start-tldr)
- [Full Setup Guide](#full-setup-guide)
  - [1. Database options](#1-database-options)
  - [2. Environment variables](#2-environment-variables)
  - [3. Install & migrate](#3-install--migrate)
  - [4. Run the app](#4-run-the-app)
  - [5. Optional AI provider (OpenRouter)](#5-optional-ai-provider-openrouter)
- [Quick Start with VS Code](#quick-start-with-vs-code)
- [Available Commands](#available-commands)
- [Application Map](#application-map)
- [Deployment Guide](#deployment-guide)
  - [A. Vercel + Neon (recommended)](#a-vercel--neon-recommended)
  - [B. Railway / Render](#b-railway--render)
  - [C. Docker (self-hosted)](#c-docker-self-hosted)
  - [Production checklist](#production-checklist)
- [Resetting Demo Data](#resetting-demo-data)
- [Troubleshooting](#troubleshooting)

---

## Feature Overview

| Area | What it does |
| --- | --- |
| **Property Onboarding** | Bring a property in via website URL, photo upload, or the sample library. A plain-language **Creative Brief** replaces prompt engineering. |
| **Creative DNA** | Vision pass extracts architecture, palette, lighting, audience, positioning, USPs, features and location advantages. Every asset inherits it. |
| **Campaign Presets** | 10 one-click presets: Luxury Property, Project Launch, New Phase, Sale, Rental, Investment, Open House, Festival Offer, Construction Progress, Location Highlight. |
| **Platform-first generation** | Instagram Reel / Post / Story, Facebook, YouTube Short, LinkedIn, WhatsApp, Property Portal — aspect ratio, safe zones and composition are chosen automatically. |
| **Creative Directions** | Before anything is generated, M & A proposes 3 concepts (Golden Hour Cinema, Bright Living, Form & Structure) with palettes, grade and music direction. |
| **Reference-guided ad system** | A configured image-edit model creates a distinct image for each still post from attached references; the design engine adds editable logo, headline, price, CTA, typography and safe zones. |
| **Reel storyboard** | 15s / 30s shot-by-shot scripts: Hook → Exterior → Interior → Amenities → (Lifestyle/USP) → CTA, with transitions, captions and music. |
| **Brand Ad Quality Check** | 11-point QC sweep per asset with score ring. Configurable thresholds in the Brand Kit (internal review gates — tunable, not an objective effectiveness measure). |
| **Before → After studio** | Draggable comparison slider: Original → AI Enhanced → Final Ad. |
| **Ready-to-post package** | Export still ads as PNG/JPEG and download a campaign ZIP with rendered frames, a manifest, captions, hashtags, and reel storyboard JSON. |
| **Admin Console** | Users, campaigns, generations, AI cost, failures, storage, API usage, provider health, and per-model performance (success, latency, cost, approval, regen rate). |

---

## Tech Stack

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 16** (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Database | **PostgreSQL** via **Drizzle ORM** (`pg` driver) |
| Styling | **Tailwind CSS v4** + custom design system (`globals.css`) |
| Fonts | Fraunces (display), Inter (sans), IBM Plex Mono — via `next/font` |
| Icons | `lucide-react` |
| AI | **OpenRouter** for optional copy refinement and image generation; reference images are sent through its Images API |

---

## Project Structure

```
.
├── public/images/props/          # AI-generated sample property photography
├── src
│   ├── app
│   │   ├── page.tsx              # Studio Overview (dashboard)
│   │   ├── layout.tsx            # Fonts + app shell mount
│   │   ├── globals.css           # Theme tokens, ad typography (cqw), motion
│   │   ├── properties/           # List · new (wizard) · [id] (DNA, Before→After)
│   │   ├── campaigns/            # List · new (preset → platforms → directions) · [id] (workspace)
│   │   ├── assets/               # Filterable ad library
│   │   ├── templates/            # Ad system & preset gallery
│   │   ├── brand/                # Brand Kit & QC thresholds
│   │   ├── admin/                # Operations & model intelligence console
│   │   └── api/                  # properties, campaigns, generate, assets, brand, health
│   ├── components/               # Shell, ad renderer, pipeline, storyboard, QC, before/after…
│   ├── db
│   │   ├── schema.ts             # Drizzle tables
│   │   ├── queries.ts            # Typed data access + telemetry
│   │   ├── seed.ts               # Idempotent demo auto-seed
│   │   └── index.ts              # pg Pool + drizzle client
│   └── lib
│       ├── utils.ts
│       └── creative/
│           ├── presets.ts        # Platforms, presets, brand defaults, QC checklist
│           ├── engine.ts         # Creative Intelligence Engine (DNA, directions,
│           │                     #   composer, storyboards, captions, QC scoring)
│           └── image-provider.ts # OpenRouter image generation and reference guidance
├── drizzle.config.ts
├── .env                          # DATABASE_URL (never commit real secrets)
└── package.json
```

---

## Prerequisites

- **Node.js 20+** (LTS recommended) — check with `node -v`
- **npm 10+**
- **PostgreSQL 14+** — local install, Docker, or a free managed instance (Neon/Supabase/Railway)
- **VS Code** (for the guided setup below)

---

## Quick Start (TL;DR)

For **Windows PowerShell**, run these commands from the project folder. Local development defaults
to a JSON database at `.local-db/database.json`, so PostgreSQL and Docker are not needed for preview.

```powershell
# Install dependencies and create .env without overwriting an existing file
npm.cmd install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

# Start the local preview
node .\node_modules\next\dist\bin\next dev
```

Open **http://localhost:3000** in your browser. The first request seeds the demo properties,
campaigns, and telemetry. Leave the terminal running while previewing; press **Ctrl+C** to stop.
Save the supplied brand image as `public/images/brand-logo.png` so it appears in the desktop and
mobile headers.

The JSON file uses the same seven table names and inferred row shapes as the PostgreSQL schema.
It is local-only and ignored by Git. Delete `.local-db/database.json` to reset the local demo data;
the next request recreates the demo seed. Set `LOCAL_JSON_DB=false` and configure PostgreSQL to
use the standard database locally. Production always uses PostgreSQL.

Rendered PNG/JPEG exports are saved under `.local-db/exports/` and referenced from each asset's
`payload.exportFiles` field. Campaign ZIPs include the still-image renders and storyboard JSON.
Reels are currently storyboards, not rendered MP4 videos.

The Ad Templates page lets you enable/disable built-in formats and save custom prompt directions.
Campaign setup lists free OpenRouter text models; Automatic selects the best catalog match and
uses the local engine if model discovery/provider generation is unavailable. Campaign activity
shows the actual model/fallback and exact action date/time. Reel generation produces validated
scripts/storyboards; rendered MP4 output requires a separately configured video-generation provider.

Campaign still-image generation uses OpenRouter's Images API. Set `OPENROUTER_API_KEY` in `.env`;
`IMAGE_API_BASE_URL` and `IMAGE_MODEL` optionally override the defaults. `OPENROUTER_API_KEY` is
used for image generation; `IMAGE_API_KEY` is a fallback only. Reference images and a manual headline are optional. References
strongly guide each still ad's image; without them, the image model generates from the property brief
and art direction. A supplied headline is used exactly and takes priority over generated copy. Each
still ad has an individual preview. Provider errors are surfaced; sample/property photos are never
silently substituted.

> **Windows path note:** If the project folder path contains `&` (as in `M & A`), use the
> `node ...` commands above. The npm script launcher can misread that path. In folders without
> `&`, you can use `npm run dev` and `npx drizzle-kit push` instead.

---

## Full Setup Guide

### 1. Database options

Pick one:

**Option A — Docker (fastest)**

```bash
docker run --name aurum-pg \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=app_db \
  -p 5432:5432 -d postgres:16
```

**Option B — Local PostgreSQL**

**Windows:** Install PostgreSQL 14+ using the [official Windows installer](https://www.postgresql.org/download/windows/).
In pgAdmin, create a database named `app_db`. Set the username, password, host, and port in
`.env` to match your installation. The default connection string below expects user `postgres`,
password `postgres`, host `127.0.0.1`, and port `5432`.

```bash
# macOS (Homebrew)
brew install postgresql@16 && brew services start postgresql@16
createdb app_db

# Ubuntu/Debian
sudo apt install postgresql && sudo service postgresql start
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" -c "CREATE DATABASE app_db;"
```

**Option C — Managed (Neon, free tier)**

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string (choose the **pooled** URI for serverless deploys).

### 2. Environment variables

Create a `.env` file at the project root:

```bash
# required
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db

# optional — hosted text copy refinement
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4o-mini

# optional OpenRouter image endpoint/model overrides (OpenRouter key is reused)
IMAGE_API_BASE_URL=https://openrouter.ai/api/v1
IMAGE_API_KEY=
IMAGE_MODEL=openai/gpt-image-2
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string (must exist **before build/deploy**). |
| `LOCAL_JSON_DB` | No | Set to `true` for the local JSON file database in development. It is ignored in production. |
| `OPENROUTER_API_KEY` | No | Enables hosted copy refinement and free text-model discovery. Local copy remains available when unset. |
| `OPENROUTER_MODEL` | No | Overrides the OpenRouter model slug (default `openai/gpt-4o-mini`). |
| `IMAGE_API_BASE_URL` | Optional | OpenRouter API root; defaults to `https://openrouter.ai/api/v1`. |
| `IMAGE_API_KEY` | Optional | Fallback image key, used only when `OPENROUTER_API_KEY` is unset. |
| `IMAGE_MODEL` | Optional | OpenRouter image model slug; defaults to `openai/gpt-image-2`. |

> Never commit `.env`. It is already ignored by `.gitignore`.

### 3. Install & migrate

Windows PowerShell (works when the project path contains `&`):

```powershell
npm.cmd install
node .\node_modules\drizzle-kit\bin.cjs push
```

macOS/Linux, or Windows when the project path does not contain `&`:

```bash
npm install          # install dependencies
npx drizzle-kit push # create tables in your database
```

Tables created: `properties, property_images, property_dna, campaigns, assets, generations, settings`.

### 4. Run the app

Windows PowerShell when the project path contains `&`:

```powershell
node .\node_modules\next\dist\bin\next dev
```

macOS/Linux, or Windows when the project path does not contain `&`:

```bash
npm run dev        # http://localhost:3000
```

Then open **http://localhost:3000**. Keep the terminal open while using the app; press **Ctrl+C**
to stop the development server.

On the first request the app seeds:
- 2 demo properties (villa enclave + sky tower) with AI photography
- Creative DNA for both
- 1 ready campaign (14 assets) + 1 draft campaign
- ~8 days of generation telemetry for the Admin Console

Production-style run:

```bash
npm run build
npm run start
```

### 5. Optional AI provider (OpenRouter)

1. Create a key at [openrouter.ai](https://openrouter.ai).
2. Add `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`) to `.env`.
3. Restart the dev server — campaign generation now refines headlines/captions via the hosted model,
   while visuals, composition and QC still run through the deterministic engine.

---

## Quick Start with VS Code

### 1. Open the project

- **File → Open Folder…** and select the project directory, or from a terminal:
  ```bash
  code .
  ```

### 2. Install recommended extensions

Accept the popup, or install manually (View → Extensions):

| Extension | ID | Why |
| --- | --- | --- |
| ESLint | `dbaeumer.vscode-eslint` | Live lint feedback |
| Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss` | Class autocomplete for the design system |
| PostgreSQL | `cweijan.vscode-postgresql-client2` | Browse tables/run SQL inside VS Code |
| Pretty TypeScript Errors | `yoavbls.pretty-ts-errors` | Human-readable type errors |
| Error Lens | `usernamehw.errorlens` | Inline diagnostics |
| Prettier | `esbenp.prettier-vscode` | Formatting |

Create `.vscode/extensions.json` so teammates get the same recommendations:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "cweijan.vscode-postgresql-client2",
    "yoavbls.pretty-ts-errors",
    "usernamehw.errorlens",
    "esbenp.prettier-vscode"
  ]
}
```

### 3. (Optional) workspace settings — `.vscode/settings.json`

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.formatOnSave": false,
  "css.validate": false,
  "editor.quickSuggestions": { "strings": true }
}
```

### 4. Terminal workflow inside VS Code

- Open the integrated terminal: **Terminal → New Terminal** (`` Ctrl+` `` / `` Cmd+` ``)
- Run the PowerShell Quick Start commands above on Windows. Use `npm install` → `npx drizzle-kit push` → `npm run dev` on macOS/Linux or when the Windows project path does not contain `&`.
- Or use **Terminal → Run Task…** with this `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    { "label": "Dev server", "type": "shell", "command": "npm run dev", "group": { "kind": "build", "isDefault": true }, "isBackground": true },
    { "label": "DB: push schema", "type": "shell", "command": "npx drizzle-kit push" },
    { "label": "DB: studio", "type": "shell", "command": "npx drizzle-kit studio" },
    { "label": "Typecheck", "type": "shell", "command": "npm run typecheck" },
    { "label": "Production build", "type": "shell", "command": "npm run build" }
  ]
}
```

### 5. Debugging the Next.js server — `.vscode/launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev"
    },
    {
      "name": "Next.js: debug full stack",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/next/dist/bin/next",
      "args": ["dev"],
      "cwd": "${workspaceFolder}",
      "env": { "NODE_OPTIONS": "--inspect" }
    }
  ]
}
```

Press **F5** (Run → Start Debugging), then set breakpoints in route handlers
(`src/app/api/**`), server components, or the creative engine (`src/lib/creative/engine.ts`).

### 6. Browse the database from VS Code

Using the **PostgreSQL** extension: Add Connection →
`postgresql://postgres:postgres@127.0.0.1:5432/app_db` → explore tables, or run
`SELECT * FROM assets;` alongside your editor. (GUI alternative: `npx drizzle-kit studio`.)

---

## Available Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npx next typegen` | Regenerate typed routes |
| `npx drizzle-kit push` | Apply schema to the database |
| `npx drizzle-kit studio` | Visual database browser |
| `npx drizzle-kit generate` | Emit SQL migration files (optional; `push` is the default workflow) |

---

## Application Map

| Route | Purpose |
| --- | --- |
| `/` | Studio Overview — KPIs, recent projects, campaigns, creative activity |
| `/properties` | Property portfolio |
| `/properties/new` | Onboarding wizard: URL / upload / sample library → Creative Brief → AI analysis |
| `/properties/[id]` | Project hub: Creative DNA, Before→After studio, location advantages, campaigns |
| `/campaigns` | Campaign list |
| `/campaigns/new` | Preset → platforms → 3 creative directions → generate |
| `/campaigns/[id]` | Workspace: pipeline intro, asset gallery, storyboard, copy pack, QC, package |
| `/assets` | Cross-campaign ad library with platform/format/status filters |
| `/templates` | Ad system rules, template gallery, preset & aspect reference |
| `/brand` | Brand Kit editor + QC thresholds with live preview |
| `/admin` | Admin console: telemetry, providers, model performance, audit feed |
| `/api/health` | Health check (database connectivity) |

---

## Deployment Guide

M & A is a standard Next.js app with one external dependency: PostgreSQL. All pages are
server-rendered on demand (`force-dynamic`), and the database is seeded automatically on first load.

> **Important:** `DATABASE_URL` must be configured in your hosting platform **before the first
> build/deploy** — `src/db/index.ts` validates its presence at startup.

### A. Vercel + Neon (recommended)

**Step 1 — Database (Neon)**

1. Create a project at [neon.tech](https://neon.tech) and copy the **pooled connection string**:
   `postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DB?sslmode=require`

**Step 2 — Push code to GitHub**

```bash
git init && git add -A && git commit -m "M & A studio"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

**Step 3 — Import into Vercel**

1. [vercel.com](https://vercel.com) → **Add New… → Project** → import the repo.
2. Framework preset: **Next.js** (auto-detected). Build command `npm run build`, output default.
3. **Environment Variables** (before deploying):

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | your Neon pooled string |
   | `OPENROUTER_API_KEY` | optional |
   | `OPENROUTER_MODEL` | optional |
  | `IMAGE_API_BASE_URL` | image provider API root |
  | `IMAGE_API_KEY` | image provider secret |
  | `IMAGE_MODEL` | image provider model |

4. Deploy.

**Step 4 — Create tables in the production database** (one-time, from your machine):

```bash
DATABASE_URL="postgresql://...neon.tech/...?sslmode=require" npx drizzle-kit push
# or temporarily set it in .env and run: npx drizzle-kit push
```

Open the deployment URL — first visit seeds the demo studio.

**Serverless note:** the app uses a single `pg.Pool`, which is fine for moderate traffic. At higher
concurrency, always use Neon's pooled endpoint (or PgBouncer/RDS Proxy for other providers) so
serverless functions don't exhaust connections.

### B. Railway / Render

**Railway**

1. New Project → **Provision PostgreSQL**.
2. **Deploy from repo** → connect GitHub → select this repository.
3. In the web service settings:
   - Build Command: `npm ci && npm run build`
   - Start Command: `npx next start -p $PORT`
4. Variable: `DATABASE_URL=${{Postgres.DATABASE_URL}}` (service reference) — plus optional `OPENROUTER_API_KEY`.
5. One-off task (or locally against the public URL): `npx drizzle-kit push`.

**Render**

1. **New → PostgreSQL** → copy the *Internal Database URL*.
2. **New → Web Service** from your repo:
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm run start`
3. Add env vars (`DATABASE_URL`, optional `OPENROUTER_API_KEY`).
4. Run `npx drizzle-kit push` from the Render **Shell** tab or locally against the External URL.

### C. Docker (self-hosted)

**Dockerfile** (create at repo root if you want container deploys):

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app /app
EXPOSE 3000
CMD ["npx", "next", "start"]
```

**docker-compose.yml** (app + database together):

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  web:
    build: .
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/app_db
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:-}
      IMAGE_API_BASE_URL: ${IMAGE_API_BASE_URL:-https://openrouter.ai/api/v1}
      IMAGE_API_KEY: ${IMAGE_API_KEY:-}
      IMAGE_MODEL: ${IMAGE_MODEL:-gpt-image-1}
    ports:
      - "3000:3000"
    depends_on:
      - db

volumes:
  pgdata:
```

Bring it up and create tables:

```bash
docker compose up -d --build
docker compose exec web npx drizzle-kit push
```

Visit **http://localhost:3000**. Put the container behind your reverse proxy (nginx/Caddy/Traefik)
with TLS for production.

### Production checklist

- [ ] `DATABASE_URL` set on the host **before** first build
- [ ] `npx drizzle-kit push` executed against the production database
- [ ] `.env` / keys never committed (use platform env-var UI)
- [ ] Unique, strong database credentials (not the dev defaults)
- [ ] `OPENROUTER_API_KEY` set if you want hosted model refinement
- [ ] Image API base URL, secret key, and model set if campaign image generation is enabled
- [ ] `/api/health` returns `{ "ok": true }` after deploy
- [ ] Pooled database endpoint for serverless hosts (Neon pooler / PgBouncer)

---

## Resetting Demo Data

The studio seeds only when the `properties` table is empty. To wipe and reseed:

```bash
psql "$DATABASE_URL" -c "TRUNCATE properties, property_images, property_dna, campaigns, assets, generations, settings CASCADE;"
```

Reload any page — fresh demo data is generated automatically.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `DATABASE_URL is required` | Missing env var | Create `.env` with `DATABASE_URL` and restart. |
| `ECONNREFUSED 127.0.0.1:5432` | Postgres not running | Start Docker container / `brew services start postgresql`. |
| `relation "properties" does not exist` | Schema not applied | Run `npx drizzle-kit push`. |
| Empty pages on first deploy | Tables created but no data | Hit any page once — seeding runs automatically on first request. |
| `OPENROUTER` shows "Demo mode" in Admin | No API key | Expected — local engine is active. Add `OPENROUTER_API_KEY` to switch to hosted models. |
| Port 3000 already in use | Another process | `npx next dev -p 3001` or stop the other process. |
| Stale types after adding routes | Old route typings | Run `npx next typegen`. |
| Connection limit errors on serverless | Pool per invocation | Use the provider's **pooled** connection string. |

---

**M & A** — property photos in, ready-to-post campaigns out.
