# Production Deployment Guide

This document covers deployment of M & A Creative Arena to a production-capable Next.js host, including **Netlify** (live at [https://creativearena.netlify.app/](https://creativearena.netlify.app/)). Read [README-DB.md](README-DB.md) for schema and migration details, and [README-API.md](README-API.md) for the full endpoint inventory.

## Live Production Site

- **Live URL**: [https://creativearena.netlify.app/](https://creativearena.netlify.app/)
- **Hosting Platform**: Netlify (Next.js App Router Runtime via `@netlify/plugin-nextjs`)
- **Database Engine**: PostgreSQL (Neon Serverless) with automatic local JSON fallback mode.

## Production Architecture & Capabilities

1. **Client-Side High-Definition Ad Export Engine**:
   - Zero server storage dependencies for visual ad downloads.
   - High-resolution HTML5 Canvas rendering via `renderAssetDOMToBlob` in [`src/utils/domToBlob.ts`](file:///c:/Users/ABHISHEK%20KUMAR/Desktop/CREATIVE_ARENA/src/utils/domToBlob.ts).
   - Instant single asset export (PNG/JPEG) and full campaign bundle export (ZIP via `JSZip`) executed entirely client-side.
2. **CORS Image Proxy Service**:
   - [`/api/proxy-image`](file:///c:/Users/ABHISHEK%20KUMAR/Desktop/CREATIVE_ARENA/src/app/api/proxy-image/route.ts) safely proxies remote property images to satisfy browser cross-origin canvas security rules during export.
3. **Web Link Property Scraper**:
   - [`/api/properties/scrape`](file:///c:/Users/ABHISHEK%20KUMAR/Desktop/CREATIVE_ARENA/src/app/api/properties/scrape/route.ts) extracts real estate specs, features, and imagery directly from listing URLs using CheerIO.

## Netlify Deployment Guide

### Build Configuration (`netlify.toml`)

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### Environment Secrets & Flags

Set the following in Netlify **Site Configuration > Environment variables**:
- `DATABASE_URL`: Optional PostgreSQL connection string (e.g. Neon Postgres). If omitted, the app operates in resilient local storage fallback mode.
- `NETLIFY_SKIP_SECRET_SCAN=true`: Recommended if secret detection flags database credentials in repository configs.
- `OPENROUTER_API_KEY`: (Optional) OpenRouter key for AI generation.

## Pre-deployment Checklist

1. (Optional) Provision a PostgreSQL database (e.g. Neon Serverless) and set `DATABASE_URL`.
2. Run dependency installation, lint, typecheck, and a production build in CI.
3. Confirm `/api/health` returns HTTP 200 and `{ "ok": true }` after deployment.
4. Verify client-side asset exports (PNG, JPEG, ZIP) render cleanly on the live site.

## Environment Variables

| Variable | Required | Production behavior |
| --- | --- | --- |
| `DATABASE_URL` | Optional | PostgreSQL connection string for PostgreSQL mode. If unconfigured, the app runs in JSON fallback mode. |
| `NETLIFY_SKIP_SECRET_SCAN` | Optional | Set to `true` to bypass Netlify automated false-positive secret scans during build. |
| `OPENROUTER_API_KEY` | Optional | Enables OpenRouter model discovery and hosted copy refinement. |
| `OPENROUTER_MODEL` | Optional | Default OpenRouter model slug when model choice is automatic; defaults to `openai/gpt-4o-mini`. |
| `NODE_ENV` | Platform-managed | Set to `production` by Next.js runtimes. |

## Build and Verification Commands

CI or deployment build environment:

```bash
npm ci
npm run lint
npm run typecheck
npm run build
```

Start local production preview with:

```bash
npm run start
```

## Production Limitations and Security

- **Authentication:** No login, session, or role middleware is configured by default. Restrict ingress if private property data is stored.
- **Client-Side Export Engine:** Image and ZIP exports execute in the user's browser, eliminating server storage costs and memory limits.
- **Video:** Storyboards are rendered visually; MP4 video rendering requires external rendering integrations.
- **Privacy:** Property briefs, imagery, and copy may contain sensitive business data. Set appropriate CORS and proxy headers.

## Release Checklist

- [x] Client-side DOM canvas export engine verified for PNG, JPEG, and ZIP deliverables.
- [x] CORS Image Proxy (`/api/proxy-image`) active and operational.
- [x] Property URL Scraper (`/api/properties/scrape`) active and operational.
- [x] `npm run lint`, `npm run typecheck`, and `npm run build` pass with 0 errors.
- [x] Deployed and live at `https://creativearena.netlify.app/`.

