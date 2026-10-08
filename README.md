# M & A — AI Real Estate Creative Studio

> **AI Real Estate Creative Agent** — turn property photos, listing web links, and plain-language briefs into professional, QC-scored, ready-to-publish property campaigns.
>
> 🌐 **Live Website**: (https://creativearena.netlify.app/)

M & A is brief-driven, not prompt-driven. Marketing teams onboard a property via **web link scraping**, photo upload, or plain-language brief; the platform extracts a project's **Creative DNA**, proposes **3 creative directions**, composes a full multi-platform **ad system** (Hero / Feature / Location / Offer / Lifestyle / Story / Reel storyboard), runs an **11-point Brand Quality Check**, and ships a downloadable **ready-to-post campaign package**.

---

## Table of Contents

- [Live Application](#live-application)
- [Recent Upgrades & Key Features](#recent-upgrades--key-features)
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
  - [A. Netlify (Live Production Host)](#a-netlify-live-production-host)
  - [B. Vercel + Neon (recommended)](#b-vercel--neon-recommended)
  - [C. Railway / Render](#c-railway--render)
  - [D. Docker (self-hosted)](#d-docker-self-hosted)
  - [Production checklist](#production-checklist)
- [Resetting Demo Data](#resetting-demo-data)
- [Troubleshooting](#troubleshooting)

---

## Live Application

The production application is deployed and live at:
🔗 **[https://creativearena.netlify.app/](https://creativearena.netlify.app/)**

---

## Recent Upgrades & Key Features

- 🚀 **Live Web Link Scraper (`/api/properties/scrape`)**: Add properties simply by pasting listing web URLs. The intelligent scraper automatically extracts structured property briefs, location, pricing, amenities, and high-resolution property imagery.
- 📐 **1:1 Square Feed Default**: All post formats default to clean 1:1 square aspect ratios fitting frames seamlessly (`object-fit: cover`) for Instagram, Facebook, and LinkedIn feeds.
- 🖼️ **Ready-to-Post Images (Zero System Watermarks)**: Removed all internal system badges, M & A logos, top-left brand text, approval stamps, and ratio tags from exported creatives. Downloaded ads are 100% clean and commercially usable.
- 📸 **High-Definition DOM & Canvas Export Engine (`renderAssetDOMToBlob`)**: Exports exact 1080p high-resolution ad posts preserving full background property photos with **zero black margins, zero black sidebars, and zero empty space**.
- 🔒 **Server-Side Image Proxy (`/api/proxy-image`)**: Proxy route for fetching external, scraped, or stock property images without CORS restrictions or canvas tainting.
- ⚡ **Dual DB Engine Resilience**: Automatic fallback to local JSON database mode if `DATABASE_URL` is unconfigured or PostgreSQL connections drop during serverless cold-starts, preventing production SSR errors (`ERROR 3128256750`).

---

## Feature Overview

| Area | What it does |
| --- | --- |
| **Property Onboarding** | Bring a property in via **web link scraping**, photo upload, or sample library. A plain-language **Creative Brief** replaces complex prompt engineering. |
| **Creative DNA** | Vision pass extracts architecture, palette, lighting, audience, positioning, USPs, features and location advantages. Every asset inherits it. |
| **Campaign Presets** | 10 one-click presets: Luxury Property, Project Launch, New Phase, Sale, Rental, Investment, Open House, Festival Offer, Construction Progress, Location Highlight. |
| **Platform-first Generation** | Instagram Reel / Post / Story, Facebook, YouTube Short, LinkedIn, WhatsApp, Property Portal — aspect ratio, safe zones and composition are chosen automatically. |
| **3 Creative Directions** | Before anything is generated, M & A proposes 3 concepts (Golden Hour Cinema, Bright Living, Form & Structure) with palettes, grade and music direction. |
| **Reference-guided Ad System** | Reference images guide still ad imagery; the design engine adds editable headline, price, CTA, typography, and safe zones. |
| **Reel Storyboard** | 15s / 30s shot-by-shot scripts: Hook → Exterior → Interior → Amenities → (Lifestyle/USP) → CTA, with transitions, captions and music. |
| **Brand Ad Quality Check** | 11-point QC sweep per asset with score ring. Configurable thresholds in the Brand Kit. |
| **Before → After Studio** | Draggable comparison slider: Original → AI Enhanced → Final Ad. |
| **Ready-to-Post Package** | Export still ads as high-res PNG/JPEG and download a campaign ZIP package with rendered frames, manifest, captions, hashtags, and reel storyboard JSON. |
| **Admin Console** | Users, campaigns, generations, AI cost, failures, storage, API usage, provider health, and per-model performance telemetry. |

---

## Tech Stack

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 16** (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Database | **PostgreSQL** via **Drizzle ORM** (`pg` driver) + Local JSON Fallback |
| Image Proxy | Server-side CORS Proxy (`/api/proxy-image`) |
| Scraper | Web Scraper Engine (`/api/properties/scrape`) |
| Export Engine | `html-to-image` + Canvas 2D DOM Snapshot Engine |
| Styling | **Tailwind CSS v4** + custom design system (`globals.css`) |
| Fonts | Fraunces (display), Inter (sans), IBM Plex Mono — via `next/font` |
| Icons | `lucide-react` |
| AI Provider | **OpenRouter** (GPT-4o-Mini for copy & prompt intelligence, GPT-Image-2 for photography) |

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
│   │   └── api/                  # properties, scrape, campaigns, generate, assets, proxy-image, health
│   ├── components/               # Shell, ad renderer, pipeline, storyboard, QC, before/after…
│   ├── db
│   │   ├── schema.ts             # Drizzle tables
│   │   ├── queries.ts            # Typed data access + resilient fallback telemetry
│   │   ├── seed.ts               # Idempotent demo auto-seed
│   │   └── index.ts              # pg Pool + drizzle client + SSL pool handling
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
- **PostgreSQL 14+** — local install, Docker, or managed instance (Neon/Supabase/Railway)
- **VS Code** (for the guided setup below)

---

## Quick Start (TL;DR)

For **Windows PowerShell**, run these commands from the project folder. Local development defaults
to a JSON database at `.local-db/database.json`, so PostgreSQL and Docker are not needed for preview.

```powershell
# Install dependencies and create .env without overwriting an existing file
cmd /c npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

# Start the local preview
cmd /c npm run dev
```

Open **http://localhost:3000** in your browser. The first request seeds the demo properties,
campaigns, and telemetry. Leave the terminal running while previewing; press **Ctrl+C** to stop.

---

## Full Setup Guide

### 1. Database options

Pick one:

**Option A — Local JSON File DB (fastest, no Postgres needed)**
Leave `LOCAL_JSON_DB=true` in `.env`.

**Option B — Managed PostgreSQL (Neon, free tier)**
1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string (pooled URI).
3. Set `DATABASE_URL` in `.env`.

### 2. Environment variables

Create a `.env` file at the project root:

```bash
# required for PostgreSQL mode (falls back to local JSON if omitted)
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db

# optional — hosted AI copy & image generation via OpenRouter
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4o-mini

# optional OpenRouter image endpoint/model overrides
IMAGE_API_BASE_URL=https://openrouter.ai/api/v1
IMAGE_API_KEY=
IMAGE_MODEL=openai/gpt-image-2
```

---

## Deployment Guide

### A. Netlify (Live Production Host)

The application is configured for Netlify deployment via `@netlify/plugin-nextjs`.

1. **Push code to GitHub repository**:
   ```bash
   git add .
   git commit -m "Update application"
   git push origin main
   ```
2. **Connect Repository to Netlify**:
   - Framework preset: **Next.js**
   - Build command: `npm run build`
   - Publish directory: `.next`
3. **Set Environment Variables in Netlify**:
   - `DATABASE_URL` (Neon PostgreSQL pooled string)
   - `OPENROUTER_API_KEY` (OpenRouter API key)
   - `OPENROUTER_MODEL` (`openai/gpt-4o-mini`)
   - `SECRETS_SCAN_OMIT_KEYS` (`IMAGE_API_BASE_URL,IMAGE_MODEL,OPENROUTER_MODEL`)

### B. Vercel + Neon (recommended)

1. Import GitHub repository into Vercel.
2. Add `DATABASE_URL` and `OPENROUTER_API_KEY` to Vercel environment settings.
3. Push database schema via `npx drizzle-kit push`.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ERROR 3128256750` on server render | Missing DB env var or connection drop | Add `DATABASE_URL` or let `isLocalJsonDb` fallback run automatically. |
| Canvas export stripped photo | SVG foreignObject security restriction | Handled automatically via `/api/proxy-image` and `renderAssetDOMToBlob`. |
| Black margins on download | Render canvas mismatch | Handled automatically — export engine scales to 100% full-bleed aspect ratio. |
| Web scraping URL returns 500 | Target site anti-bot | Paste manual property brief fields in wizard fallback. |

---

**M & A — AI Real Estate Creative Studio**  
🌐 Live at: [https://creativearena.netlify.app/](https://creativearena.netlify.app/)
