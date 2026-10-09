/* ------------------------------------------------------------------
 * AI Image Prompt Writer
 * Uses OpenRouter (openai/gpt-4o or fallback) to write world-class,
 * photography-direction prompts for Agnes AI / FLUX image generation.
 *
 * Enforces key advertising design parameters:
 * 1. ZONING & NEGATIVE SPACE: Architectural subjects strictly anchored
 *    in the lower-middle frame, keeping upper 35-40% clear sky/ambient
 *    negative space so typography overlays never obscure facades or pools.
 * 2. PROJECT COLOR TONE MATCHING: Visuals strictly graded to project
 *    DNA color palette hexes, lighting mood, and architectural finishes.
 * 3. CLEAN BACKGROUND: Absolutely zero text, typography, or watermarks.
 * ------------------------------------------------------------------ */

import type { Brief, DNA, Direction } from "./engine";

export type ImagePromptSet = Record<string, string>; // kind → prompt

/* Compositional negative-space guidance per ad format */
const KIND_PHOTOGRAPHY: Record<string, string> = {
  hero:
    "strict advertising layout zoning: architectural facade, structure, and pool anchored strictly in the lower-middle 60% of frame; upper 35-40% kept as clean, uncluttered open sky with soft atmospheric gradient for headline typography overlay; no roof peaks, tall trees, or structures cutting into the upper third; establishing wide angle, 24mm architectural lens, award-winning real estate photography",
  feature:
    "asymmetrical interior medium shot: primary architectural feature (marble island, double-height glazing, custom joinery) anchored in the right 55% or lower half; left 45% and upper third kept as calm, softly blurred depth-of-field negative space with clean wall texture and ambient bounce light for feature callout cards; 35mm lens, f/2.8 bokeh separation",
  location:
    "elevated drone/high-angle perspective with property visible in lower half; upper 45% dedicated to calm, clean horizon and atmospheric sky with soft natural light; contextual surroundings visible without cluttering top negative space; 28mm tilt-shift perspective",
  offer:
    "dramatic architectural hero perspective with facade and pool anchored in bottom-right two-thirds; top 35% and upper-left quadrant reserved as clean, uncluttered gradient sky for prominent pricing and promotional badge overlay; high contrast between structure and negative space",
  lifestyle:
    "candid environmental scene inside or around private terrace or landscaped garden; lifestyle subject placed off-centre in lower third; upper half remains soft, clean, sunlit negative space with gentle bokeh; natural ambient daylight; 50mm editorial portraiture",
  story:
    "vertical 9:16 portrait composition: architectural subject framed in central 50% sweet-spot; upper 25% kept as clean open sky/ceiling negative space for headline; bottom 20% clean ground plane for CTA chip; 35mm vertical framing",
  reel:
    "dynamic diagonal architectural perspective: foreground motion element leading eye into architectural depth; clean upper third with open sky or clean ceiling line for video title overlay; 24mm cinematic wide shot, rich motion blur on foreground foliage",
};

/* Photography style per creative direction */
const DIRECTION_STYLE: Record<string, string> = {
  "golden-hour-cinema":
    "dusk golden-hour warm amber 2800K glow, champagne bokeh highlights, warm tungsten interior wash, film-grade cinematic halation, crushed charcoal blacks, luxury evening ambiance",
  "bright-living-story":
    "clean crisp morning 5500K daylight, airy lifted whites, soft natural window bounce, sage green and travertine tones, minimal shadows, fresh approachable luxury feel",
  "form-and-structure":
    "sculptural architectural editorial, high-contrast chiaroscuro, monochrome and warm titanium tones, sharp geometric shadow lines, macro concrete and timber materiality, matte blacks",
};

function systemPrompt(): string {
  return [
    "You are an elite real-estate advertising art director and photography director.",
    "Your objective: write one technically precise, director-grade image-generation prompt for each requested ad format.",
    "CRITICAL ADVERTISING RULES:",
    "1. COMPOSITION & SAFE ZONES: Ensure the architectural subject is anchored in the lower-middle 60% of the canvas. The upper 35-40% MUST be described as clean, open, uncluttered negative space (gradient sky, soft bokeh, or atmospheric haze) so typography overlays never obscure building facades, pools, or key architectural features.",
    "2. COLOR TONE MATCHING: The color grading, ambient bounce light, and atmosphere MUST strictly reflect the project's exact brand color palette, lighting atmosphere, and architectural materials provided in the brief.",
    "3. CLEAN CANVAS: Never generate text, typography, words, numbers, letters, logos, banners, watermarks, UI elements, or people's faces. Keep the photographic background clean and pristine.",
    "4. REALISM: Describe only plausible, premium architectural finishes and landscape features matching the brief.",
    "5. DENSITY: 50–85 words per prompt. Dense, visual, sensory, and technically specific (lens, lighting, focal depth, color grade, negative space).",
    "6. MUST APPEND TO EVERY PROMPT: ', no text, no words, no logos, no watermarks, photorealistic, 8K detail, architectural digest quality'",
    "7. OUTPUT: Return strictly one valid JSON object mapping kind keys to prompt strings: { hero?, feature?, location?, offer?, lifestyle?, story?, reel? }. No markdown fences, no explanation.",
  ].join(" ");
}

function userPrompt(brief: Brief, dna: DNA, direction: Direction, kinds: string[]): string {
  const dirStyle = DIRECTION_STYLE[direction.id] ?? DIRECTION_STYLE["golden-hour-cinema"];
  const palette = [...new Set([...(direction.hex || []), ...((dna as { paletteHex?: string[] }).paletteHex || [])])];

  return JSON.stringify({
    project: {
      name: brief.name,
      location: brief.location,
      propertyType: brief.propertyType,
      confirmedAmenities: dna.usps,
      architectureMaterials: dna.architecture,
      lightingAtmosphere: dna.lighting,
    },
    brandToneAndColorGrade: {
      directionName: direction.name,
      photographyStyle: dirStyle,
      brandPaletteHex: palette,
      colorGradingMood: direction.grade,
    },
    adFormatsNeeded: kinds,
    spatialZoningGuidancePerFormat: Object.fromEntries(
      kinds.filter((k) => KIND_PHOTOGRAPHY[k]).map((k) => [k, KIND_PHOTOGRAPHY[k]])
    ),
    instruction:
      "Write one unique, technically specific image prompt per format. Strictly observe negative-space zoning for text overlays and match the project color palette. Return JSON only.",
  });
}

function parsePromptSet(content: string, kinds: string[]): ImagePromptSet | null {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const result: ImagePromptSet = {};
    for (const kind of kinds) {
      if (typeof parsed[kind] === "string" && (parsed[kind] as string).trim()) {
        result[kind] = (parsed[kind] as string).trim().slice(0, 750);
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

function localFallbackPrompts(brief: Brief, dna: DNA, direction: Direction, kinds: string[]): ImagePromptSet {
  const dirStyle = DIRECTION_STYLE[direction.id] ?? DIRECTION_STYLE["golden-hour-cinema"];
  const palette = (direction.hex || []).join(", ");
  const base = `${dna.architecture.toLowerCase()} residential property in ${brief.location}, ${dirStyle}, color graded to ${palette}, ${dna.lighting}, premium architectural photography, no text, no words, no logos, no watermarks, photorealistic, 8K detail, architectural digest quality`;
  const set: ImagePromptSet = {};
  for (const kind of kinds) {
    const guide = KIND_PHOTOGRAPHY[kind] ?? "establishing exterior shot with clean negative space in upper third";
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
 * Calls OpenRouter to write director-grade, negative-space-aware image prompts.
 * Automatically tries primary model and cascade fallbacks before local templates.
 */
export async function writeImagePrompts(
  brief: Brief,
  dna: DNA,
  direction: Direction,
  kinds: string[],
  modelOverride?: string | null
): Promise<WritePromptsResult> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  const configuredModel = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o";
  const primaryModel = modelOverride ?? configuredModel;

  if (!key) {
    return {
      prompts: localFallbackPrompts(brief, dna, direction, kinds),
      model: "local-prompt-writer-v1",
      fallback: true,
    };
  }

  // Model cascade: try primary, then robust fallbacks
  const candidateModels = [
    primaryModel,
    "openai/gpt-4o-mini",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openrouter/free",
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  for (const model of candidateModels) {
    try {
      console.log(`[image-prompt-writer] Prompting OpenRouter with model '${model}'...`);
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(28_000),
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.5,
          max_tokens: 1600,
          messages: [
            { role: "system", content: systemPrompt() },
            { role: "user", content: userPrompt(brief, dna, direction, kinds) },
          ],
        }),
      });

      if (!res.ok) {
        console.warn(`[image-prompt-writer] Model '${model}' returned ${res.status}. Trying next candidate...`);
        continue;
      }

      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content ?? "";
      const prompts = parsePromptSet(text, kinds);
      if (prompts && Object.keys(prompts).length > 0) {
        console.log(`[image-prompt-writer] Successfully generated ${Object.keys(prompts).length} prompts with '${model}'`);
        return { prompts, model, fallback: false };
      }
    } catch (err) {
      console.warn(`[image-prompt-writer] Error calling '${model}':`, err);
    }
  }

  console.warn("[image-prompt-writer] All LLM models failed or timed out — applying local director templates.");
  return {
    prompts: localFallbackPrompts(brief, dna, direction, kinds),
    model: "local-prompt-writer-v1 (fallback)",
    fallback: true,
  };
}
