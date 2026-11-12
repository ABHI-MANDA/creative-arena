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
import {
  DEFAULT_VARIATION_SETTINGS,
  presetById,
  type VariationSettings,
  type VisualPerspective,
} from "./presets";

export type ImagePromptSet = Record<string, string>; // kind → prompt
export type ImagePromptContext = {
  brandName?: string;
  brandColor?: string;
  brandTones?: string[];
  campaignPreset?: string;
  aspectRatio?: string;
  platform?: string;
  approvedImagePrompt?: string;
  referenceWebsite?: string;
  campaignId?: string;
  variationSettings?: VariationSettings;
  variationStyle?: string;
  variationSeed?: string;
  variationIndex?: number;
};

function aspectComposition(aspectRatio?: string): string {
  switch (aspectRatio) {
    case "9:16":
      return "vertical 9:16 architectural composition emphasizing the verified facade and proportions, property occupying the lower-middle 60%, pristine upper 38% reserved for typography, clean lower 12% for the white CTA ribbon";
    case "1:1":
      return "balanced square 1:1 architectural portrait using the verified facade or entrance, building centred in the lower 60%, clean open upper 35% negative space for the headline";
    case "4:5":
      return "portrait 4:5 three-quarter architectural perspective that preserves the verified facade, lower-middle 60% property anchor, clean upper 35% sky or neutral space for copy";
    case "16:9":
      return "cinematic 16:9 wide-angle composition, property contextualized only within its verified setting, negative space distributed across the upper-left for titles and a clean lower-right";
    case "4:3":
      return "classic 4:3 architectural editorial that preserves the property's real proportions, with clean upper 35% negative space for the brand header";
    case "3:2":
      return "horizontal 3:2 medium-telephoto architectural view, crisp verified structural lines, upper 35% negative space";
    case "2:3":
      return "editorial 2:3 vertical composition focused on the verified facade and materials, with clean upper 35% sky or neutral space";
    case "21:9":
      return "ultra-wide 21:9 cinematic vista, expansive horizon and verified property setting, structural composition weighted to the right";
    default:
      return aspectRatio
        ? `compose for the exact ${aspectRatio} advertising aspect ratio, keep the property prominent and preserve uncluttered negative space in upper 35-40% for overlaid copy and CTA`
        : "compose with the property prominent and preserve uncluttered negative space in upper 35-40% for overlaid copy and CTA";
  }
}

function getReferenceWebsite(context?: ImagePromptContext): string | undefined {
  const suppliedWebsite = context?.referenceWebsite?.trim();
  if (suppliedWebsite) return suppliedWebsite;
  return context?.approvedImagePrompt
    ?.match(/https?:\/\/\S+/i)?.[0]
    ?.replace(/[),.;!?]+$/, "");
}

const PERSPECTIVE_GUIDES: Record<VisualPerspective, string> = {
  "hero-facade":
    "photograph the verified facade from a confident low three-quarter viewpoint, emphasizing its real proportions and entrance",
  "twilight-glow":
    "use a blue-hour viewpoint with natural ambient light and balanced detail in the verified facade and shadows",
  "aerial-overview":
    "use an elevated oblique establishing viewpoint to show the property's verified setting without adding unconfirmed surroundings",
  "terrace-sanctuary":
    "use a calm eye-level viewpoint from a confirmed terrace or balcony; if none is described, frame the verified facade at eye level instead",
  "macro-reflection":
    "use a close architectural detail of confirmed materials or a confirmed water feature; do not add pools or materials absent from the property facts",
};

const PHOTO_MOMENTS: Record<string, string[]> = {
  cinematic: [
    "capture warm late-afternoon sidelight with restrained highlights and visible facade detail",
    "capture the transition into blue hour with the facade and ambient sky both clearly exposed",
    "capture a calm, softly lit architectural moment with gentle reflections and open shadows",
  ],
  investment: [
    "capture clear daylight that reveals the verified facade and surrounding context without exaggeration",
    "capture a crisp morning moment with neutral materials and well-defined architectural lines",
    "capture a softly overcast daylight moment with even exposure and open shadows",
  ],
  lifestyle: [
    "capture a bright, gentle morning moment with soft natural light and relaxed residential warmth",
    "capture late-afternoon light falling softly across the verified living spaces and facade",
    "capture an airy daylight moment with natural color and calm, open shadows",
  ],
  launch: [
    "capture a dramatic but realistic twilight reveal with the facade and ambient sky clearly exposed",
    "capture a crisp daylight hero moment with clean architectural detail",
    "capture warm late-afternoon sidelight for a confident, polished launch image",
  ],
};

const KIND_ORDER = ["hero", "feature", "location", "offer", "lifestyle", "story", "reel"];

const CAMERA_TREATMENTS = [
  "a centered, straight-on eye-level architectural view with precise vertical lines",
  "a low three-quarter corner view that reveals the facade's depth and entrance",
  "an elevated oblique view that shows only the verified building and its confirmed setting",
  "an asymmetrical medium-wide view with the property weighted to one side and clean overlay-safe space",
  "a restrained telephoto view compressing the facade's layers while keeping the property recognizable",
  "a wide establishing view with corrected verticals and generous environmental context",
];

const EXTERIOR_IMAGE_PROMPT_VARIATIONS = [
  "Create a formal, symmetrical front elevation in clear neutral daylight, emphasizing the verified facade and precise architectural lines.",
  "Create a dramatic low three-quarter view in warm late-afternoon sidelight, showing the verified building's depth without distorting its proportions.",
  "Create a refined blue-hour architectural portrait with a natural dusk sky and realistic exposure; do not add lights or illuminated features not present in the property.",
  "Create an elevated oblique establishing view of the verified building and only its confirmed surroundings; do not invent roads, landmarks, or amenities.",
  "Create an eye-level approach toward the verified main entrance, using a close but recognizable architectural frame and straight vertical lines.",
  "Create a restrained telephoto composition that compresses the verified facade's structural layers and material transitions.",
  "Create a wide environmental view with the property prominent but not filling the frame, using only the property's confirmed setting.",
  "Create a softly overcast architectural study with even exposure, natural material color, and crisp facade detail.",
];

const INTERIOR_IMAGE_PROMPT_VARIATIONS = [
  "Create an illustrative residential living-room interior with natural window light, restrained furnishings, and a neutral palette coherent with the verified architecture; do not imply unconfirmed views, amenities, or distinctive finishes.",
  "Create an eye-level open-plan living and dining interior with layered depth and calm natural light; keep the design plausible and avoid unsupported fixtures, materials, or amenities.",
  "Create a kitchen-to-living interior composition with clean architectural lines and understated cabinetry; treat unspecified details as a neutral visualization, not verified property features.",
  "Create a restful residential bedroom interior with soft daylight and simple textures; do not invent a balcony, view, premium fittings, or other unverified features.",
];

const IMAGE_PROMPT_VARIATIONS = [
  ...EXTERIOR_IMAGE_PROMPT_VARIATIONS,
  ...INTERIOR_IMAGE_PROMPT_VARIATIONS,
];

function variationHash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  return result >>> 0;
}

export function selectImagePromptVariation(seed: string, variationIndex = 0): string {
  const start = variationHash(seed) % IMAGE_PROMPT_VARIATIONS.length;
  const offset = ((variationIndex % IMAGE_PROMPT_VARIATIONS.length) + IMAGE_PROMPT_VARIATIONS.length) %
    IMAGE_PROMPT_VARIATIONS.length;
  return IMAGE_PROMPT_VARIATIONS[(start + offset) % IMAGE_PROMPT_VARIATIONS.length];
}

function selectedPromptVariation(context?: ImagePromptContext, kind = ""): string {
  const seed = context?.variationSeed || context?.campaignId || "creative";
  const autoDiversify = context?.variationSettings?.autoDiversifyAspects !== false;
  const kindIndex = Math.max(0, KIND_ORDER.indexOf(kind));
  const variationIndex = kindIndex + (autoDiversify ? (context?.variationIndex ?? 0) * KIND_ORDER.length : 0);
  const isInteriorSlot = kind === "feature" ||
    (autoDiversify && variationIndex % 3 === 1) ||
    (variationIndex === 0 && variationHash(`${seed}:interior`) % 3 === 0);
  const options = isInteriorSlot ? INTERIOR_IMAGE_PROMPT_VARIATIONS : EXTERIOR_IMAGE_PROMPT_VARIATIONS;
  const selection = variationHash(`${seed}:${variationIndex}`) % options.length;
  return options[selection];
}

function selectedVisualVariation(context?: ImagePromptContext, kind = ""): string {
  const allowed = context?.variationSettings?.allowedPerspectives?.length
    ? context.variationSettings.allowedPerspectives
    : DEFAULT_VARIATION_SETTINGS.allowedPerspectives;
  const seed = context?.variationSeed || context?.campaignId || "creative";
  const autoDiversify = context?.variationSettings?.autoDiversifyAspects !== false;
  const formatKey = autoDiversify
    ? `:${context?.aspectRatio || "default"}:${context?.platform || ""}`
    : "";
  const key = `${seed}${formatKey}`;
  const kindIndex = Math.max(0, KIND_ORDER.indexOf(kind));
  const visualIndex = kindIndex + (autoDiversify ? (context?.variationIndex ?? 0) * KIND_ORDER.length : 0);
  const perspective = allowed[(variationHash(key) + visualIndex) % allowed.length];
  const photoMoments = PHOTO_MOMENTS[context?.variationStyle ?? "cinematic"] ?? PHOTO_MOMENTS.cinematic;
  const photoMoment = photoMoments[(variationHash(`${key}:moment`) + visualIndex) % photoMoments.length];
  const camera = CAMERA_TREATMENTS[(variationHash(`${seed}:camera`) + visualIndex) % CAMERA_TREATMENTS.length];
  const intensity = context?.variationSettings?.intensity ?? "balanced";
  const intensityGuidance = intensity === "subtle"
    ? "Keep the camera and lighting shift understated and brand-consistent."
    : intensity === "dynamic"
      ? "Make the camera viewpoint and lighting mood distinctly different while retaining photographic realism."
      : "Make the camera viewpoint and lighting clearly distinct while retaining a refined, brand-consistent treatment.";
  return `${PERSPECTIVE_GUIDES[perspective]}. Camera treatment: ${camera}. ${photoMoment}. ${intensityGuidance}`;
}

function finishPrompt(
  prompt: string,
  aspectRatio?: string,
  referenceWebsite?: string
): string {
  const constraints = [
    aspectRatio ? aspectComposition(aspectRatio) : "",
    referenceWebsite
      ? `Use this property reference website as visual context where supported, but do not render its URL or any website text: ${referenceWebsite}`
      : "",
    "Do not render text, letters, numbers, logos, signs, watermarks, or graphic overlays; use even natural exposure across the full frame, preserve visible shadow detail, and avoid vignettes, dark fades, black gradients, or crushed blacks",
    "Preserve the verified property architecture and facts; vary camera viewpoint, framing, and lighting rather than redesigning the building",
    "photorealistic premium real-estate advertising photography",
  ].filter(Boolean).join("; ");
  const cleanPrompt = prompt.trim().replace(/[.;,\s]+$/, "");
  return `${cleanPrompt}; ${constraints}`;
}

function approvedPromptSet(kinds: string[], context: ImagePromptContext): ImagePromptSet {
  const approvedPrompt = context.approvedImagePrompt?.trim();
  if (!approvedPrompt) return {};

  const referenceWebsite = getReferenceWebsite(context);
  const supplementalReference = referenceWebsite && !approvedPrompt.includes(referenceWebsite)
    ? `\n\nSupplemental property reference only; do not render this URL or let it override the user-approved prompt: ${referenceWebsite}`
    : "";
  const finalPrompt = `${approvedPrompt}${supplementalReference}`;
  const autoDiversify = context.variationSettings?.autoDiversifyAspects !== false;

  return Object.fromEntries(
    kinds.map((kind) => {
      const aspectGuide = context.aspectRatio ? aspectComposition(context.aspectRatio) : "";
      const formatGuide = KIND_PHOTOGRAPHY[kind] ?? "architectural advertising composition using only verified property features";
      const promptVariation = selectedPromptVariation(context, kind);
      const tailoredPrompt = [
        finalPrompt,
        autoDiversify && aspectGuide ? `Camera perspective & framing: ${aspectGuide}` : "",
        `Format-specific composition for ${kind}: ${formatGuide}`,
        finalPrompt.includes(promptVariation) ? "" : `Selected visual concept: ${promptVariation}`,
        `Visual variation: ${selectedVisualVariation(context, kind)}`,
      ].filter(Boolean).join("; ");
      return [kind, tailoredPrompt];
    })
  );
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
  const hasApprovedPrompt = Boolean(context?.approvedImagePrompt?.trim());
  return [
    "You are an elite real-estate advertising art director and photography director.",
    "Write one technically precise, director-grade image-generation prompt for each requested ad format.",
    "CRITICAL ADVERTISING RULES:",
    hasApprovedPrompt
      ? "1. USER-REVIEWED VISUAL DIRECTIVE: Preserve the user's requested property facts, verified architectural character, material palette, and atmosphere from 'userReviewedVisualDirection'."
      : "1. ARCHITECTURAL AUTHENTICITY: Preserve the property's verified facts, architectural style, facade, and proportions. Do not redesign the property.",
    "When an interior concept is selected for a residential property, generate an interior view rather than defaulting to the facade; use confirmed details where available and keep unspecified finishes neutral and illustrative.",
    "2. COMPOSITION & SAFE ZONES: Follow the exact aspect-ratio composition instructions. Reserve clear, uncluttered negative space (clean sky/ambient space in the upper 35-40%) for the separately rendered ad copy; keep the property visible and undistorted.",
    "3. BRAND AND CAMPAIGN FIT: Reflect the supplied company identity, campaign objective, selected creative direction, verified palette, and lighting without adding logos or text.",
    "4. CLEAN CANVAS: Never generate text, typography, words, numbers, logos, banners, watermarks, or UI elements.",
    "5. DENSITY & DETAIL: Comprehensive, unconstrained photographic brief with specific camera, lighting, material, composition, and color-grade direction without word or character count limits.",
    "6. OUTPUT: Return strictly one valid JSON object mapping each requested kind key to a prompt string. No markdown fences or explanation.",
    "When a reference website URL is supplied, include it verbatim in each final image prompt as visual reference context; do not claim to have opened or inspected the website, and never render the URL as image text.",
    context?.variationSettings?.autoDiversifyAspects === false
      ? "Keep the same camera viewpoint and photographic moment across aspect-ratio versions, adapting only the crop and safe zones; vary them between generations while preserving the verified property identity."
      : "Give every requested ad format its own clearly distinct camera treatment, framing, and photographic moment; do not reuse one visual direction across formats. Preserve the same verified property identity.",
    "Follow the selected image-prompt variation supplied for each format as a real photographic direction, not merely as inspiration; do not add unverified property features.",
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
  const hasApproved = Boolean(context?.approvedImagePrompt?.trim());

  return JSON.stringify({
    userReviewedVisualDirection: context?.approvedImagePrompt?.trim() || undefined,
    projectArchitectureStyle: dna.architecture,
    company: {
      name: context?.brandName,
      primaryColor: context?.brandColor,
      tones: context?.brandTones,
    },
    project: {
      name: brief.name,
      location: brief.location,
      propertyType: brief.propertyType,
      architecturalStyle: dna.architecture,
      description: brief.description || undefined,
      confirmedAmenities: dna.usps,
      lightingAtmosphere: dna.lighting,
      audience: dna.audience,
    },
    referenceWebsite: getReferenceWebsite(context),
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
    variationDirectives: {
      intensity: context?.variationSettings?.intensity || "balanced",
      allowedPerspectives: context?.variationSettings?.allowedPerspectives,
      preferredTranscriptStyles: context?.variationSettings?.preferredTranscriptStyles,
      customVariationStyle: context?.variationStyle,
      selectedVisualVariationByFormat: Object.fromEntries(
        kinds.map((kind) => [kind, selectedVisualVariation(context, kind)])
      ),
      selectedImagePromptVariationByFormat: Object.fromEntries(
        kinds.map((kind) => [kind, selectedPromptVariation(context, kind)])
      ),
      variationSeed: context?.variationSeed,
      compositionAngleForThisAspect: context?.aspectRatio ? aspectComposition(context.aspectRatio) : undefined,
    },
    adFormatsNeeded: kinds,
    spatialZoningGuidancePerFormat: Object.fromEntries(
      kinds.filter((k) => KIND_PHOTOGRAPHY[k]).map((k) => [k, KIND_PHOTOGRAPHY[k]])
    ),
    instruction: hasApproved
      ? "Preserve the user-reviewed property facts, architectural character, finishes, and atmosphere. Apply the corresponding 'selectedVisualVariationByFormat' and 'selectedImagePromptVariationByFormat' through camera viewpoint, framing, and lighting only. Return JSON only."
      : "Write one technically specific, visually distinct background-photo prompt per format matching the verified architectural style ('projectArchitectureStyle') and project description. Apply each format's 'selectedVisualVariationByFormat' and 'selectedImagePromptVariationByFormat' through camera viewpoint, framing, and lighting; preserve the real property design and materials. Typography and the white CTA ribbon are added by the ad layout, never render them into the image. Return JSON only.",
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
        const formatGuide = KIND_PHOTOGRAPHY[kind] ?? "architectural advertising composition using only verified property features";
        result[kind] = finishPrompt(
          `${(parsed[kind] as string).trim()}; format-specific composition for ${kind}: ${formatGuide}; selected visual concept: ${selectedPromptVariation(context, kind)}; distinct visual direction: ${selectedVisualVariation(context, kind)}`,
          context?.aspectRatio,
          getReferenceWebsite(context)
        );
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
  const confirmedFeatures = dna.usps.length ? `Confirmed features: ${dna.usps.join(", ")}.` : "";
  const set: ImagePromptSet = {};

  if (context?.approvedImagePrompt?.trim()) {
    const userApproved = context.approvedImagePrompt.trim().replace(/[.;,\s]+$/, "");
    for (const kind of kinds) {
      const guide = KIND_PHOTOGRAPHY[kind] ?? "establishing exterior shot with clean negative space in upper third";
      set[kind] = finishPrompt(
        `${userApproved}; ${aspectComposition(context?.aspectRatio)}; ${guide}; selected visual concept: ${selectedPromptVariation(context, kind)}; ${selectedVisualVariation(context, kind)}; architectural photography preserving verified ${dna.architecture} materials; natural daylight exposure`,
        context?.aspectRatio,
        getReferenceWebsite(context)
      );
    }
    return set;
  }

  const descSnippet = brief.description ? `Architectural cues: ${brief.description.slice(0, 160)}. ` : "";
  const base = `Photorealistic architectural photography of ${brief.name}, ${brief.propertyType} in ${brief.location}. Architecture: ${dna.architecture}. ${descSnippet}${confirmedFeatures} Lighting: ${dna.lighting}. ${dirStyle}. ${direction.grade}. Brand ${context?.brandName || "identity"}; tones ${(context?.brandTones || []).join(", ") || dna.brandTone}; accent ${context?.brandColor || palette}. ${preset ? `${preset.label} campaign for ${preset.objective}.` : ""} ${aspectComposition(context?.aspectRatio)}. Premium photographic treatment, realistic facade materials, controlled lens perspective and natural depth.`;
  for (const kind of kinds) {
    const guide = KIND_PHOTOGRAPHY[kind] ?? "establishing exterior shot with clean negative space in upper third";
    set[kind] = finishPrompt(
      `${base} ${guide}. Selected visual concept: ${selectedPromptVariation(context, kind)}. Distinct visual direction: ${selectedVisualVariation(context, kind)}`,
      context?.aspectRatio,
      getReferenceWebsite(context)
    );
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
  const approvedPrompt = context?.approvedImagePrompt?.trim();
  if (context && approvedPrompt) {
    return {
      prompts: approvedPromptSet(kinds, context),
      model: "user-approved-prompt (preserved)",
      fallback: false,
    };
  }

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
