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
import { presetById } from "./presets";

export type ImagePromptSet = Record<string, string>; // kind → prompt
export type ImagePromptContext = {
  brandName?: string;
  brandColor?: string;
  brandTones?: string[];
  campaignPreset?: string;
  aspectRatio?: string;
  platform?: string;
  approvedImagePrompt?: string;
};

function aspectComposition(aspectRatio?: string): string {
  switch (aspectRatio) {
    case "9:16":
      return "vertical 9:16 portrait framing, building in the lower-middle 60%, clean upper 35% for headline and uncluttered bottom 12% for the white CTA ribbon";
    case "1:1":
      return "square 1:1 composition, building centred in the lower 60%, clean open upper 35% and clear bottom edge for overlaid copy and CTA";
    case "4:5":
      return "portrait 4:5 composition, building anchored in the lower-middle 60%, clean upper 35% and bottom edge reserved for overlaid copy and CTA";
    case "16:9":
      return "wide 16:9 advertising composition, property weighted to the right half with uncluttered visual space on the left and a clean lower edge for the CTA ribbon";
    default:
      return aspectRatio
        ? `compose for the exact ${aspectRatio} advertising aspect ratio, keep the property prominent and preserve uncluttered negative space for overlaid copy and CTA`
        : "compose with the property prominent and preserve uncluttered negative space for overlaid copy and CTA";
  }
}

function finishPrompt(prompt: string, aspectRatio?: string): string {
  const constraints = [
    aspectRatio ? aspectComposition(aspectRatio) : "",
    "Do not render text, letters, numbers, logos, signs, watermarks, or graphic overlays; use even natural exposure across the full frame, preserve visible shadow detail, and avoid vignettes, dark fades, black gradients, or crushed blacks",
    "Use only the supplied property facts and plausible architecture",
    "photorealistic premium real-estate advertising photography",
  ].filter(Boolean).join("; ");
  const cleanPrompt = prompt.trim().replace(/[.;,\s]+$/, "");
  return `${cleanPrompt}; ${constraints}`;
}

/* Compositional negative-space guidance per ad format */
const KIND_PHOTOGRAPHY: Record<string, string> = {
  hero:
    "strict advertising layout zoning: show the property's verified exterior architecture and only confirmed site features in the lower-middle 60%; never add pools, landscaping, or other amenities unless stated in the brief; upper 35-40% is clean, uncluttered sky or neutral negative space; preserve natural building proportions; establishing architectural lens",
  feature:
    "asymmetrical interior medium shot featuring one finish, room, or amenity explicitly confirmed in the brief; do not invent materials, fixtures, views, or amenities; keep the subject in the right 55% or lower half and preserve clean negative space on the left for callouts; natural architectural lens and realistic depth",
  location:
    "elevated but realistic perspective showing the property and only neighbourhood context or landmarks explicitly named in the brief; do not invent landmarks, travel times, or views; reserve the upper 45% for a clean horizon and negative space; natural perspective without distorted buildings",
  offer:
    "confident architectural hero perspective showing verified property features only; keep the top 35% and upper-left quadrant clean for separately overlaid verified offer copy; no invented discounts, amenities, structures, or signage; realistic building geometry",
  lifestyle:
    "editorial scene grounded only in the property's confirmed rooms, finishes, and amenities; do not add people, terraces, gardens, or objects not stated in the brief; keep the subject off-centre in the lower third and the upper half calm and uncluttered",
  story:
    "advertising composition adapted to the exact selected aspect ratio: keep verified architecture prominent, reserve clean upper negative space for the headline and a clear lower edge for the CTA ribbon; avoid cropping key property features",
  reel:
    "cinematic architectural perspective using only verified property features and materials; subtle foreground depth without invented foliage or structures; keep the upper third clean for separately overlaid titles; preserve straight, realistic building lines",
};

/* Photography style per creative direction */
const DIRECTION_STYLE: Record<string, string> = {
  "golden-hour-cinema":
    "warm late-afternoon sunlight, balanced amber highlights, champagne reflections, gentle interior warmth, premium cinematic atmosphere with open, detailed shadows and natural exposure",
  "bright-living-story":
    "clean crisp morning 5500K daylight, airy lifted whites, soft natural window bounce, sage green and travertine tones, minimal shadows, fresh approachable luxury feel",
  "form-and-structure":
    "sculptural architectural editorial, balanced monochrome and warm titanium tones, defined geometric shadows with visible detail, macro concrete and timber materiality, open shadow exposure",
};

function systemPrompt(context?: ImagePromptContext): string {
  const preset = context?.campaignPreset ? presetById(context.campaignPreset) : null;
  return [
    "You are an elite real-estate advertising art director and photography director.",
    "Write one technically precise, director-grade image-generation prompt for each requested ad format.",
    "CRITICAL ADVERTISING RULES:",
    "1. FACTUAL ACCURACY: Match the supplied property type, location, architecture, materials, and confirmed features. Never add amenities, views, construction details, or other claims that are not in the brief.",
    "2. COMPOSITION & SAFE ZONES: Follow the exact aspect-ratio composition instructions. Reserve clear, uncluttered negative space for the separately rendered ad copy; keep the property visible and undistorted.",
    "3. BRAND AND CAMPAIGN FIT: Reflect the supplied company identity, campaign objective, selected creative direction, verified palette, and lighting without adding logos or text.",
    "4. CLEAN CANVAS: Never generate text, typography, words, numbers, logos, banners, watermarks, or UI elements.",
    "5. DENSITY & DETAIL: Comprehensive, unconstrained photographic brief with specific camera, lighting, material, composition, and color-grade direction without word or character count limits.",
    "6. OUTPUT: Return strictly one valid JSON object mapping each requested kind key to a prompt string. No markdown fences or explanation.",
    context?.brandName ? `Company: ${context.brandName}.` : "",
    context?.brandColor ? `Brand color accent: ${context.brandColor}.` : "",
    context?.brandTones?.length ? `Brand voice: ${context.brandTones.join(", ")}.` : "",
    preset ? `Campaign preset: ${preset.label}. Objective: ${preset.objective}.` : "",
    context?.aspectRatio ? `Required aspect ratio: ${context.aspectRatio}.` : "",
    context?.platform ? `Placement: ${context.platform}.` : "",
  ].join(" ");
}

function userPrompt(brief: Brief, dna: DNA, direction: Direction, kinds: string[], context?: ImagePromptContext): string {
  const dirStyle = DIRECTION_STYLE[direction.id] ?? DIRECTION_STYLE["golden-hour-cinema"];
  const palette = [...new Set([...(direction.hex || []), ...((dna as { paletteHex?: string[] }).paletteHex || [])])];
  const preset = context?.campaignPreset ? presetById(context.campaignPreset) : null;

  return JSON.stringify({
    company: {
      name: context?.brandName,
      primaryColor: context?.brandColor,
      tones: context?.brandTones,
    },
    project: {
      name: brief.name,
      location: brief.location,
      propertyType: brief.propertyType,
      confirmedAmenities: dna.usps,
      architectureMaterials: dna.architecture,
      lightingAtmosphere: dna.lighting,
      audience: dna.audience,
    },
    campaign: preset ? { preset: preset.label, objective: preset.objective } : undefined,
    brandToneAndColorGrade: {
      directionName: direction.name,
      photographyStyle: dirStyle,
      brandPaletteHex: palette,
      colorGradingMood: direction.grade,
    },
    placement: {
      platform: context?.platform,
      aspectRatio: context?.aspectRatio,
      composition: aspectComposition(context?.aspectRatio),
    },
    approvedVisualDirection: context?.approvedImagePrompt,
    adFormatsNeeded: kinds,
    spatialZoningGuidancePerFormat: Object.fromEntries(
      kinds.filter((k) => KIND_PHOTOGRAPHY[k]).map((k) => [k, KIND_PHOTOGRAPHY[k]])
    ),
    instruction:
      "Write one unique, technically specific background-photo prompt per format. Treat approvedVisualDirection as user guidance, adapt it to the company, property facts, campaign, placement and exact aspect ratio. Typography and the white CTA ribbon are added by the ad layout, never render them into the image. Return JSON only.",
  });
}

function parsePromptSet(content: string, kinds: string[], context?: ImagePromptContext): ImagePromptSet | null {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const result: ImagePromptSet = {};
    for (const kind of kinds) {
      if (typeof parsed[kind] === "string" && (parsed[kind] as string).trim()) {
        result[kind] = finishPrompt((parsed[kind] as string).trim(), context?.aspectRatio);
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

function localFallbackPrompts(
  brief: Brief,
  dna: DNA,
  direction: Direction,
  kinds: string[],
  context?: ImagePromptContext
): ImagePromptSet {
  const dirStyle = DIRECTION_STYLE[direction.id] ?? DIRECTION_STYLE["golden-hour-cinema"];
  const palette = [...new Set([...(direction.hex || []), ...((dna as { paletteHex?: string[] }).paletteHex || [])])].join(", ");
  const preset = context?.campaignPreset ? presetById(context.campaignPreset) : null;
  const confirmedFeatures = dna.usps.length ? `Confirmed features: ${dna.usps.join(", ")}.` : "Do not introduce unconfirmed amenities or property claims.";
  const base = `${brief.propertyType} at ${brief.name}, ${brief.location}. ${dna.architecture}. ${confirmedFeatures} ${dna.lighting}. ${dirStyle}. ${direction.grade}. Brand ${context?.brandName || "identity"}; tones ${(context?.brandTones || []).join(", ") || dna.brandTone}; accent ${context?.brandColor || palette}. ${preset ? `${preset.label} campaign for ${preset.objective}.` : ""} ${context?.approvedImagePrompt || ""} ${aspectComposition(context?.aspectRatio)}. Premium photographic treatment, realistic materials, controlled lens perspective and natural depth.`;
  const set: ImagePromptSet = {};
  for (const kind of kinds) {
    const guide = KIND_PHOTOGRAPHY[kind] ?? "establishing exterior shot with clean negative space in upper third";
    set[kind] = finishPrompt(`${base} ${guide}`, context?.aspectRatio);
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
  modelOverride?: string | null,
  context?: ImagePromptContext
): Promise<WritePromptsResult> {
  const agnesKey = process.env.AGNES_API_KEY?.trim();
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const agnesBase = (process.env.AGNES_BASE_URL?.trim() || "https://apihub.agnes-ai.com/v1").replace(/\/+$/, "");

  const configuredModel =
    process.env.AGNES_TEXT_MODEL?.trim() ||
    (agnesKey ? "agnes-3.0-flash" : (process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o"));
  const primaryModel = modelOverride ?? configuredModel;

  if (!agnesKey && !openrouterKey) {
    return {
      prompts: localFallbackPrompts(brief, dna, direction, kinds, context),
      model: "local-prompt-writer-v1",
      fallback: true,
    };
  }

  // Model cascade: try primary, then robust fallbacks
  const candidateModels: string[] = [
    primaryModel,
    ...(agnesKey ? ["agnes-3.0-flash"] : []),
    "openai/gpt-4o-mini",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openrouter/free",
  ].filter((m, i, arr): m is string => Boolean(m && arr.indexOf(m) === i));

  for (const model of candidateModels) {
    const isAgnesModel = model.toLowerCase().startsWith("agnes-");
    const endpoint = isAgnesModel
      ? `${agnesBase}/chat/completions`
      : "https://openrouter.ai/api/v1/chat/completions";
    const apiKey = isAgnesModel ? (agnesKey || openrouterKey) : openrouterKey;
    if (!apiKey) continue;

    try {
      console.log(`[image-prompt-writer] Prompting '${model}' via ${endpoint}...`);
      const res = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(28_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.5,
          max_tokens: 3000,
          messages: [
            { role: "system", content: systemPrompt(context) },
            { role: "user", content: userPrompt(brief, dna, direction, kinds, context) },
          ],
        }),
      });

      if (!res.ok) {
        console.warn(`[image-prompt-writer] Model '${model}' on ${endpoint} returned ${res.status}. Trying next candidate...`);
        continue;
      }

      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content ?? "";
      const prompts = parsePromptSet(text, kinds, context);
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
    prompts: localFallbackPrompts(brief, dna, direction, kinds, context),
    model: "local-prompt-writer-v1 (fallback)",
    fallback: true,
  };
}
