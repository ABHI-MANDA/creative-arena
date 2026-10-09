# HTTP API Reference

All routes are same-origin Next.js App Router handlers located under `/api`. JSON request bodies require `Content-Type: application/json`. Dynamic `{id}` parameters are UUIDs unless otherwise noted.

> 🌐 **Live Website**: [M & A — AI Real Estate Creative Studio](https://creativearena.netlify.app/)  
> 🐳 **Docker Endpoint**: `http://localhost:3000/api`

---

## Endpoint Inventory

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Healthcheck, storage type (`local-json` / `neon-postgres`), and observability metrics |
| `GET` | `/api/models` | List configured OpenRouter text & copywriting models |
| `GET` | `/api/image-models` | List available Agnes AI and FLUX image generation models |
| `POST` | `/api/properties/scrape` | Scrape structured property briefs, pricing, amenities, and photos from listing URLs |
| `GET` | `/api/proxy-image` | Proxy external or scraped property images with CORS headers to prevent canvas tainting |
| `GET` | `/api/properties` | List all saved properties with cover thumbnails and Creative DNA status |
| `POST` | `/api/properties` | Create a new property from brief and photos, automatically analyzing its Creative DNA |
| `POST` | `/api/properties/{id}/analyze` | Recompute and save Creative DNA for an existing property |
| `GET` | `/api/campaigns` | List all campaign bundles with asset counts and QC scores |
| `POST` | `/api/campaigns` | Plan a new campaign for a property across 3 creative directions |
| `POST` | `/api/campaigns/{id}/prepare-content` | **Stage 3 Review**: Draft ad copy and visual prompt; pause pipeline for user approval |
| `POST` | `/api/campaigns/{id}/generate` | Generate campaign assets (Agnes AI imagery + copy) using approved content |
| `GET` | `/api/campaigns/{id}/export` | Download campaign ZIP package with images, storyboards, and `manifest.json` |
| `GET` | `/api/assets` | List all assets with campaign and property metadata |
| `PATCH` | `/api/assets/{id}` | Approve, unapprove, or regenerate an individual asset |
| `POST`, `GET` | `/api/assets/{id}/export` | Download a single high-resolution rendered asset (PNG/JPEG) |
| `POST` | `/api/assets/exports` | Batch store rendered creative assets |
| `GET`, `POST` | `/api/brand` | Retrieve or update brand guidelines, color palettes, and 11-point QC thresholds |
| `GET`, `PUT` | `/api/templates` | Retrieve or replace custom template library definitions |
| `GET` | `/api/admin/report` | Operational analytics report with JSON summary or CSV download |

---

## Detailed Endpoint Specifications

### 1. Health & Observability

#### `GET /api/health`
Verifies database connectivity and returns recent performance and network transfer metrics.

**Response (HTTP 200):**
```json
{
  "ok": true,
  "storage": "local-json",
  "metrics": {
    "byRequestCount": [
      { "name": "getBrand", "count": 14, "avgDurationMs": 0.4 },
      { "name": "listProperties", "count": 8, "avgDurationMs": 1.2 }
    ],
    "byEstimatedEgress": [
      { "name": "listProperties", "egressBytes": 3420 }
    ],
    "byTotalDuration": [
      { "name": "listProperties", "totalDurationMs": 9.6 }
    ]
  }
}
```

---

### 2. AI Model Discovery

#### `GET /api/models`
Discovers available OpenRouter AI models for prompt and copy generation.

**Response (HTTP 200):**
```json
{
  "configured": true,
  "default": "openai/gpt-4o",
  "models": [
    {
      "id": "openai/gpt-4o",
      "name": "GPT-4o (Flagship)",
      "contextLength": 128000
    },
    {
      "id": "openai/gpt-4o-mini",
      "name": "GPT-4o Mini (Fast)",
      "contextLength": 128000
    },
    {
      "id": "nvidia/nemotron-3-super-120b-a12b:free",
      "name": "Nemotron 3 Super 120B (Free)",
      "contextLength": 131072
    }
  ]
}
```

#### `GET /api/image-models`
Lists supported image generation models across Agnes AI and FLUX.

**Response (HTTP 200):**
```json
{
  "models": [
    {
      "id": "agnes-image-2.5-flash",
      "name": "Agnes Image 2.5 Flash (Recommended)",
      "description": "SOTA ultra-fast photorealistic architectural & real-estate image engine by Agnes AI.",
      "free": false
    },
    {
      "id": "black-forest-labs/FLUX.1-schnell:free",
      "name": "FLUX.1 Schnell — Free",
      "description": "Fast open-source photorealistic model (Apache 2.0). Best free option.",
      "free": true
    }
  ]
}
```

---

### 3. Property Web Scraper & Image Proxy

#### `POST /api/properties/scrape`
Scrapes listing web pages and extracts structured real estate specifications.

**Request:**
```json
{
  "url": "https://example-realestate.com/residences/skyline"
}
```

**Response (HTTP 200):**
```json
{
  "name": "Skyline Heights Residences",
  "location": "Hebbal, Bengaluru",
  "propertyType": "3 & 4 BHK Luxury Apartments",
  "price": "₹ 1.85 Cr onwards",
  "audience": "High-net-worth investors and modern families",
  "amenities": "Infinity Pool, Sky Lounge, Tennis Court, Private Gardens",
  "description": "Panoramic lake-facing luxury towers with world-class facilities.",
  "images": [
    { "url": "https://example-realestate.com/images/exterior.jpg", "label": "Exterior" }
  ]
}
```

#### `GET /api/proxy-image?url={encodedUrl}`
Proxies external images through the server with `Access-Control-Allow-Origin: *` headers, ensuring HTML5 canvas snapshots render cleanly without cross-origin tainting.

---

### 4. Content Review & Generation Pipeline

#### `POST /api/campaigns/{id}/prepare-content`
**Stage 3 Content Review**: Generates draft ad copy and a photorealistic visual prompt for user review before generating final creatives.

**Request:**
```json
{
  "directionId": "dir_golden_hour",
  "model": "auto"
}
```

**Response (HTTP 200):**
```json
{
  "ok": true,
  "content": {
    "developer": "Sobha Realty",
    "project": "Sobha Verde",
    "tagline": "WHERE LUXURY MEETS NATURE",
    "bhk": "3 & 4 BHK",
    "locationTag": "LUXURY RESIDENCES IN JLT",
    "amenitiesLine": "80% OPEN SPACES | 20 WORLD CLASS AMENITIES",
    "price": "₹ 1.85 CR* ONWARDS",
    "cta": "BOOK NOW",
    "imagePrompt": "Photorealistic high-end luxury residential tower facade during golden hour sunset, pristine infinity pool reflection, ultra-sharp architectural photography, 8k resolution, raw photo.",
    "captions": [
      "Experience elevated luxury living at Sobha Verde. Book your private tour today."
    ],
    "hashtags": [
      "#LuxuryRealEstate", "#SobhaVerde", "#LuxuryLiving", "#DreamHome"
    ]
  },
  "directionId": "dir_golden_hour",
  "directionName": "Golden Hour Cinema",
  "model": "openai/gpt-4o"
}
```

#### `POST /api/campaigns/{id}/generate`
Executes final asset generation. If `approvedContent` is provided, the engine strictly uses the user-approved copy and visual prompt to generate the Agnes AI imagery and typography layouts.

**Request:**
```json
{
  "directionId": "dir_golden_hour",
  "approvedContent": {
    "developer": "Sobha Realty",
    "project": "Sobha Verde",
    "tagline": "WHERE LUXURY MEETS NATURE",
    "bhk": "3 & 4 BHK",
    "locationTag": "LUXURY RESIDENCES IN JLT",
    "amenitiesLine": "80% OPEN SPACES | 20 WORLD CLASS AMENITIES",
    "price": "₹ 1.85 CR* ONWARDS",
    "cta": "BOOK NOW",
    "imagePrompt": "Photorealistic modern residential tower facade..."
  }
}
```

**Response (HTTP 200):**
```json
{
  "ok": true,
  "campaignId": "f7d3a012-4567-890a-bcde-f1234567890a",
  "generated": 8,
  "telemetry": {
    "durationMs": 4200,
    "model": "agnes-image-2.5-flash",
    "costCents": 3
  }
}
```

---

### 5. Deliverable Export & Downloads

#### `GET /api/campaigns/{id}/export`
Builds and downloads a complete campaign ZIP archive containing:
- High-definition rendered still ad images (PNG/JPEG).
- `storyboard.json` (15s and 30s reel scripts with audio directions).
- `captions.txt` & `hashtags.txt`.
- `manifest.json` describing the complete deliverable hierarchy.

---

### 6. Admin Telemetry & Reporting

#### `GET /api/admin/report`
Extracts filtered operational activity across properties, campaigns, assets, and AI generations.

**Query Parameters:**
- `from`: ISO timestamp start date.
- `to`: ISO timestamp end date.
- `type`: Record type (`property`, `campaign`, `asset`, `generation`).
- `status`: Execution status (`ready`, `failed`, `improving`).
- `format`: Output format (`json` or `csv`).
