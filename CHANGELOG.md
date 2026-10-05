# Changelog

Notable changes to M & A Creative Arena are recorded here.

## [1.2.0] - 2026-10-01

🌐 **Live Application**: [M & A — AI Real Estate Creative Studio](https://creativearena.netlify.app/)

### Added

- **Live Web Link Scraper (`/api/properties/scrape`)**: Instant property onboarding via listing URLs. Automatically extracts structured property briefs, pricing, location advantages, amenities, and high-resolution imagery.
- **Server-Side Image Proxy (`/api/proxy-image`)**: CORS-enabled proxy endpoint to safely fetch and inline external/scraped property photographs without browser canvas tainting or image blocking.
- **High-Definition DOM & Canvas Export Engine (`renderAssetDOMToBlob`)**: Complete export engine rendering pixel-exact 1080p PNG, JPEG, and ZIP campaign packages matching live UI preview cards with full background photo preservation and zero black margins.
- **Automatic DB Fallback Engine (`src/db/index.ts` & `src/db/queries.ts`)**: Automatic fallback to the local JSON database mode if `DATABASE_URL` is unconfigured or PostgreSQL connections drop during serverless cold-starts, preventing production SSR errors (`ERROR 3128256750`).
- **Netlify Production Deployment**: Configured full Netlify build support (`@netlify/plugin-nextjs`, secret scan overrides, environment variable configuration).

### Changed

- **Clean Ready-to-Post Creatives**: Completely removed top-left "M & A" text, brand logos, internal approval watermarks, and ratio pills from ad creative compositions. Output images are 100% clean and commercially usable.
- **1:1 Square Feed Default**: All social ad templates default to 1:1 square aspect ratios fitting frames seamlessly (`object-fit: cover`).
- **Documentation Overhaul**: Updated `README.md`, `README-API.md`, `README-DB.md`, `README-PROD.md`, and `CHANGELOG.md` with all recent features, API endpoints, and live production deployment details.

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

