# Changelog

Notable changes to M & A Creative Arena are recorded here in chronological order.

---

## [1.7.0] - 2026-11-10

### Added — Campaign Variation & Diversity Engine

- **`VariationSettings` Brand Schema Extension (`src/lib/creative/presets.ts`)**:
  - Added `VariationIntensity` type (`subtle` | `balanced` | `dynamic`) to control how strongly camera and lighting vary between generations.
  - Added `VisualPerspective` options with 5 curated vantage points: `hero-facade`, `twilight-glow`, `aerial-overview`, `terrace-sanctuary`, `macro-reflection`.
  - Added `TranscriptStyle` options: `cinematic`, `investment`, `lifestyle`, `launch` — each producing a distinct voiceover voice and narrative rhythm.
  - Added `VariationSettings` composite type with `intensity`, `allowedPerspectives`, `preferredTranscriptStyles`, `autoDiversifyAspects`, and `diversityThreshold` (default 85%).
  - Extended `BrandSettings` with `variationSettings`; `mergeBrandSettings` safely deserializes and defaults all new fields without requiring a database schema migration.
  - Added 3 dedicated diversity QC checks to `QC_CHECKLIST`: `"Visual perspective diversity"`, `"Narrative transcript freshness"`, and `"Aspect-ratio composition tailoring"`.

- **Multi-Angle Image Prompt Diversification (`src/lib/creative/image-prompt-writer.ts`)**:
  - Added tailored, property-accurate framing guidance for all 8 aspect ratios.
  - `approvedPromptSet` adds per-generation camera/lighting direction to user-approved prompts and applies aspect-specific framing when automatic per-format variation is enabled.
  - `userPrompt` includes the configured intensity, allowed perspectives, selected transcript style, variation seed, and per-aspect composition guide.
  - Variation changes viewpoint, framing, and photographic moment; it does not ask the image model to redesign the verified property.

- **Transcript & Voiceover Variation (`src/lib/creative/engine.ts`)**:
  - `presetCopy` upgraded with 4 full narrative style banks: `cinematic`, `investment`, `lifestyle`, `launch` — each containing campaign-preset-specific kicker, hero, sub, CTA, and hook variants.
  - `storyboardFor` now produces fully unique 15s and 30s voiceover transcripts per style: cinematic poetry, investor briefing tone, lifestyle warmth, or launch momentum — replacing the previous single-formula storyboard.
  - `tryLLMOverride` adopts dynamic LLM temperature: `subtle=0.45`, `balanced=0.68`, `dynamic=0.8`; injects `variationDirectives` and transcript voice rules into every content generation request.
  - `buildDraftAdContent` generates style-specific taglines and image-prompt atmospheric cues per the active narrative mode.
  - `qualityCheck` evaluates the 3 diversity-specific checklist items and applies the configurable diversity threshold to QC checks and readiness.
  - `composeAssets` threads `variationStyle` into `presetCopy` and `storyboardFor`, ensuring consistent narrative voice across all ad formats in a single campaign run.

- **Brand Kit Variation Controls (`src/app/brand/editor.tsx`)**:
  - New **Campaign Variation & Diversity Engine** section in the Brand Kit editor:
    - Variation intensity 3-way selector: `Subtle` (safe, on-brand), `Balanced` (default), `Dynamic` (bold, exploratory).
    - Allowed visual perspective vantage points toggle grid — select which of the 5 camera angles the pipeline can assign automatically.
    - Preferred transcript & script style toggle grid — restrict or expand narrative voice modes.
    - Auto-diversify across aspect ratios checkbox (enabled by default).
  - New **Diversity & Freshness Gate** slider (70%–98%, default 85%) in the Quality Gates section.
  - Gate-behaviour preview panel shows "Diversity below X% → Flagged for Variety" alongside existing Ready/Review/Auto-Improve rules.

- **QC Panel Diversity Audit (`src/components/quality.tsx`)**:
  - Added **Diversity & Variation Gate** audit card at the top of the QC panel showing `N/3 Verified` checks and the configured diversity threshold.
  - Diversity-specific checklist items are tagged with a gold `Variety` badge to visually distinguish them from core brand QC checks.

- **1-Click Variation Controls in Review Modal (`src/components/campaigns/ReviewContentModal.tsx`)**:
  - **Auto-Variation & Script Style selector bar** with buttons limited to transcript styles enabled in the Brand Kit.
  - Drafts automatically choose an enabled style and per-generation visual seed; **Shuffle Variations** selects a different enabled style when possible and refreshes the visual seed.
  - **Video Reel Transcript Voiceover preview card** showing the current narration lines live so users can judge the script tone before approving.
  - Multi-angle aspect diversification status indicator confirming automated perspective assignment is active.

- **Campaign & API Integration**:
  - `prepare-content` route: automatically selects an enabled `variationStyle`, accepts an optional variation seed, and returns the available styles to the review UI.
  - `generate` route: reuses the approved variation seed and Brand Kit settings across copy, image prompts, and QC.
  - `brand` route: persists `diversity` threshold alongside ready/review thresholds.

### Fixed

- **Repetitive Image Generation Root Cause**: Previously approved prompts received little variation beyond aspect ratio. Prompts now combine aspect-aware framing with Brand Kit-selected perspectives and a fresh per-generation photographic moment, while keeping the property's architecture and facts intact.
- **Repetitive Transcript Root Cause**: Previously `storyboardFor` was hardcoded to 5 static template strings (`copy.hook`, `${brief.name}, ${brief.location}`, `Explore...`, `amenityList`, `cta`) making every video storyboard identical. Fixed with 4 fully distinct voiceover script banks (short 15s / long 30s each).
- **TypeScript Errors**: Resolved `TS2322` on `prepareReview` MouseEventHandler mismatch and `TS2353` missing `diversityScore` on `QCResult` interface.

---

## [1.6.0] - 2026-11-02

### Added
- **Enterprise Security & Privacy Suite ([`secury.md`](./secury.md) / [`SECURITY.md`](./SECURITY.md))**:
  - **Level-3 Content Security Policy (CSP)**: Enforces `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, strict script/style/font origins, and worker isolation.
  - **HTTP Strict Transport Security (HSTS)**: 2-year duration (`max-age=63072000; includeSubDomains; preload`) mitigating SSL-stripping and MITM downgrade attacks.
  - **Cross-Origin Opener Policy (COOP)**: Set to `same-origin` to isolate top-level browsing contexts from Spectre attacks and window-opener tampering.
  - **Hardware & Ambient Privacy (Permissions-Policy)**: Zero hardware access (`camera=(), microphone=(), geolocation=(), payment=()`) and explicit opt-out from behavioral tracking (`browsing-topics=()`).
  - **Clickjacking & MIME Protection**: Sealed with `X-Frame-Options: SAMEORIGIN` and `X-Content-Type-Options: nosniff`.
  - **Referrer Privacy**: Set to `strict-origin-when-cross-origin` to prevent campaign tokens or internal paths from leaking cross-origin.
  - **Server-Side Asset Proxy Hardening**: Extended `/api/proxy-image` with aggressive edge cache headers (`public, max-age=604800, stale-while-revalidate=2592000, immutable`) and header sanitization.
- **100% Core Web Vitals & Image Optimization**:
  - **Next.js Responsive `<Image />` Integration**: Migrated asset and property cards to `<Image fill sizes="..." />` with responsive breakpoints, cutting image payload sizes by up to 90% (saving >1,000 KiB on initial load).
  - **Immutable Edge Caching for Images**: Added 1-year immutable cache headers for `/_next/image` optimizing repeat visits and LCP scores.
  - **GPU-Composited Animations**: Replaced paint-heavy `box-shadow` `.pulse-dot` animations with hardware-accelerated `transform` and `opacity` keyframes.
  - **Zero-CLS Typography**: Enforced `display: "swap"` across all Google Fonts (Fraunces, Inter, IBM Plex Mono) to eliminate layout shifts.
- **Accessibility & Agentic Browsing (WCAG 2.1 AA Compliance)**:
  - Added explicit, descriptive `aria-label` attributes and `.sr-only` context across all icon buttons, quick actions, view triggers, and external navigation links.
- **Architectural DNA Extraction & Prompt Alignment**:
  - Upgraded property onboarding and Creative DNA analysis to extract specific architectural styles, facade geometry, fenestration, building materials, and landscaping.
  - Enforced reviewed-prompt priority in Agnes AI and FLUX pipelines to eliminate repetitive generic building imagery.
- **Ad-Scrim Controls & Typographic Model Kit**:
  - Added interactive ad-scrim controls in the creative editor and line-by-line typographic styling controls for precise ad customization.

### Fixed
- **React 19 Pre-Hydration Theme Script Warning**: Migrated inline theme initializer to Next.js `next/script` with `strategy="beforeInteractive"` and unique ID `theme-init`.
- **Campaign Approval & State Persistence**: Fixed instant state updating when approving campaigns and synchronized regenerate action flow.

---

## [1.5.1] - 2026-10-21

### Changed
- **Approved Image Prompt Has Priority**: The image prompt edited and approved during review is passed directly to the image provider. Automatic prompt rewriting and appended composition/architecture guidance are skipped for approved prompts.
- **Campaign-Specific Architecture Guidance**: Prompts without a user-approved visual directive receive deterministic campaign-specific massing, facade, balcony, and roofline guidance. This encourages variation but does not guarantee unique generated images.
- **No Silent Uploaded-Photo Substitution**: Campaign image-generation failures now surface as errors rather than silently using the same uploaded exterior photograph.
- **Sky-Blue Default Image Scrim**: New creatives use `#3492c9` as the default scrim color; existing saved custom settings are retained.

### Added
- **Actual Image Provider Visibility**: Generated assets store the image model that returned them, and the campaign workspace displays that model with the saved generation prompt and quality score.
- **Wide Creative Layering Improvements**: Improved wide-format image scrim layering and added the location line to the wide layout.

---

## [1.5.0] - 2026-10-10

### Added
- **Agnes 3.0 Flash for Content Writing (`agnes-3.0-flash`)**:
  - Wired native Agnes AI chat completions endpoint (`https://apihub.agnes-ai.com/v1/chat/completions`) using `agnes-3.0-flash` for high-precision real-estate copywriting, headline generation, storyboards, and photography prompt engineering.
  - Added `agnes-3.0-flash` as the #1 recommended model in model discovery and resolution catalogs.
- **Agnes Image 2.1 Flash for Image Generation (`agnes-image-2.1-flash`)**:
  - Configured `agnes-image-2.1-flash` as the primary recommended engine for architectural and property visual generation.
  - Implemented automatic case-insensitive model normalization (e.g. `Agnes-Image-2.1-Flash` $\to$ `agnes-image-2.1-flash`).

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
