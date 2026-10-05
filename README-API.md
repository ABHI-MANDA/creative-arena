# HTTP API Reference

All routes are same-origin Next.js App Router handlers under `/api`. JSON request bodies use `Content-Type: application/json`; file exports use `multipart/form-data`. Route handlers are dynamic and return JSON unless the endpoint explicitly downloads a file.

> 🌐 **Live Website**: [M & A — AI Real Estate Creative Studio](https://creativearena.netlify.app/)
> **Security:** This project currently has no authentication layer. Exposed write endpoints should be protected by an ingress/auth layer before public production launch.

## Endpoint Summary

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check database and file-store connectivity |
| `GET` | `/api/models` | Discover available free OpenRouter models |
| `POST` | `/api/properties/scrape` | Scrape structured property brief and images from listing URLs |
| `GET` | `/api/proxy-image` | Proxy external/scraped images with CORS headers |
| `GET`, `POST` | `/api/properties` | List properties or create one from brief & imagery |
| `POST` | `/api/properties/{id}/analyze` | Recompute and save property Creative DNA |
| `GET`, `POST` | `/api/campaigns` | List campaigns or plan a campaign for a property |
| `POST` | `/api/campaigns/{id}/generate` | Generate campaign assets and telemetry |
| `GET` | `/api/campaigns/{id}/export` | Download campaign ZIP package |
| `GET` | `/api/assets` | List assets with campaign and property metadata |
| `PATCH` | `/api/assets/{id}` | Approve, unapprove, or regenerate one asset |
| `POST`, `GET` | `/api/assets/{id}/export` | Persistent media storage download for PNG/JPEG |
| `POST` | `/api/assets/exports` | Batch store rendered PNG/JPEG files |
| `GET`, `POST` | `/api/brand` | Read or save brand settings and QC thresholds |
| `GET`, `PUT` | `/api/templates` | Read or replace template-library settings |
| `GET` | `/api/admin/report` | Operational analytics report and CSV export |

Dynamic `{id}` values are UUIDs unless otherwise noted. Errors return `{ "error": "..." }` with an appropriate HTTP status.

---

## Web Scraper & Image Proxy

### `POST /api/properties/scrape`

Scrapes structured property details, pricing, location advantages, amenities, and imagery directly from a listing web page.

**Request Body:**
```json
{
  "url": "https://example-realestate.com/project/green-valley"
}
```

**Response:**
```json
{
  "name": "Green Valley Residences",
  "location": "North Bengaluru",
  "propertyType": "3 BHK Luxury Apartments",
  "price": "₹1.45 Cr onwards",
  "audience": "Luxury homebuyers",
  "amenities": "Infinity Pool, Clubhouse, Private Gardens",
  "description": "Premium eco-friendly residential enclave...",
  "images": [
    { "url": "https://example-realestate.com/images/hero.jpg", "label": "Exterior" }
  ]
}
```

### `GET /api/proxy-image?url={encodedUrl}`

Proxies external, scraped, or stock property images with CORS-enabled headers (`Access-Control-Allow-Origin: *`). Prevents browser canvas tainting and image blocking during high-res PNG/JPEG creative export.

---

## Health and Model Discovery

### `GET /api/health`

Returns HTTP 200 when the active store is reachable:

```json
{ "ok": true }
```

When operating in local JSON fallback mode:

```json
{ "ok": true, "storage": "local-json" }
```

### `GET /api/models`

Discovers available OpenRouter AI models for prompt and copy generation. Returns `{ "configured": true, "models": [...] }` when `OPENROUTER_API_KEY` is set.

---

## Properties & Campaigns

### `GET /api/properties`
Returns an array of properties ordered newest first with cover images and Creative DNA status.

### `POST /api/properties`
Creates a new property and computes its Creative DNA. Accepts brief details and up to 12 images.

### `POST /api/properties/{id}/analyze`
Recomputes Creative DNA for a property.

### `GET /api/campaigns`
Lists all campaign bundles with cover thumbnails, QC scores, and asset counts.

### `POST /api/campaigns`
Plans a multi-platform campaign for a property across 3 creative directions.

### `POST /api/campaigns/{id}/generate`
Generates campaign assets (copy, stills, reel storyboards) and logs telemetry.

---

## Asset Management & Exports

### `GET /api/assets`
Lists all generated ad assets with campaign and property metadata.

### `PATCH /api/assets/{id}`
Approve, unapprove, or regenerate a specific asset.

### `GET /api/campaigns/{id}/export`
Builds a ZIP package containing high-resolution PNG ad images, reel storyboard JSON, and `manifest.json`. Supports client-side JSZip rendering for seamless production downloads.

---

## Admin & Telemetry

### `GET /api/admin/report`
Filters operational records (properties, campaigns, assets, AI generation events).
Query parameters: `from`, `to`, `type`, `status`, `q`, and `format=csv`.

