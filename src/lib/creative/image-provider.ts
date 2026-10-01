/* ------------------------------------------------------------------
 * AI Image Generation Provider
 * Calls OpenRouter-compatible image generation APIs (FLUX, SDXL, etc.)
 * Falls back gracefully — callers must handle thrown errors.
 * ------------------------------------------------------------------ */

export type ImageModel = {
  id: string;
  name: string;
  description: string;
  free: boolean;
};

const KNOWN_IMAGE_MODELS: ImageModel[] = [
  {
    id: "black-forest-labs/FLUX.1-schnell:free",
    name: "FLUX.1 Schnell — Free",
    description: "Fast open-source photorealistic model (Apache 2.0). Best free option.",
    free: true,
  },
  {
    id: "black-forest-labs/FLUX.1-dev:free",
    name: "FLUX.1 Dev — Free",
    description: "Highest quality FLUX variant. Slower but sharper.",
    free: true,
  },
  {
    id: "stabilityai/stable-diffusion-xl-base-1.0",
    name: "Stable Diffusion XL",
    description: "Open-source SDXL baseline. Reliable fallback.",
    free: true,
  },
];

/** Returns the catalogue of supported image models (fixes the route.ts import error). */
export function listImageModels(): ImageModel[] {
  return KNOWN_IMAGE_MODELS;
}

export type QualityDetail = { label: string; score: number; max: number };

export type GeneratedImage = {
  url: string;
  prompt: string;
  model: string;
  qualityScore: number;  // 82–99 range, same as QC convention
  qualityDetails: QualityDetail[];
  durationMs: number;
};

/* ---- internal quality evaluator ---- */
function evaluateImageQuality(
  prompt: string,
  model: string,
  durationMs: number,
  urlValid: boolean
): { score: number; details: QualityDetail[] } {
  const details: QualityDetail[] = [];

  // 1. Prompt richness (0–30)
  const words = prompt.trim().split(/\s+/).length;
  const hasComposition = /angle|frame|shot|composition|foreground|background|bokeh|depth|perspective/i.test(prompt);
  const hasLighting = /light|golden|hour|dusk|dawn|sun|shadow|exposure|ambient/i.test(prompt);
  const hasStyle = /cinematic|photorealistic|architectural|editorial|premium|luxury|award/i.test(prompt);
  let promptScore = Math.min(15, Math.floor(words / 4));
  if (hasComposition) promptScore = Math.min(30, promptScore + 7);
  if (hasLighting)    promptScore = Math.min(30, promptScore + 7);
  if (hasStyle)       promptScore = Math.min(30, promptScore + 6);
  details.push({ label: "Prompt richness & specificity", score: promptScore, max: 30 });

  // 2. Model quality tier (0–25)
  const modelScore =
    /FLUX\.1-dev/i.test(model)    ? 25 :
    /FLUX\.1-schnell/i.test(model) ? 21 :
    /sdxl|stable-diffusion-xl/i.test(model) ? 15 :
    12;
  details.push({ label: "Model quality tier", score: modelScore, max: 25 });

  // 3. Response validity (0–25)
  details.push({ label: "Image availability", score: urlValid ? 25 : 0, max: 25 });

  // 4. Generation speed (0–20)
  const speedScore =
    durationMs < 5_000  ? 20 :
    durationMs < 12_000 ? 15 :
    durationMs < 25_000 ? 10 : 5;
  details.push({ label: "Generation speed", score: speedScore, max: 20 });

  const raw = details.reduce((s, d) => s + d.score, 0); // 0–100
  const score = Math.round(82 + (raw / 100) * 17); // map to 82–99
  return { score, details };
}

/* ---- aspect ratio → image size ---- */
export function aspectToSize(aspect: string): "1024x1024" | "1024x1792" | "1792x1024" {
  const [w, h] = aspect.split(":").map(Number);
  const r = (!w || !h) ? 1 : w / h;
  if (r < 0.75) return "1024x1792";
  if (r > 1.5)  return "1792x1024";
  return "1024x1024";
}

/**
 * Generates a single image using the configured image model.
 * Throws on any API / network error — callers should catch and fall back.
 */
export async function generateAdImage(
  prompt: string,
  options: {
    model?: string;
    size?: "1024x1024" | "1024x1792" | "1792x1024";
    timeoutMs?: number;
  } = {}
): Promise<GeneratedImage> {
  const apiBase = process.env.IMAGE_API_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
  const apiKey  = process.env.IMAGE_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim();
  const model   = options.model || process.env.IMAGE_MODEL?.trim() || "black-forest-labs/FLUX.1-schnell:free";

  if (!apiKey) throw new Error("IMAGE_API_KEY / OPENROUTER_API_KEY is not configured.");

  const started = Date.now();

  const res = await fetch(`${apiBase}/images/generations`, {
    method: "POST",
    signal: AbortSignal.timeout(options.timeoutMs ?? 90_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: options.size ?? "1024x1024",
      response_format: "url",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Image generation API returned ${res.status}: ${body.slice(0, 240)}`);
  }

  const data = (await res.json()) as { data?: { url?: string; b64_json?: string }[] };
  const item = data.data?.[0];
  if (!item?.url && !item?.b64_json) {
    throw new Error("Image generation API returned no image data.");
  }

  const url = item.url ?? `data:image/png;base64,${item.b64_json}`;
  const durationMs = Date.now() - started;
  const { score, details } = evaluateImageQuality(prompt, model, durationMs, Boolean(item.url));

  return { url, prompt, model, qualityScore: score, qualityDetails: details, durationMs };
}
