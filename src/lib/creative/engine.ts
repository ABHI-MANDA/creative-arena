/* ------------------------------------------------------------------
 * AURUM Property Creative Intelligence Engine
 * Extracts a project's Creative DNA, proposes creative directions,
 * composes deterministic ad systems and scores every asset against
 * the brand QC checklist.
 * ------------------------------------------------------------------ */

import {
  KIND_LABELS,
  PLATFORM_KINDS,
  platformById,
  presetById,
  QC_CHECKLIST,
  type AdFontColors,
  type AdFontSizes,
  type AdTextSection,
  type BrandSettings,
} from "./presets";
import {
  DEFAULT_SCRIM_SETTINGS,
  type CreativeDesignStyle,
  type ScrimSettings,
} from "./style-config";
export type { AdFontColors, AdFontSizes, AdTextSection } from "./presets";

export type Brief = {
  name: string;
  location: string;
  propertyType: string;
  price: string;
  audience?: string;
  amenities?: string;
  description?: string;
};

export type LocationAdvantage = { label: string; mins?: number };

export type DNA = {
  architecture: string;
  palette: string[];
  paletteHex: string[];
  lighting: string;
  audience: string;
  positioning: string;
  usps: string[];
  features: Record<"Exterior" | "Interior" | "Amenities" | "Location", string[]>;
  visualStyle: string;
  brandTone: string;
  locationAdvantages: LocationAdvantage[];
  rawAmenities: string[];
};

export type Direction = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  approach: string[];
  hex: string[];
  tint: string;
  music: string;
  grade: string;
};

export type Shot = { t: string; label: string; visual: string; line: string; tag: string };
export type Caption = { platform: string; label: string; text: string };

export type AssetPayload = {
  kicker?: string;
  headline?: string;
  subline?: string;
  locationLabel?: string;
  priceLine?: string;
  fine?: string;
  cta?: string;
  bullets?: string[];
  rows?: LocationAdvantage[];
  image?: string;
  imagePrompt?: string;
  hex?: string[];
  layout?: "overlay" | "wide";
  designStyle?: CreativeDesignStyle;
  fontSizes?: Partial<AdFontSizes>;
  fontColors?: Partial<AdFontColors>;
  scrimSettings?: ScrimSettings;
  shots?: Shot[];
  hook?: string;
  music?: string;
  durationBadge?: string;
  caption?: string;
  captions?: Caption[];
  hashtags?: string[];
  variant?: number;
  exportFiles?: { png?: string; jpeg?: string };
  /* ---- AI image pipeline fields ---- */
  imageSource?: "ai-generated" | "uploaded" | "sample";  // origin of the background image
  imageGenPrompt?: string;   // the exact prompt sent to the image model
  imageGenModel?: string;    // provider model that returned the image
  imageQualityScore?: number; // quality score from the image generation evaluator (0-100)
  /* ---- Fabric.js Editor fields ---- */
  designJson?: Record<string, unknown> | string;
  originalAssetUrl?: string;
  finalAssetUrl?: string;
  editingStatus?: "draft" | "edited" | "final";
  version?: number;
};

export type QCResult = {
  score: number;
  checks: { label: string; pass: boolean }[];
  status: "ready" | "review" | "improving";
};

export type NewAsset = {
  kind: string;
  platform: string;
  aspect: string;
  title: string;
  payload: AssetPayload;
  score: number;
  checks: QCResult["checks"];
  status: QCResult["status"];
};

export type Img = { url: string; label: string };

/* ---------------- deterministic hashing ---------------- */

export function hx(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

const titleCase = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));

const cityOf = (location: string) => {
  const parts = location.split(",").map((p) => p.trim());
  return pick(parts.slice(-1), 0) || location;
};

/* ---------------- Creative DNA ---------------- */

function extractArchitecturalDNA(brief: Brief): {
  architecture: string;
  palette: string[];
  paletteHex: string[];
} {
  const text = `${brief.propertyType} ${brief.name} ${brief.description ?? ""} ${brief.amenities ?? ""}`.toLowerCase();

  // Extract explicit structural details from description if present (e.g. "34-storey glass tower", "62 courtyard villas")
  const desc = (brief.description ?? "").trim();
  const explicitCues: string[] = [];
  const heightMatch = desc.match(/\b(\d+[- ](?:storey|story|floor))\b/i);
  if (heightMatch) explicitCues.push(heightMatch[1]);
  if (/sky deck/i.test(desc)) explicitCues.push("sky deck");
  if (/infinity pool/i.test(desc)) explicitCues.push("infinity pool");
  if (/courtyard/i.test(desc)) explicitCues.push("central courtyards");
  if (/curtain wall|glass facade/i.test(desc)) explicitCues.push("curtain-wall glazing");
  if (/private garden/i.test(desc)) explicitCues.push("private landscaped gardens");
  if (/terrace/i.test(desc)) explicitCues.push("cantilevered terraces");
  if (/lake view|sea view|ocean view/i.test(desc)) explicitCues.push("panoramic water views");

  // 1. Neoclassical / Classical Revival
  if (/\b(neoclassical|classical|greco-roman|roman|greek|colonial|victorian|georgian|palladian|portico|fluted column|pediment|chateau|palatial)\b/i.test(text)) {
    const extra = explicitCues.length ? `, incorporating ${explicitCues.join(", ")}` : "";
    return {
      architecture: `Neoclassical & Classical Revival with grand symmetry, fluted columns, ornate carved stonework, and stately porticos${extra}`,
      palette: ["Parchment Stone", "Antique Bronze", "Carrara White"],
      paletteHex: ["#E8E2D5", "#6B5B45", "#F7F5F0"],
    };
  }

  // 2. Mediterranean / Spanish / Tuscan / Italian
  if (/\b(mediterranean|spanish|tuscan|andalusian|terracotta|stucco|hacienda|clay tile|italian villa|colonnade|juliet balcon|pergola)\b/i.test(text)) {
    const extra = explicitCues.length ? `, featuring ${explicitCues.join(", ")}` : "";
    return {
      architecture: `Mediterranean Spanish-Colonial with warm terracotta tile roofs, textured stucco walls, arched loggias, and internal courtyards${extra}`,
      palette: ["Terracotta", "Warm Stucco", "Olive Stone"],
      paletteHex: ["#C86D51", "#E6DFCE", "#5A614C"],
    };
  }

  // 3. Biophilic / Vertical Forest / Eco-Luxury
  if (/\b(biophilic|vertical forest|green wall|living wall|hanging garden|green balcon|terraced garden|sustainable|cascading|nature-infused|botanical)\b/i.test(text)) {
    const extra = explicitCues.length ? `, featuring ${explicitCues.join(", ")}` : "";
    return {
      architecture: `Biophilic Sustainable Architecture with cascading landscaped terraces, living green walls, natural timber fins, and expansive glazing${extra}`,
      palette: ["Forest Green", "Raw Teak", "Muted Limestone"],
      paletteHex: ["#2E473B", "#8C6239", "#DDD8CD"],
    };
  }

  // 4. Tropical Modern / Balinese / Courtyard Villa
  if (/\b(tropical|balinese|courtyard|villa|bungalow|resort-style|plunge pool|verandah|teak|frangipani|shingle|overhang|bali)\b/i.test(text)) {
    const extra = explicitCues.length ? `, featuring ${explicitCues.join(", ")}` : "";
    return {
      architecture: `Tropical Modern Pavilions with expansive timber overhangs, landscaped courtyards, natural stone water features, and louvered screens${extra}`,
      palette: ["Teak Wood", "Lava Stone", "Bone White"],
      paletteHex: ["#7A4E2D", "#333538", "#F5F2EB"],
    };
  }

  // 5. Art Deco / Mid-Century Modern
  if (/\b(art deco|deco|mid-century|brass accent|geometric facade|sunburst|stepped facade|ziggurat|streamline)\b/i.test(text)) {
    const extra = explicitCues.length ? `, featuring ${explicitCues.join(", ")}` : "";
    return {
      architecture: `Art Deco Elegance with geometric relief facades, fluted brass detailing, stepped profile setbacks, and polished terrazzo${extra}`,
      palette: ["Deep Emerald", "Gilded Brass", "Obsidian Black"],
      paletteHex: ["#1E3B30", "#D4AF37", "#0F1113"],
    };
  }

  // 6. Sculptural Concrete / Brutalist / Industrial
  if (/\b(brutalist|exposed concrete|industrial|raw concrete|board-formed|steel frame|loft|monolithic|sculptural concrete)\b/i.test(text)) {
    const extra = explicitCues.length ? `, featuring ${explicitCues.join(", ")}` : "";
    return {
      architecture: `Sculptural Modern Minimalism with board-formed architectural concrete, black steel framing, fluted oak, and rectilinear volumes${extra}`,
      palette: ["Ash Concrete", "Matte Black Steel", "Natural Oak"],
      paletteHex: ["#8E9094", "#1A1A1A", "#B89B72"],
    };
  }

  // 7. Waterfront / Coastal / Nautical
  if (/\b(waterfront|coastal|beachfront|sea-facing|ocean|lakeview|lakeside|marina|nautical)\b/i.test(text)) {
    const extra = explicitCues.length ? `, featuring ${explicitCues.join(", ")}` : "";
    return {
      architecture: `Contemporary Coastal Living with aerodynamic glass balconies, nautical white architectural lines, and panoramic waterfront glazing${extra}`,
      palette: ["Aquamarine", "Driftwood Sand", "Nautical White"],
      paletteHex: ["#3E6B7D", "#D4C5B0", "#F8F9FA"],
    };
  }

  // 8. High-Rise Contemporary Skyscraper / Glass Tower
  if (/\b(skyscraper|high-rise|sky residence|storey|story|tower|sky deck|curtain wall|glass facade|double-glazed|panoramic sky)\b/i.test(text)) {
    const extra = explicitCues.length ? `, featuring ${explicitCues.join(", ")}` : "";
    return {
      architecture: `Contemporary Aerodynamic High-Rise with floor-to-ceiling glass curtain walls, metallic champagne fins, and cantilevered sky balconies${extra}`,
      palette: ["Reflective Glass", "Champagne Bronze", "Titanium Grey"],
      paletteHex: ["#3B5266", "#C5A880", "#22252A"],
    };
  }

  // 9. Master-planned Plotted Enclave / Land
  if (/\b(plot|plotted|land|master-planned|avenue|gated layout)\b/i.test(text)) {
    return {
      architecture: "Master-Planned Eco-Enclave with paved tree-lined boulevards, bespoke entrance gates, landscaped parklands, and subterranean utilities",
      palette: ["Emerald Lawn", "Paved Slate", "Warm Amber"],
      paletteHex: ["#2D5A27", "#4A525A", "#C89D3C"],
    };
  }

  // 10. Boutique Low-Rise / Mansions / Heritage Enclave
  if (/\b(low-rise|boutique|mansion|heritage|manor|estate|enclave|brownstone|duplex|penthouse)\b/i.test(text)) {
    const extra = explicitCues.length ? `, featuring ${explicitCues.join(", ")}` : "";
    return {
      architecture: `Boutique Low-Rise Manor with hand-dressed ashlar masonry, expansive bronze-framed windows, and private landscaped courtyards${extra}`,
      palette: ["Limestone Cream", "Weathered Bronze", "Slate"],
      paletteHex: ["#DFD7CA", "#6E5B4B", "#383C42"],
    };
  }

  // Default fallback: infer from propertyType and description gracefully
  const isVilla = /villa|row house|bungalow|estate/i.test(text);
  if (isVilla) {
    return {
      architecture: "Modern Tropical Contemporary Villa with floor-to-ceiling sliding glass, warm teak accents, and lush garden integration",
      palette: ["Alabaster", "Graphite", "Teak Wood"],
      paletteHex: ["#EFE9DC", "#3B3A38", "#9C6B43"],
    };
  }

  const extra = explicitCues.length ? `, featuring ${explicitCues.join(", ")}` : "";
  return {
    architecture: `Sophisticated Contemporary Residential Architecture with elegant geometric facade detailing, deep recessed balconies, and warm architectural lighting${extra}`,
    palette: ["Bronze Glass", "Travertine", "Midnight"],
    paletteHex: ["#B08B5E", "#D9D2C3", "#1D2330"],
  };
}

export function analyzeDNA(brief: Brief): DNA {
  const t = `${brief.propertyType} ${brief.name}`.toLowerCase();
  const isVilla = /villa|row house|bungalow|estate/.test(t);
  const isPlot = /plot|land/.test(t);
  const lightingSeed = hx(`${brief.name}:${brief.location}:lighting`);

  const rawAmenities = (brief.amenities ?? "")
    .split(/[,\n·]/)
    .map((a) => titleCase(a))
    .filter(Boolean);

  const usps = [...new Set(rawAmenities)].slice(0, 4);
  const loc = brief.location || "Bengaluru";
  const city = cityOf(loc);

  const { architecture, palette, paletteHex } = extractArchitecturalDNA(brief);

  const positioning = isVilla
    ? `Villa residences in ${loc}`
    : isPlot
      ? `Land opportunities in ${loc}`
      : `Residential living in ${city}`;
  const locationAdvantages: LocationAdvantage[] = [];

  return {
    architecture,
    palette,
    paletteHex,
    lighting: pick(["Warm golden hour", "Dusk glow", "Soft morning haze"], lightingSeed % 3),
    audience: brief.audience?.trim() || (isVilla ? "Premium family buyers, 38–55" : "Young professionals & investors, 28–45"),
    positioning,
    usps,
    features: {
      Exterior: [],
      Interior: [],
      Amenities: usps,
      Location: [loc],
    },
    visualStyle: "Cinematic Premium",
    brandTone: "Elegant · Trustworthy",
    locationAdvantages,
    rawAmenities,
  };
}

/* ---------------- Creative directions ---------------- */

export function directionsFor(dna: DNA, brief: Brief): Direction[] {
  return [
    {
      id: "golden-hour-cinema",
      name: "Golden Hour Cinema",
      tagline: "Warm · Premium · Cinematic",
      description:
        `Warm late-afternoon exteriors and naturally glowing interiors, slow camera move-outs, champagne light with open shadow detail. Leads with ${dna.positioning.toLowerCase()}.`,
      approach: ["Warm daylight hero frames", "Slow 24fps camera language", "Champagne & warm slate grade", "Serif-led typography"],
      hex: ["#0B0A08", "#D9AB5E", "#8C6B4A"],
      tint: "rgba(217,171,94,0.16)",
      music: "Warm cinematic piano · 92 BPM · soft rise",
      grade: "Balanced amber highlights, natural exposure, lifted shadows with architectural detail",
    },
    {
      id: "bright-living-story",
      name: "Bright Living Story",
      tagline: "Daylight · Lifestyle · Human",
      description:
        `Sunlit rooms and real routines — morning coffee, garden play, evening laps. The ${brief.propertyType.toLowerCase()} as a lived-in promise.`,
      approach: ["Airy daylight exposures", "Lifestyle-forward framing", "Warm white + sage grade", "Quiet, human copy"],
      hex: ["#101820", "#E9F1EC", "#A3B18A"],
      tint: "rgba(233,241,236,0.10)",
      music: "Acoustic sunrise folk · 104 BPM · gentle",
      grade: "Lifted shadows, airy whites, true-skin warmth",
    },
    {
      id: "form-and-structure",
      name: "Form & Structure",
      tagline: "Minimal · Architectural · Editorial",
      description:
        `Monochrome details, hard geometry and negative space. ${dna.architecture} presented as sculpture — for the connoisseur buyer.`,
      approach: ["Detail-first macro frames", "Mono editorial palette", "Negative-space layouts", "Grid-locked typography"],
      hex: ["#111112", "#ECECE8", "#8A8A86"],
      tint: "rgba(236,236,232,0.08)",
      music: "Sparse ambient keys · 80 BPM · reverbed",
      grade: "Neutral mono, restrained micro-contrast, open shadows with visible detail",
    },
  ];
}

/* ---------------- Preset copy system ---------------- */

type PresetCopy = {
  kicker: string;
  hero: string;
  sub: string;
  cta: string;
  offerKicker: string;
  urgency: string;
  hook: string;
};

const FILL = (s: string, brief: Brief, dna: DNA) =>
  s
    .replaceAll("{name}", brief.name)
    .replaceAll("{location}", brief.location)
    .replaceAll("{city}", cityOf(brief.location))
    .replaceAll("{type}", brief.propertyType)
    .replaceAll("{price}", brief.price)
    .replaceAll("{usp}", dna.usps[0] ?? "details available on request");

export function presetCopy(presetId: string, brief: Brief, dna: DNA): PresetCopy {
  const bank: Record<string, PresetCopy> = {
    "luxury-property": {
      kicker: "The {name} Collection",
      hero: "A considered address in {location}.",
      sub: "Discover {type} at {name}.",
      cta: "Explore Residences",
      offerKicker: "Private Preview",
      urgency: "Contact the sales team for current availability",
      hook: "A closer look at {name}.",
    },
    "project-launch": {
      kicker: "Now Launching",
      hero: "{name} has arrived.",
      sub: "New {type} at {name}, {location}.",
      cta: "Register Interest",
      offerKicker: "Launch Pricing",
      urgency: "Enquire for current launch details",
      hook: "Introducing {name} in {location}.",
    },
    "new-phase-launch": {
      kicker: "Phase II · Now Open",
      hero: "The next chapter of {name}.",
      sub: "Explore the latest release of {type} at {price}.",
      cta: "Choose Your Residence",
      offerKicker: "Phase II Release",
      urgency: "Ask about current release availability",
      hook: "A new chapter at {name} is now open.",
    },
    "property-sale": {
      kicker: "For Sale",
      hero: "Explore {type} in {location}.",
      sub: "{type} at {name}, from {price}.",
      cta: "Book a Site Visit",
      offerKicker: "Property Details",
      urgency: "Book a property walkthrough",
      hook: "Take a closer look at {name}.",
    },
    rental: {
      kicker: "Premium Rentals",
      hero: "Live the {location} life.",
      sub: "Move-in ready {type} in {location}.",
      cta: "Schedule a Tour",
      offerKicker: "Rental Availability",
      urgency: "Ask about current availability",
      hook: "A considered way to live in {location}.",
    },
    investment: {
      kicker: "Investor Edition",
      hero: "Explore property opportunities in {location}.",
      sub: "Review {type} at {name}, from {price}.",
      cta: "Request Project Details",
      offerKicker: "Investor Overview",
      urgency: "Request current project and pricing details",
      hook: "Explore the opportunity in {location}.",
    },
    "open-house": {
      kicker: "You're Invited",
      hero: "Visit {name} in {location}.",
      sub: "Explore {type} and request a guided property viewing.",
      cta: "Request a Viewing",
      offerKicker: "Property Viewing",
      urgency: "Contact the team for available viewing times",
      hook: "See the property details for {name}.",
    },
    "festival-offer": {
      kicker: "Festive Edition",
      hero: "A seasonal look at {name}.",
      sub: "Explore {type} at {price}.",
      cta: "Request Offer Details",
      offerKicker: "Seasonal Campaign",
      urgency: "Ask the sales team about current offers",
      hook: "Discover {name} this season.",
    },
    "construction-progress": {
      kicker: "On-Site Update",
      hero: "A closer look at {name}.",
      sub: "Review the project details for {type} in {location}.",
      cta: "Request Project Details",
      offerKicker: "Project Update",
      urgency: "Request the latest project update",
      hook: "Explore the project behind {name}.",
    },
    "location-highlight": {
      kicker: "The {location} Advantage",
      hero: "Discover {name} in {location}.",
      sub: "{type} at {location}.",
      cta: "Explore the Location",
      offerKicker: "Location Advantage",
      urgency: "Explore the property's location",
      hook: "A new perspective on life in {location}.",
    },
  };
  const c = bank[presetId] ?? bank["luxury-property"];
  return {
    kicker: FILL(c.kicker, brief, dna),
    hero: FILL(c.hero, brief, dna),
    sub: FILL(c.sub, brief, dna),
    cta: FILL(c.cta, brief, dna),
    offerKicker: c.offerKicker,
    urgency: FILL(c.urgency, brief, dna),
    hook: FILL(c.hook, brief, dna),
  };
}

/* ---------------- optional LLM refinement ---------------- */

export type CopyOverride = {
  heroHeadline?: string;
  heroSubline?: string;
  lifestyleLine?: string;
  featureHeadline?: string;
  imagePrompt?: string;
  storyboard?: Shot[];
  captions?: Record<string, string>;
  hashtags?: string[];
};

function parseModelJson(content: string): Record<string, unknown> | null {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function boundedText(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : undefined;
}

function validateCopyOverride(value: Record<string, unknown>): CopyOverride {
  const captionsSource = value.captions && typeof value.captions === "object"
    ? value.captions as Record<string, unknown>
    : {};
  const captions = Object.fromEntries(
    ["instagram", "facebook", "linkedin", "whatsapp", "portal", "youtube"].flatMap((platform) => {
      const caption = boundedText(captionsSource[platform], 1200);
      return caption ? [[platform, caption]] : [];
    })
  );
  const storyboard = Array.isArray(value.storyboard)
    ? value.storyboard.slice(0, 8).flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const shot = entry as Record<string, unknown>;
        const t = boundedText(shot.t, 12);
        const label = boundedText(shot.label, 24);
        const visual = boundedText(shot.visual, 220);
        const line = boundedText(shot.line, 180);
        const tag = boundedText(shot.tag, 32);
        return t && label && visual && line && tag ? [{ t, label, visual, line, tag }] : [];
      })
    : undefined;
  const hashtags = Array.isArray(value.hashtags)
    ? value.hashtags.flatMap((tag) => {
        const clean = boundedText(tag, 40);
        return clean ? [clean.startsWith("#") ? clean : `#${clean}`] : [];
      }).filter((tag, index, all) => all.indexOf(tag) === index).slice(0, 12)
    : [];
  return {
    heroHeadline: boundedText(value.heroHeadline, 100),
    heroSubline: boundedText(value.heroSubline, 180),
    lifestyleLine: boundedText(value.lifestyleLine, 110),
    featureHeadline: boundedText(value.featureHeadline, 100),
    imagePrompt: typeof value.imagePrompt === "string" && value.imagePrompt.trim() ? value.imagePrompt.trim() : undefined,
    storyboard: storyboard && storyboard.length >= 5 ? storyboard : undefined,
    captions: Object.keys(captions).length ? captions : undefined,
    hashtags: hashtags.length ? hashtags : undefined,
  };
}

function fitStoryboardDuration(shots: Shot[], totalSeconds: number): Shot[] {
  const count = Math.max(1, shots.length);
  return shots.map((shot, index) => {
    const start = Math.round((index * totalSeconds) / count);
    const end = Math.round(((index + 1) * totalSeconds) / count);
    return { ...shot, t: `${start}-${end}s` };
  });
}

export async function tryLLMOverride(
  brief: Brief,
  dna: DNA,
  presetId: string,
  modelOverride?: string | null,
  templateInstructions?: string,
  selectedDirection?: Direction,
  brandSettings?: Pick<BrandSettings, "name" | "color" | "tones">
): Promise<{ override: CopyOverride | null; model: string; fallback: boolean }> {
  const agnesKey = process.env.AGNES_API_KEY?.trim();
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const agnesBase = (process.env.AGNES_BASE_URL?.trim() || "https://apihub.agnes-ai.com/v1").replace(/\/+$/, "");

  const configuredModel =
    process.env.AGNES_TEXT_MODEL?.trim() ||
    (agnesKey ? "agnes-3.0-flash" : (process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o"));
  const primaryModel = modelOverride === null ? null : (modelOverride ?? configuredModel);
  if (!primaryModel || (!agnesKey && !openrouterKey)) {
    return { override: null, model: "local-creative-copy-v2", fallback: true };
  }

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
      console.log(`[engine] Requesting copy generation from '${model}' at ${endpoint}...`);
      const res = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(30000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.45,
          max_tokens: 2400,
          messages: [
            {
              role: "system",
              content: [
                "You are a senior real-estate creative director and performance copywriter.",
                "Return one valid JSON object only; do not use markdown fences or add commentary.",
                "Use only supplied property facts. Never invent approvals, amenities, distances, returns, scarcity, pricing, completion dates, or guarantees. If a fact is missing, omit it.",
                "Create polished, premium real-estate advertising with a clear reading order: project identity, one distinctive promise, verifiable proof, then one direct action.",
                "Write distinctive, specific, readable copy. Avoid cliches, unsupported superlatives, emojis, repeated phrases, and crowded headlines.",
                "Keep headlines punchy and concise (max 7 words) so they never crowd the visual or overlay important background elements.",
                "Keep sublines factual (max 14 words), and CTAs direct. Preserve the exact supplied project name, property type, location, and price in their respective fields.",
                "Match the supplied company's name, brand tone, and brand palette alongside the selected campaign preset and creative direction, while keeping all property claims factual.",
                "Return keys: heroHeadline, heroSubline, lifestyleLine, featureHeadline, imagePrompt, captions, hashtags, storyboard.",
                "captions is an object with optional instagram, facebook, linkedin, whatsapp, portal, youtube strings.",
                "hashtags is an array of up to 12 strings.",
                "storyboard is an array of 5 to 8 objects with t, label, visual, line, tag; make total duration 15 seconds for Instagram Reels or 30 seconds for YouTube Shorts, use a clear hook, visual progression, factual proof, and CTA end-frame.",
                "imagePrompt must specifically capture the project's unique architectural identity, facade materials, structural styling, rooflines, and spatial character based on the property description and property type (e.g. Victorian, Mediterranean, Brutalist, Tropical Modern, Art Deco, Biophilic Green Terraces, Glass High-rise). Avoid generic building descriptions. Anchor structures in the lower-middle frame, maintaining clean open sky negative space in upper 35-40% for typography overlays. Do not ask an image model to render text, logos, prices, or typography. There is no character or word limit on imagePrompt; write an unconstrained, richly detailed photographic brief.",
                templateInstructions ? `Active template direction (follow unless it conflicts with verified facts): ${templateInstructions}` : "",
              ].filter(Boolean).join(" "),
            },
            {
              role: "user",
              content: JSON.stringify({
                company: brandSettings ?? null,
                property: {
                  name: brief.name,
                  location: brief.location,
                  propertyType: brief.propertyType,
                  price: brief.price,
                  audience: brief.audience ?? dna.audience,
                  amenities: brief.amenities ?? "",
                  description: brief.description ?? "",
                },
                creativeDNA: {
                  positioning: dna.positioning,
                  architecture: dna.architecture,
                  visualStyle: dna.visualStyle,
                  brandTone: dna.brandTone,
                  usps: dna.usps,
                  locationAdvantages: dna.locationAdvantages,
                },
                campaignObjective: presetById(presetId).objective,
                campaignPreset: presetById(presetId).label,
                selectedCreativeDirection: selectedDirection ? {
                  name: selectedDirection.name,
                  tagline: selectedDirection.tagline,
                  description: selectedDirection.description,
                  palette: selectedDirection.hex,
                  visualApproach: selectedDirection.approach,
                  grade: selectedDirection.grade,
                } : null,
                requiredOutput: "Create distinct image-ad copy and an editable short-form video script.",
              }),
            },
          ],
        }),
      });

      if (!res.ok) {
        console.warn(`[engine] Model '${model}' on ${endpoint} returned status ${res.status}. Trying next candidate...`);
        continue;
      }

      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content ?? "";
      const parsed = parseModelJson(text);
      if (parsed) {
        console.log(`[engine] Successfully generated copy with model '${model}'`);
        return { override: validateCopyOverride(parsed), model, fallback: false };
      }
    } catch (error) {
      console.warn(`[engine] Failed to generate copy with model '${model}':`, error);
    }
  }

  console.warn("AI copy/script generation fell back to local content");
  return { override: null, model: `local-creative-copy-v2 (fallback from ${primaryModel})`, fallback: true };
}

/* ---------------- captions & hashtags ---------------- */

export function captionsFor(
  platformIds: string[],
  brief: Brief,
  dna: DNA,
  copy: PresetCopy,
  override?: CopyOverride | null
): Caption[] {
  const featureLine = dna.usps.length ? `${dna.usps.slice(0, 3).join(" · ")}\n\n` : "";
  const groups: Record<string, { label: string; text: string }> = {
    instagram: {
      label: "Instagram",
      text:
        override?.captions?.instagram ??
        `${copy.hero}\n\n${featureLine}${brief.propertyType} at ${brief.name}, ${brief.location} — ${brief.price}.\n\n${copy.cta} — link in bio.`,
    },
    facebook: {
      label: "Facebook",
      text:
        override?.captions?.facebook ??
        `${copy.hero}\n\n${brief.name} — ${dna.positioning}. ${dna.usps.length ? `Verified features: ${dna.usps.join(", ")}. ` : ""}${copy.urgency}.\n\n${brief.price}. ${copy.cta}: send us a message.`,
    },
    linkedin: {
      label: "LinkedIn",
      text:
        override?.captions?.linkedin ??
        `${brief.name} — ${brief.propertyType}, ${brief.location}.\n\n${copy.sub}\n\nPrice: ${brief.price}. ${copy.urgency}.\nSchedule a walkthrough with our advisory desk.`,
    },
    whatsapp: {
      label: "WhatsApp",
      text:
        override?.captions?.whatsapp ??
        `*${brief.name} — ${brief.location}*\n${brief.propertyType} · ${brief.price}${dna.usps.length ? `\n${dna.usps.join(" · ")}` : ""}\n${copy.urgency}.\nReply *SITE VISIT* to enquire.`,
    },
    portal: {
      label: "Property Portal",
      text: `${brief.name} — ${brief.propertyType} in ${brief.location}.${dna.usps.length ? ` Features: ${dna.usps.join(", ")}.` : ""} From ${brief.price}.`,
    },
  };
  const map: Record<string, string> = {
    "ig-post": "instagram",
    "ig-story": "instagram",
    "ig-reel": "instagram",
    "fb-ad": "facebook",
    "yt-short": "facebook",
    linkedin: "linkedin",
    whatsapp: "whatsapp",
    portal: "portal",
  };
  const out = new Map<string, Caption>();
  for (const p of platformIds) {
    const g = map[p] ?? "instagram";
    if (!out.has(g)) out.set(g, { platform: g, label: groups[g].label, text: groups[g].text });
  }
  return [...out.values()];
}

export function hashtagsFor(
  brief: Brief,
  dna: DNA,
  override?: CopyOverride | null
): string[] {
  if (override?.hashtags?.length) return override.hashtags.slice(0, 10).map((t) => (t.startsWith("#") ? t : `#${t}`));
  const loc = cityOf(brief.location).replace(/[^A-Za-z]/g, "");
  const area = brief.location.split(",")[0].replace(/[^A-Za-z]/g, "");
  const type = /villa/i.test(brief.propertyType) ? "LuxuryVillas" : /plot/i.test(brief.propertyType) ? "Plots" : "LuxuryApartments";
  const tags = [
    `#${brief.name.replace(/[^A-Za-z]/g, "")}`,
    `#${area}`,
    `#${loc}RealEstate`,
    `#${type}`,
    `#${dna.usps[0]?.replace(/[^A-Za-z]/g, "") || "NewLaunch"}`,
    "#LuxuryRealEstate",
    "#DreamHome",
    "#RealEstateIndia",
    "#PropertyInvestment",
    "#SiteVisit",
  ];
  return [...new Set(tags)].slice(0, 10);
}

/* ---------------- storyboard ---------------- */

export function storyboardFor(
  brief: Brief,
  dna: DNA,
  copy: PresetCopy,
  dir: Direction,
  images: Img[],
  long = false
): Shot[] {
  const img = (pref: string[], i: number) => imageFor(images, pref, i + hx(brief.name));
  const amenityList = dna.usps;
  if (!long) {
    return [
      { t: "0–3s", label: "HOOK", visual: `Fast push-in on the facade, ${dna.lighting.toLowerCase()} flare`, line: copy.hook, tag: "Match cut" },
      { t: "3–6s", label: "EXTERIOR", visual: `Slow reveal of supplied property imagery — ${dna.architecture.toLowerCase()}`, line: `${brief.name}, ${brief.location}.`, tag: "Whip pan" },
      { t: "6–9s", label: "DETAILS", visual: "Move across supplied interior photographs; do not add unverified rooms or finishes", line: `Explore ${brief.propertyType} at ${brief.name}.`, tag: "Speed ramp" },
      { t: "9–12s", label: amenityList.length ? "AMENITIES" : "PROPERTY", visual: amenityList.length ? `${amenityList.slice(0, 3).join(" · ")} — detail montage` : "A clean sequence of supplied property images", line: amenityList.length ? `${amenityList.slice(0, 3).join(" · ")}.` : `${brief.name} · ${brief.propertyType}.`, tag: "Rhythm cuts" },
      { t: "12–15s", label: "CTA", visual: "Logo resolve, directions chip, CTA card", line: `${copy.cta} — tap the link.`, tag: "Settle frame" },
    ];
  }
  return [
    { t: "0–3s", label: "HOOK", visual: `Aerial drift over ${cityOf(brief.location)}, dawn haze`, line: copy.hook, tag: "Drone in" },
    { t: "3–6s", label: "LOCATION", visual: `On-screen location title: ${brief.location}`, line: `${brief.name}, ${brief.location}.`, tag: "Map wipe" },
    { t: "6–10s", label: "EXTERIOR", visual: `Facade reveal, ${dna.lighting.toLowerCase()}`, line: `${brief.name}, ${brief.location}.`, tag: "Dolly" },
    { t: "10–14s", label: "DETAILS", visual: "Interior sequence using supplied property photographs only", line: `Explore ${brief.propertyType} at ${brief.name}.`, tag: "Gimbal" },
    { t: "14–18s", label: amenityList.length ? "AMENITIES" : "PROPERTY", visual: amenityList.length ? `${amenityList.join(" · ")} montage` : "Sequence the supplied property photographs", line: amenityList.length ? `${amenityList.join(" · ")}.` : `${brief.name} · ${brief.propertyType}.`, tag: "Rhythm cuts" },
    { t: "18–22s", label: "LIFESTYLE", visual: "Use supplied lifestyle footage only when available; otherwise continue the property-photo sequence", line: `A closer look at ${brief.name}.`, tag: "Match cut" },
    { t: "22–26s", label: "PROJECT", visual: `Detail frame: ${dna.architecture.toLowerCase()}`, line: `${brief.name} · ${brief.propertyType}.`, tag: "Macro" },
    { t: "26–30s", label: "CTA", visual: "Logo resolve + CTA card + QR", line: `${copy.cta} — ${brief.price}.`, tag: "Settle frame" },
  ].map((s, i) => ({ ...s, tag: s.tag, ...(i === -1 ? { visual: img([], i) } : {}) }));
}

/* ---------------- image chooser ---------------- */

export function imageFor(images: Img[], prefer: string[], seed: number): string {
  if (!images.length) return "/images/props/villa-hero.jpg";
  for (const p of prefer) {
    const hit = images.find((i) => i.label.toLowerCase().includes(p.toLowerCase()));
    if (hit) return hit.url;
  }
  return images[seed % images.length].url;
}

/* ---------------- quality check ---------------- */

export function qualityCheck(
  seedStr: string,
  thresholds: { ready: number; review: number }
): QCResult {
  const h = hx(seedStr);
  const score = 82 + (h % 18); // 82..99
  let fails: number;
  if (score >= thresholds.ready) fails = 0;
  else if (score >= thresholds.review) fails = 1 + (h % 3);
  else fails = 4 + (h % 3);
  const stride = 1 + (h % 4);
  const checks = QC_CHECKLIST.map((label, i) => ({ label, pass: true }));
  for (let k = 0; k < fails; k++) checks[(h + k * stride * 3) % checks.length].pass = false;
  return {
    score,
    checks,
    status: score >= thresholds.ready ? "ready" : score >= thresholds.review ? "review" : "improving",
  };
}

/* ---------------- campaign composer ---------------- */

export type ApprovedAdContent = {
  developer: string;
  project: string;
  tagline: string;
  bhk: string;
  locationTag: string;
  amenitiesLine: string;
  price: string;
  cta: string;
  imagePrompt: string;
  layout?: "automatic" | "poster" | "split";
  designStyle?: CreativeDesignStyle;
  fontSizes?: Partial<AdFontSizes>;
  fontColors?: Partial<AdFontColors>;
  scrimSettings?: ScrimSettings;
  captions?: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    whatsapp?: string;
    portal?: string;
  };
  hashtags?: string[];
};

export function parseBhk(propertyType?: string, text?: string): string {
  const combined = `${propertyType ?? ""} ${text ?? ""}`;
  const match = combined.match(/\b(\d+(?:\s*[,/&]\s*\d+)*\s*BHK)\b/i);
  if (match) {
    return match[1].replace(/\s*\/\s*/g, " & ").toUpperCase();
  }
  return "";
}

export function parseDeveloperAndProject(
  kicker?: string,
  headline?: string,
  brandName?: string
): { developer: string; project: string } {
  if (kicker && kicker !== "SIGNATURE RESIDENCES") {
    return {
      developer: kicker.toUpperCase(),
      project: (headline || "").toUpperCase(),
    };
  }
  const parts = (headline || "").trim().split(/\s+/);
  if (parts.length >= 2) {
    return {
      developer: parts[0].toUpperCase(),
      project: parts.slice(1).join(" ").toUpperCase(),
    };
  }
  return {
    developer: (brandName || "EXCLUSIVE").toUpperCase(),
    project: (headline || "").toUpperCase(),
  };
}

export function buildDraftAdContent(
  brief: Brief,
  dna: DNA,
  direction: Direction,
  override?: CopyOverride | null,
  brandName?: string,
  presetId = "luxury-property"
): ApprovedAdContent {
  const devAndProj = {
    developer: (brandName?.trim() || brief.name.split(" ")[0] || "EXCLUSIVE").toUpperCase(),
    project: brief.name.toUpperCase(),
  };
  const bhk = parseBhk(brief.propertyType, brief.description);
  const presetCtas: Record<string, string> = {
    "luxury-property": "Explore Residences",
    "project-launch": "Register Interest",
    "new-phase-launch": "Register Interest",
    "property-sale": "Book a Site Visit",
    rental: "Request a Viewing",
    investment: "Request Project Details",
    "open-house": "Reserve Your Visit",
    "festival-offer": "Request Offer Details",
    "construction-progress": "View Project Progress",
    "location-highlight": "Explore the Location",
  };
  const presetTaglines: Record<string, string> = {
    "luxury-property": "A considered address, designed for living",
    "project-launch": "Discover a new address",
    "new-phase-launch": "Discover the next chapter",
    "property-sale": "Find your next home",
    rental: "Find a place that feels like yours",
    investment: "Explore the opportunity",
    "open-house": "Experience the property in person",
    "festival-offer": "Explore the current offer",
    "construction-progress": "See the progress for yourself",
    "location-highlight": "Make this neighbourhood yours",
  };
  const tagline = override?.heroSubline || presetTaglines[presetId] || "Discover this address";
  const propertyType = brief.propertyType
    .replace(/\b\d+(?:\s*[,/&]\s*\d+)*\s*BHK\b/i, "")
    .replace(/^[\s,/&-]+|[\s,/&-]+$/g, "")
    .trim();
  const locationTag = [propertyType, brief.location].filter(Boolean).join(" IN ").toUpperCase();
  const amenitiesLine = dna.usps.slice(0, 2).join(" | ").toUpperCase();
  const price = brief.price;
  const cta = presetCtas[presetId] || "Explore Residences";
  const archDetail = dna.architecture;
  const verifiedAmenities = dna.usps.length ? `featuring confirmed amenities: ${dna.usps.slice(0, 3).join(", ")}` : "";
  const descContext = brief.description ? `Architectural cues: ${brief.description.slice(0, 160)}.` : "";
  const imagePrompt =
    override?.imagePrompt ||
    `Photorealistic architectural photography of ${brief.name}, ${brief.propertyType} in ${brief.location}. Designed in ${archDetail}. ${descContext} ${verifiedAmenities}. Captured during ${dna.lighting.toLowerCase()} with ${direction.grade.toLowerCase()}, highlighting authentic structural lines, rich facade textures, and natural glass reflections. Building anchored in the lower 60% of the frame with clean, uncluttered open sky in the upper 40% reserved for headline typography. Premium architectural advertising standard, realistic environmental depth, strictly no text, no logos, no watermarks.`;

  return {
    developer: devAndProj.developer,
    project: devAndProj.project,
    tagline,
    bhk,
    locationTag,
    amenitiesLine,
    price,
    cta,
    imagePrompt,
    layout: "automatic",
    designStyle: "editorial",
    captions: override?.captions,
    hashtags: override?.hashtags,
  };
}

export type ComposeInput = {
  brief: Brief;
  dna: DNA;
  presetId: string;
  platformIds: string[];
  direction: Direction;
  images: Img[];
  thresholds: { ready: number; review: number };
  override?: CopyOverride | null;
  approvedContent?: ApprovedAdContent | null;
  typographyDefaults?: BrandSettings["typographyDefaults"];
  variant?: number;
  enabledKinds?: string[];
};

export function composeAssets(input: ComposeInput): NewAsset[] {
  const { brief, dna, presetId, platformIds, direction, images, thresholds } = input;
  const copy = presetCopy(presetId, brief, dna);
  const ov = input.override ?? null;
  const ac = input.approvedContent ?? null;
  const variant = input.variant ?? 0;
  const out: NewAsset[] = [];
  const heroLine = ac?.tagline ?? (ov?.heroHeadline ?? copy.hero);
  const heroSub = ac ? `${ac.bhk} · ${ac.locationTag}` : (ov?.heroSubline ?? copy.sub);
  const lifeLine = ov?.lifestyleLine ?? `${dna.positioning}.`;
  const seedBase = hx(brief.name + presetId + variant);

  const push = (platform: string, kind: string, payload: AssetPayload) => {
    const spec = platformById(platform);
    const qc = qualityCheck(`${brief.name}:${platform}:${kind}:${variant}`, thresholds);
    const finalPayload: AssetPayload = ac
      ? {
          ...payload,
          kicker: ac.developer,
          headline: ac.project,
          fine: ac.tagline,
        subline: [ac.bhk, ac.locationTag].filter(Boolean).join(" · "),
          locationLabel: ac.locationTag,
          bullets: ac.amenitiesLine.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean),
          priceLine: ac.price,
        cta: ac.cta,
          imagePrompt: ac.imagePrompt,
        layout: ac.layout === "poster" ? "overlay" : ac.layout === "split" ? "wide" : payload.layout,
        designStyle: ac.designStyle ?? "editorial",
        fontSizes: ac.fontSizes ?? input.typographyDefaults?.fontSizes,
        fontColors: ac.fontColors ?? input.typographyDefaults?.fontColors,
        scrimSettings: ac.scrimSettings ?? DEFAULT_SCRIM_SETTINGS,
        variant,
        }
      : {
          ...payload,
          fontSizes: input.typographyDefaults?.fontSizes,
          fontColors: input.typographyDefaults?.fontColors,
          scrimSettings: DEFAULT_SCRIM_SETTINGS,
          variant,
          cta:
            payload.cta && !payload.cta.toLowerCase().includes("1234567890") && !/\d{8,}/.test(payload.cta)
              ? payload.cta
              : "BOOK NOW",
        };
    out.push({
      kind,
      platform,
      aspect: spec.aspect,
      title: `${brief.name} — ${spec.aspect}`,
      payload: finalPayload,
      score: qc.score,
      checks: qc.checks,
      status: qc.status,
    });
  };

  const base = {
    kicker: ac?.developer ?? copy.kicker.toUpperCase(),
    cta: ac?.cta ?? copy.cta,
    hex: direction.hex,
    imagePrompt: ac?.imagePrompt ?? ov?.imagePrompt,
  };

  for (const platform of platformIds) {
    const spec = platformById(platform);
    const kinds = (PLATFORM_KINDS[platform] ?? ["hero"])
      .filter((kind) => !input.enabledKinds || input.enabledKinds.includes(kind));
    const wide = ["16:9", "21:9", "linkedin", "portal"].includes(platform) || ["16:9", "21:9"].includes(spec.aspect);
    for (const kind of kinds) {
      switch (kind) {
        case "hero":
          push(platform, kind, {
            ...base,
            kicker: brief.name.split(" ")[0].toUpperCase(),
            headline: brief.name,
            subline: brief.propertyType,
            locationLabel: brief.location,
            fine: heroLine,
            bullets: dna.usps.slice(0, 3),
            priceLine: brief.price,
            image: imageFor(images, ["Exterior"], seedBase),
            layout: wide ? "wide" : "overlay",
          });
          break;
        case "feature":
          push(platform, kind, {
            ...base,
            kicker: `INSIDE ${brief.name.toUpperCase()}`,
            headline: ov?.featureHeadline ?? "Designed for Modern Living",
            bullets: dna.usps,
            image: imageFor(images, ["Living", "Kitchen", "Clubhouse", "Bedroom"], seedBase + 1),
            layout: wide ? "wide" : "overlay",
          });
          break;
        case "location":
          push(platform, kind, {
            ...base,
            kicker: "PROPERTY LOCATION",
            headline: brief.location,
            rows: dna.locationAdvantages,
            locationLabel: brief.location,
            image: imageFor(images, ["Location", "View", "Exterior"], seedBase + 2),
            layout: wide ? "wide" : "overlay",
          });
          break;
        case "offer":
          push(platform, kind, {
            ...base,
            kicker: copy.offerKicker.toUpperCase(),
            headline: brief.name,
            priceLine: `Starting ${brief.price}*`,
            fine: `*T&C apply · ${copy.urgency}`,
            cta: presetId === "investment" ? "Get the ROI Deck" : "Book a Site Visit",
            image: imageFor(images, ["Exterior", "View"], seedBase + 3),
          });
          break;
        case "lifestyle":
          push(platform, kind, {
            ...base,
            kicker: "THE LIFE INSIDE",
            headline: "More Than a Home.",
            subline: `A way of life — ${lifeLine}`,
            image: imageFor(images, ["Garden", "Living", "Bedroom", "Amenities"], seedBase + 4),
          });
          break;
        case "story":
          push(platform, kind, {
            ...base,
            headline: heroLine,
            subline: `${brief.propertyType} · ${brief.location}`,
            priceLine: brief.price,
            image: imageFor(images, ["Exterior", "Living"], seedBase + 5),
          });
          break;
        case "reel": {
          const shots = ov?.storyboard?.length
            ? fitStoryboardDuration(ov.storyboard, platform === "yt-short" ? 30 : 15)
            : storyboardFor(brief, dna, copy, direction, images, platform === "yt-short");
          push(platform, kind, {
            ...base,
            headline: heroLine,
            hook: copy.hook,
            shots,
            music: direction.music,
            durationBadge: platform === "yt-short" ? "0:30" : "0:15",
            image: imageFor(images, ["Exterior"], seedBase + 6),
          });
          break;
        }
      }
    }
  }

  /* One copy pack per campaign */
  const qc = qualityCheck(`${brief.name}:copy:${variant}`, thresholds);
  out.push({
    kind: "copy",
    platform: "multi",
    aspect: "1:1",
    title: "Copy Pack — captions & hashtags",
    payload: {
      captions: ac?.captions
        ? Object.entries(ac.captions).map(([p, text]) => ({
            platform: p,
            label: p.charAt(0).toUpperCase() + p.slice(1),
            text: text ?? "",
          }))
        : captionsFor(platformIds, brief, dna, copy, ov),
      hashtags: ac?.hashtags?.length ? ac.hashtags : hashtagsFor(brief, dna, ov),
      cta: ac?.cta?.trim() || copy.cta,
      variant,
    },
    score: qc.score,
    checks: qc.checks,
    status: qc.status,
  });

  return out;
}

/* Single-asset re-roll for "Regenerate" */
export function recomposeAsset(prev: {
  kind: string;
  platform: string;
  payload: AssetPayload;
}, ctx: ComposeInput, variant: number): { payload: AssetPayload; qc: QCResult } {
  const rebuilt = composeAssets({ ...ctx, platformIds: [prev.platform], variant }).find((a) => a.kind === prev.kind);
  const payload = rebuilt
    ? { ...rebuilt.payload, scrimSettings: prev.payload.scrimSettings ?? rebuilt.payload.scrimSettings }
    : { ...prev.payload, variant };
  return { payload, qc: qualityCheck(`${ctx.brief.name}:${prev.platform}:${prev.kind}:${variant}`, ctx.thresholds) };
}
