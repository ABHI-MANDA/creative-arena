# HTTP API Reference

All routes are same-origin Next.js App Router handlers under `/api`. JSON request bodies should use `Content-Type: application/json`; file exports use `multipart/form-data`. Route handlers are dynamic and return JSON unless the endpoint explicitly downloads a file.

> **Security:** this project currently has no authentication or authorization layer. These routes must only be exposed to trusted users until access control is added.

## Endpoint Summary

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check database/file-store connectivity |
| `GET` | `/api/models` | Discover available free OpenRouter models |
| `GET`, `POST` | `/api/properties` | List properties or create one from a brief and images |
| `POST` | `/api/properties/{id}/analyze` | Recompute and save property Creative DNA |
| `GET`, `POST` | `/api/campaigns` | List campaigns or plan one for a property |
| `POST` | `/api/campaigns/{id}/generate` | Generate campaign assets and telemetry |
| `GET` | `/api/campaigns/{id}/export` | Download a campaign ZIP (local JSON mode only) |
| `GET` | `/api/assets` | List assets with campaign/property names |
| `PATCH` | `/api/assets/{id}` | Approve, unapprove, or regenerate one asset |
| `POST`, `GET` | `/api/assets/{id}/export` | Store/rendered-file download for PNG/JPEG (local JSON mode only) |
| `POST` | `/api/assets/exports` | Store a batch of PNG/JPEG files (local JSON mode only) |
| `GET`, `POST` | `/api/brand` | Read or save brand settings and QC thresholds |
| `GET`, `PUT` | `/api/templates` | Read or replace template-library settings |
| `GET` | `/api/admin/report` | Filter operational records or download CSV |

Dynamic `{id}` values are UUIDs unless otherwise noted. Errors generally use `{ "error": "..." }` with an appropriate 4xx/5xx status.

## Health and Model Discovery

### `GET /api/health`

Returns HTTP 200 when the active store is reachable:

```json
{ "ok": true }
```

Local JSON mode includes its storage type:

```json
{ "ok": true, "storage": "local-json" }
```

A failed connectivity check returns HTTP 500 with `{ "ok": false }`.

### `GET /api/models`

If `OPENROUTER_API_KEY` is missing, returns HTTP 200 with `configured: false`, an empty model list, and a configuration message. If provider discovery fails, returns HTTP 502. A successful response contains `configured: true` and a `models` array.

## Properties

### `GET /api/properties`

Returns a property summary array ordered newest first. Each item includes `id`, `name`, `location`, `propertyType`, `price`, `cover`, and `analyzed`.

### `POST /api/properties`

Creates a property and calculates Creative DNA. Required fields: `brief.name`, `brief.location`, `brief.propertyType`, `brief.price`, and at least one image. Up to 12 supplied images are used.

```json
{
  "brief": {
    "name": "Garden Residences",
    "location": "North Bengaluru",
    "propertyType": "3 BHK apartments",
    "price": "₹1.2 Cr onwards",
    "audience": "Premium family buyers",
    "amenities": "Clubhouse, gardens",
    "description": "A residential community near the technology corridor."
  },
  "images": [
    { "url": "/images/props/example.jpg", "label": "Exterior" }
  ],
  "source": "upload",
  "sourceUrl": ""
}
```

Returns `{ "id": "<property-uuid>" }`. Missing required brief fields or images returns HTTP 400.

### `POST /api/properties/{id}/analyze`

Recomputes the property's Creative DNA and sets its status to `analyzed`. Success response: `{ "ok": true, "dna": ... }`; an unknown property returns HTTP 404.

## Campaigns

### `GET /api/campaigns`

Returns campaign summaries, including the campaign record, property name/location, cover image, asset count, average score, and approved count.

### `POST /api/campaigns`

Required: `propertyId` and at least one `platforms` entry. Optional fields are `presetId` and `model`. The property must exist. The selected property's stored brief and DNA are used to plan directions.

```json
{
  "propertyId": "<property-uuid>",
  "presetId": "luxury-property",
  "platforms": ["ig-post", "ig-reel"],
  "model": "auto"
}
```

Returns `{ "id": "<campaign-uuid>", "directions": [...], "presets": <number> }`.

### `POST /api/campaigns/{id}/generate`

Optional body: `{ "directionId": "...", "model": "auto" }`. Generates/replaces the campaign's assets, stores its selected model, and logs activity. A specific model must currently be available as a free OpenRouter model. Success returns `{ "ok": true, "count": ..., "model": ..., "requestedModel": ..., "fallback": ..., "videoOutput": "storyboard-script" }`.

### `GET /api/campaigns/{id}/export`

Builds a ZIP containing still-image files, storyboards, and `manifest.json`. This route only works in local JSON mode; PostgreSQL mode returns HTTP 501. Still assets must first have stored PNG renders or the route returns HTTP 409. Reel assets contain storyboard JSON, not video files.

## Assets

### `GET /api/assets`

Returns assets augmented with `campaignName` and `propertyName`.

### `PATCH /api/assets/{id}`

Body uses one of these actions:

```json
{ "action": "approve" }
{ "action": "unapprove" }
{ "action": "regenerate" }
```

Unknown assets return HTTP 404; unknown actions return HTTP 400. Regeneration recomposes the asset and updates its QC results.

### `POST /api/assets/{id}/export`

Multipart fields: `file` (PNG/JPEG) and `format` (`png` or `jpeg`). Maximum individual file size is 20 MiB. Saves the rendered file and returns its bytes as an attachment. Only available in local JSON mode; otherwise returns HTTP 501.

### `GET /api/assets/{id}/export?format=png`

Downloads a previously stored PNG or JPEG. Missing exports return HTTP 404. Local JSON mode only.

### `POST /api/assets/exports`

Multipart fields: `items` (JSON array of `{ "assetId": "<uuid>", "format": "png" | "jpeg" }`) and repeated `files` fields in the same order. Supports 1–50 files, at most 20 MiB each and 100 MiB total. Returns `{ "stored": <count> }`. Local JSON mode only.

## Brand and Templates

### `GET`, `POST /api/brand`

`GET` returns stored brand settings merged with defaults. `POST` accepts a partial `BrandSettings` JSON object, saves the merged settings, and returns `{ "ok": true }`. QC thresholds are clamped by the handler; `review` is adjusted to remain below `ready`.

### `GET`, `PUT /api/templates`

`GET` returns the saved template library or defaults. `PUT` replaces it with a sanitized `enabledKinds` and `customTemplates` object and returns the stored library. Custom templates are limited to 30 entries; names/instructions are trimmed and length-limited by the route.

## Admin Report

### `GET /api/admin/report`

Returns filtered persisted property, campaign, asset, and generation records with summary totals. Query parameters:

| Parameter | Values | Meaning |
| --- | --- | --- |
| `from` | `YYYY-MM-DD` | Inclusive start date (UTC) |
| `to` | `YYYY-MM-DD` | Inclusive end date (UTC) |
| `type` | `all`, `property`, `campaign`, `asset`, `generation` | Record type filter |
| `status` | `all` or exact record status | Status filter |
| `q` | Text | Case-insensitive search through record name, property, details, type, and status |
| `format` | `csv` | Return a CSV attachment instead of JSON |

Example: `/api/admin/report?from=2026-09-01&to=2026-09-30&type=generation&status=failed`.

JSON shape:

```json
{
  "records": [],
  "totals": {
    "records": 0,
    "generations": 0,
    "failures": 0,
    "costCents": 0,
    "approvedAssets": 0
  }
}
```

Append `&format=csv` to download the same filtered records. The CSV includes IDs, timestamps, type, status, record name, property, insight, details, cost, duration, and approval state.
