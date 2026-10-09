# Changelog

Notable changes to M & A Creative Arena are recorded here in chronological order.

---

## [1.4.0] - 2026-10-09

### Added
- **Multi-Stage Production Dockerfile**: Production-ready container build based on Node.js 22 Alpine (`node:22-alpine`) with unprivileged non-root user (`nextjs:1001`).
- **Next.js Standalone Optimization**: Enabled `output: "standalone"` in `next.config.ts`, slashing final Docker container content size down to **~83 MB**.
- **Docker Compose Orchestration (`docker-compose.yml`)**: Single-command startup with persistent Docker volume (`creative-arena-data:/app/.local-db`), automated restart policies, and healthcheck probing.
- **Container Healthcheck**: Configured automated container healthcheck pinging `/api/health` every 30 seconds.
- **Complete Docker Guide (`README-DOCKER.md`)**: Detailed documentation covering Docker Compose, Docker CLI, environment variable management, and volume backup/restore workflows.

---

## [1.3.0] - 2026-10-08

### Added
- **Content Review & Approval Pipeline Stage (`/api/campaigns/{id}/prepare-content`)**:
  - The image generation pipeline now explicitly halts after creative direction selection to wait for user approval before generating final imagery.
  - Interactive Review UI allows marketing teams to edit all ad typography: Developer / Brand Name, Project Headline, Tagline / Hook, Configuration / BHK Highlight, Typology & Location Tag, Key Amenities Line, Starting Price, and Button Text.
  - Editable AI Visual Prompt fed into Agnes AI / FLUX to fine-tune background architectural generation before final render.
  - Live interactive visual mock preview card updating in real-time as users type.
  - Added in-workspace **"Review & Edit Content"** modal (`ReviewContentModal.tsx`) allowing review and regeneration at any time.
- **In-Browser Graphic Editor (`CreativeEditorModal` & Fabric.js v7)**:
  - Direct visual manipulation of any creative deliverable using Fabric.js.
  - Users can move, scale, restyle, change fonts, recolor, and reorder typography and image layers directly in the browser.
- **Agnes AI & FLUX Image Generation Integration**:
  - Added Agnes AI engine (`agnes-image-2.5-flash`) for ultra-realistic luxury architectural imagery with fallback to OpenRouter FLUX (`FLUX.1-schnell:free` / `FLUX.1-dev:free`).
  - Strict negative prompt filters in `image-prompt-writer.ts` to ensure raw imagery is free of distorted text overlays, watermarks, or artifacts.
- **Database Egress & Compute Optimization Layer (`src/lib/cache.ts`)**:
  - In-memory LRU cache for high-frequency queries (`brand:settings`, `dashboard:stats`, `properties:list`), reducing Neon compute hours (CU-hrs) and egress bandwidth.
  - Observability tracker (`src/lib/observability.ts`) logging compute time, request counts, and estimated egress in `/api/health` and `/api/admin/report`.
- **8 Aspect Ratios (Ratio-Only Display)**:
  - Expanded aspect ratio selection across 8 dimensions: `9:16`, `1:1`, `4:5`, `16:9`, `1.91:1`, `4:3`, `3:4`, and `2:3`.
  - Removed platform names and post types across all UI selectors and templates.

### Changed
- **Eradication of Phone Numbers & Defaulting to "BOOK NOW"**:
  - Completely removed hardcoded `Call to : 1234567890` fallbacks from visual ad rendering, Fabric canvas exports, and fallback components.
  - All CTA buttons and call bars now default cleanly to **"BOOK NOW"**.
- **Removal of Aero Signs, Watermarks & Series Text**:
  - Removed aero signs (`↗`), watermark badges, `"ma-arena.studio"` text, and series label branding from all ad creative compositions and export bundles.

---

## [1.2.0] - 2026-10-01

### Added
- **Live Web Link Scraper (`/api/properties/scrape`)**: Instant property onboarding via listing URLs. Automatically extracts structured property briefs, pricing, location advantages, amenities, and high-resolution imagery.
- **Server-Side Image Proxy (`/api/proxy-image`)**: CORS-enabled proxy endpoint to safely fetch and inline external/scraped property photographs without browser canvas tainting or image blocking.
- **High-Definition DOM & Canvas Export Engine (`renderAssetDOMToBlob`)**: Complete export engine rendering pixel-exact 1080p PNG, JPEG, and ZIP campaign packages matching live UI preview cards with full background photo preservation and zero black margins.
- **Automatic DB Fallback Engine (`src/db/index.ts` & `src/db/queries.ts`)**: Automatic fallback to local JSON database mode if `DATABASE_URL` is unconfigured or PostgreSQL connections drop during serverless cold-starts.
- **Netlify Production Deployment**: Configured full Netlify build support (`@netlify/plugin-nextjs`, secret scan overrides, environment variable configuration).

### Changed
- **Clean Ready-to-Post Creatives**: Completely removed top-left "M & A" text, brand logos, internal approval watermarks, and ratio pills from ad creative compositions.
- **1:1 Square Feed Default**: All social ad templates default to 1:1 square aspect ratios fitting frames seamlessly.

---

## [1.1.0] - 2026-09-24

### Added
- Filterable Admin Console report with JSON summaries and CSV download for properties, campaigns, assets, and generation events.
- Persistent light/dark lighting mode with higher-contrast color tokens and green-gradient surfaces/actions.
- Property loading recovery for campaign creation, including stale deep-link selection handling and retry/error states.
- Separate production, API, and database guides.

### Changed
- Drizzle Kit configuration now loads `DATABASE_URL` from the environment instead of targeting a hard-coded local database.
- Root README organized as a project overview and documentation entry point.
