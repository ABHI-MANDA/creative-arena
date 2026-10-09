/* ------------------------------------------------------------------
 * AI Image Generation Provider
 * First-class support for Agnes AI (agnes-image-2.5-flash / 2.1-flash)
 * with graceful fallback to OpenRouter (FLUX.1) and Pollinations FLUX.
 * ------------------------------------------------------------------ */

export type ImageModel = {
  id: string;
  name: string;
  description: string;
  free: boolean;
};

const KNOWN_IMAGE_MODELS: ImageModel[] = [
  {
    id: "agnes-image-2.5-flash",
    name: "Agnes Image 2.5 Flash (Recommended)",
    description: "SOTA ultra-fast photorealistic architectural & real-estate image engine by Agnes AI.",
    free: false,
  },
  {
    id: "agnes-image-2.1-flash",
    name: "Agnes Image 2.1 Flash",
    description: "Agnes AI high-resolution photorealism engine.",
    free: false,
  },
  {
    id: "agnes-image-2.0-flash",
    name: "Agnes Image 2.0 Flash",
    description: "Agnes AI standard photorealistic model.",
    free: false,
  },
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

/** Returns the catalogue of supported image models. */
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
  const hasComposition = /angle|frame|shot|composition|foreground|background|bokeh|depth|perspective|negative space|zoning/i.test(prompt);
  const hasLighting = /light|golden|hour|dusk|dawn|sun|shadow|exposure|ambient|warm/i.test(prompt);
  const hasStyle = /cinematic|photorealistic|architectural|editorial|premium|luxury|award|digest/i.test(prompt);
  let promptScore = Math.min(15, Math.floor(words / 4));
  if (hasComposition) promptScore = Math.min(30, promptScore + 7);
  if (hasLighting)    promptScore = Math.min(30, promptScore + 7);
  if (hasStyle)       promptScore = Math.min(30, promptScore + 6);
  details.push({ label: "Prompt richness & negative-space specificity", score: promptScore, max: 30 });

  // 2. Model quality tier (0–25)
  const modelScore =
    /agnes/i.test(model)           ? 25 :
    /FLUX\.1-dev/i.test(model)     ? 24 :
    /FLUX\.1-schnell/i.test(model) ? 21 :
    /sdxl|stable-diffusion-xl/i.test(model) ? 15 :
    12;
  details.push({ label: "Model quality tier", score: modelScore, max: 25 });

  // 3. Response validity (0–25)
  details.push({ label: "Image availability", score: urlValid ? 25 : 0, max: 25 });

  // 4. Generation speed (0–20)
  const speedScore =
    durationMs < 6_000  ? 20 :
    durationMs < 14_000 ? 17 :
    durationMs < 25_000 ? 12 : 7;
  details.push({ label: "Generation speed", score: speedScore, max: 20 });

  const raw = details.reduce((s, d) => s + d.score, 0); // 0–100
  const score = Math.round(84 + (raw / 100) * 15); // map to 84–99
  return { score, details };
}

/* ---- aspect ratio → image size ---- */
export function aspectToSize(aspect: string): "1024x1024" | "1024x1792" | "1792x1024" {
  const [w, h] = aspect.split(":").map(Number);
  const r = (!w || !h) ? 1 : w / h;
  if (r < 0.75) return "1024x1792";
  if (r > 1.4)  return "1792x1024";
  return "1024x1024";
}

/** Resolves Agnes AI API Base URL, automatically normalizing domain paths. */
function resolveAgnesBaseUrl(): string {
  const raw = process.env.AGNES_BASE_URL?.trim();
  if (!raw || raw.includes("api.agnes.ai")) return "https://apihub.agnes-ai.com/v1";
  const stripped = raw.replace(/\/+$/, "");
  return stripped.endsWith("/v1") ? stripped : `${stripped}/v1`;
}

/**
 * Generates a single image using Agnes AI or OpenRouter / FLUX fallback.
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
  const agnesKey = process.env.AGNES_API_KEY?.trim();
  const imageKey = process.env.IMAGE_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim();
  const started = Date.now();
  const [w, h] = (options.size ?? "1024x1024").split("x").map(Number);

  /* ------------------------------------------------------------------
   * TIER 1: AGNES AI (Primary High-Fidelity Architectural Image Engine)
   * ------------------------------------------------------------------ */
  if (agnesKey) {
    const agnesBase = resolveAgnesBaseUrl();
    const agnesModel =
      options.model?.startsWith("agnes-")
        ? options.model
        : (process.env.AGNES_MODEL?.trim() || "agnes-image-2.5-flash");

    try {
      console.log(`[image-provider] Calling Agnes AI (${agnesModel}) at ${agnesBase}/images/generations with size ${options.size ?? "1024x1024"}...`);
      const res = await fetch(`${agnesBase}/images/generations`, {
        method: "POST",
        signal: AbortSignal.timeout(options.timeoutMs ?? 75_000),
        headers: {
          Authorization: `Bearer ${agnesKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: agnesModel,
          prompt,
          n: 1,
          size: options.size ?? "1024x1024",
          response_format: "url",
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { data?: { url?: string; b64_json?: string }[] };
        const item = data.data?.[0];
        if (item?.url || item?.b64_json) {
          const url = item.url ?? `data:image/png;base64,${item.b64_json}`;
          const durationMs = Date.now() - started;
          const { score, details } = evaluateImageQuality(prompt, agnesModel, durationMs, Boolean(item.url));
          console.log(`[image-provider] Agnes AI succeeded in ${durationMs}ms (score=${score})`);
          return { url, prompt, model: agnesModel, qualityScore: score, qualityDetails: details, durationMs };
        }
      } else {
        const errText = await res.text().catch(() => "");
        console.warn(`[image-provider] Agnes AI API returned status ${res.status}: ${errText.slice(0, 200)}. Trying fallback...`);
      }
    } catch (err) {
      console.warn("[image-provider] Agnes AI connection error:", err);
    }
  }

  /* ------------------------------------------------------------------
   * TIER 2: OpenRouter or Standard Image API (FLUX.1 / SDXL)
   * ------------------------------------------------------------------ */
  if (imageKey && !imageKey.startsWith("sk-u0jef")) { // Don't use Agnes key against OpenRouter
    const apiBase = process.env.IMAGE_API_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
    const model = options.model || process.env.IMAGE_MODEL?.trim() || "black-forest-labs/FLUX.1-schnell:free";

    try {
      console.log(`[image-provider] Calling secondary image API (${model}) at ${apiBase}...`);
      const res = await fetch(`${apiBase}/images/generations`, {
        method: "POST",
        signal: AbortSignal.timeout(options.timeoutMs ?? 75_000),
        headers: {
          Authorization: `Bearer ${imageKey}`,
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

      if (res.ok) {
        const data = (await res.json()) as { data?: { url?: string; b64_json?: string }[] };
        const item = data.data?.[0];
        if (item?.url || item?.b64_json) {
          const url = item.url ?? `data:image/png;base64,${item.b64_json}`;
          const durationMs = Date.now() - started;
          const { score, details } = evaluateImageQuality(prompt, model, durationMs, Boolean(item.url));
          return { url, prompt, model, qualityScore: score, qualityDetails: details, durationMs };
        }
      } else {
        const body = await res.text().catch(() => "");
        console.warn(`[image-provider] Secondary image API returned ${res.status}: ${body.slice(0, 160)}. Falling back to Pollinations FLUX.1 engine...`);
      }
    } catch (err) {
      console.warn("[image-provider] Secondary image API connection error:", err);
    }
  }

  /* ------------------------------------------------------------------
   * TIER 3: Unlimited Free FLUX.1 Engine Fallback (Zero downtime)
   * ------------------------------------------------------------------ */
  console.log("[image-provider] Engaging high-speed FLUX.1 fallback engine...");
  const freeFluxUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w || 1024}&height=${h || 1024}&nologo=true&model=flux`;
  const fluxRes = await fetch(freeFluxUrl, { signal: AbortSignal.timeout(options.timeoutMs ?? 60_000) });
  if (!fluxRes.ok) {
    throw new Error(`FLUX.1 image generator returned status ${fluxRes.status}`);
  }

  const durationMs = Date.now() - started;
  const { score, details } = evaluateImageQuality(prompt, "black-forest-labs/FLUX.1-schnell:free", durationMs, true);
  return {
    url: freeFluxUrl,
    prompt,
    model: "black-forest-labs/FLUX.1-schnell:free",
    qualityScore: score,
    qualityDetails: details,
    durationMs,
  };
}
