/* ------------------------------------------------------------------
 * AI Image Prompt Writer
 * Uses the LLM to write highly specific, photography-direction prompts
 * for each ad asset kind, tuned to the creative direction and platform.
 * Falls back to deterministic local templates.
 * ------------------------------------------------------------------ */

import type { Brief, DNA, Direction } from "./engine";

export type ImagePromptSet = Record<string, string>; // kind → prompt

/* Photography language per ad kind */
const KIND_PHOTOGRAPHY: Record<string, string> = {
  hero:      "wide establishing exterior shot, cinematic scale, strong leading lines drawing the eye to the façade, significant negative space in the upper third for headline overlay",
  feature:   "detailed interior medium shot, warm ambient soft-box lighting, curated lifestyle props visible, depth-of-field separation between foreground detail and background space",
  location:  "elevated neighbourhood aerial perspective, landmark landmarks in context, sense of urban or natural setting, clean horizon line",
  offer:     "bold architectural hero angle, single-subject composition, clear negative space in upper-left quadrant for price overlay, high contrast between subject and sky",
  lifestyle: "natural candid moment inside or around the property, soft sunlit window light, authentic lifestyle emotion, shallow depth-of-field",
  story:     "vertical portrait 9:16 composition, full-bleed property presence, single strong focal point centred, space at bottom for CTA chip",
  reel:      "dynamic diagonal angle, motion-suggesting foreground element, architectural depth and perspective, energy and drama",
};

/* Photography style per creative direction */
const DIRECTION_STYLE: Record<string, string> = {
  "golden-hour-cinema":  "dusk golden-hour warm amber light, champagne bokeh highlights, 24mm lens compression, cinematic halation on edges, crushed rich blacks, film-grade warmth",
  "bright-living-story": "clean midday window light, airy lifted whites, true-skin warmth, approachable lifestyle framing, sage and white tones, soft shadows",
  "form-and-structure":  "high-contrast architectural editorial, near-monochrome palette, hard geometry and negative space, macro material detail, matte blacks, sculptural framing",
};

function systemPrompt(): string {
  return [
    "You are a world-class real-estate advertising art director and photography director.",
    "Task: write one detailed, technically precise image-generation prompt per requested ad format.",
    "Rules:",
    "— Describe only real, plausible property features. Never invent rooms, amenities, distances, or finishes not mentioned in the brief.",
    "— Write for photorealistic AI image models (FLUX, SDXL). Be precise: focal length, aperture mood, lighting, colour grade, composition, foreground/background layers, atmosphere.",
    "— Include negative-space guidance where headline/price overlays will be placed.",
    "— Never include text, logos, watermarks, prices, UI elements, people's faces, or legally sensitive content.",
    "— Each prompt: 45–80 words. Dense, specific, visual.",
    "— Append to every prompt: ', no text, no logos, no watermarks, photorealistic, 8K detail'",
    "— Return exactly one valid JSON object with the requested kind keys: { hero?, feature?, location?, offer?, lifestyle?, story?, reel? }.",
    "— No commentary, markdown fences, or extra keys.",
  ].join(" ");
}

function userPrompt(brief: Brief, dna: DNA, direction: Direction, kinds: string[]): string {
  const dirStyle = DIRECTION_STYLE[direction.id] ?? DIRECTION_STYLE["golden-hour-cinema"];
  return JSON.stringify({
    property: {
      name: brief.name,
      location: brief.location,
      type: brief.propertyType,
      confirmedAmenities: dna.usps,
      architecture: dna.architecture,
      lighting: dna.lighting,
    },
    creativeDirection: {
      name: direction.name,
      photographyStyle: dirStyle,
      colourPalette: direction.hex,
      colourGrade: direction.grade,
    },
    adFormatsNeeded: kinds,
    photographyGuidePerFormat: Object.fromEntries(
      kinds.filter((k) => KIND_PHOTOGRAPHY[k]).map((k) => [k, KIND_PHOTOGRAPHY[k]])
    ),
    instruction: "Write one unique, technically specific image-generation prompt per ad format. Output JSON only.",
  });
}

function parsePromptSet(content: string, kinds: string[]): ImagePromptSet | null {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const result: ImagePromptSet = {};
    for (const kind of kinds) {
      if (typeof parsed[kind] === "string" && (parsed[kind] as string).trim()) {
        result[kind] = (parsed[kind] as string).trim().slice(0, 650);
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

function localFallbackPrompts(brief: Brief, dna: DNA, direction: Direction, kinds: string[]): ImagePromptSet {
  const dirStyle = DIRECTION_STYLE[direction.id] ?? DIRECTION_STYLE["golden-hour-cinema"];
  const base = `${dna.architecture.toLowerCase()} residential property in ${brief.location}, ${dirStyle}, premium architectural photography, no text, no logos, no watermarks, photorealistic, 8K detail`;
  const set: ImagePromptSet = {};
  for (const kind of kinds) {
    const guide = KIND_PHOTOGRAPHY[kind] ?? "establishing exterior shot";
    set[kind] = `${base}, ${guide}`;
  }
  return set;
}

export type WritePromptsResult = {
  prompts: ImagePromptSet;
  model: string;
  fallback: boolean;
};

/**
 * Calls the LLM to write optimised image-generation prompts for each ad kind.
 * Falls back to local deterministic templates on any failure.
 */
export async function writeImagePrompts(
  brief: Brief,
  dna: DNA,
  direction: Direction,
  kinds: string[],
  modelOverride?: string | null
): Promise<WritePromptsResult> {
  const key   = process.env.OPENROUTER_API_KEY?.trim();
  const model = modelOverride ?? process.env.OPENROUTER_MODEL?.trim() ?? "openai/gpt-4o-mini";

  if (!key || !model) {
    return {
      prompts: localFallbackPrompts(brief, dna, direction, kinds),
      model: "local-prompt-writer-v1",
      fallback: true,
    };
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(28_000),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.55,
        max_tokens: 1400,
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user",   content: userPrompt(brief, dna, direction, kinds) },
        ],
      }),
    });

    if (!res.ok) throw new Error(`OpenRouter returned ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    const prompts = parsePromptSet(text, kinds);
    if (!prompts) throw new Error("LLM returned invalid prompt JSON.");
    return { prompts, model, fallback: false };
  } catch (error) {
    console.warn("[image-prompt-writer] LLM call failed, using local templates:", error);
    return {
      prompts: localFallbackPrompts(brief, dna, direction, kinds),
      model: "local-prompt-writer-v1 (fallback)",
      fallback: true,
    };
  }
}
