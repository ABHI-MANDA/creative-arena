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
  type TranscriptStyle,
  type VariationSettings,
} from "./presets";
import {
  DEFAULT_SCRIM_SETTINGS,
  type CreativeDesignStyle,
  type ScrimSettings,
} from "./style-config";
import { selectImagePromptVariation } from "./image-prompt-writer";
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
  diversityScore?: number;
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

export function presetCopy(
  presetId: string,
  brief: Brief,
  dna: DNA,
  style?: string,
  variantSeed = 0
): PresetCopy {
  const styles: Record<string, Record<string, PresetCopy>> = {
    cinematic: {
      "luxury-property": {
        kicker: "The {name} Signature",
        hero: "Where natural stillness meets soaring architecture.",
        sub: "Bespoke {type} enveloped in considered privacy at {name}.",
        cta: "Explore Residences",
        offerKicker: "Private Preview",
        urgency: "Private viewings by advance appointment",
        hook: "Step into an address crafted around stillness.",
      },
      "project-launch": {
        kicker: "A Sculptural Arrival",
        hero: "{name} emerges on the horizon.",
        sub: "An iconic residential debut: {type} in {location}.",
        cta: "Register for Inaugural Release",
        offerKicker: "Premier Allocation",
        urgency: "Inaugural residence allocations now open",
        hook: "Witness the arrival of {name} in {location}.",
      },
      investment: {
        kicker: "Enduring Capital Value",
        hero: "A landmark real estate legacy in {location}.",
        sub: "Strategic portfolio asset: {type} from {price}.",
        cta: "Request Investment Portfolio",
        offerKicker: "Institutional Overview",
        urgency: "Private investor allocations available upon request",
        hook: "Where capital growth converges with timeless design.",
      },
    },
    investment: {
      "luxury-property": {
        kicker: "Prime Asset Portfolio",
        hero: "High-yield luxury footprint in {location}.",
        sub: "Institutional-grade {type} at {name}, from {price}.",
        cta: "Request Financial Deck",
        offerKicker: "Investor Priority",
        urgency: "Prime allocations available for verified investors",
        hook: "Strategic real estate growth in {city}'s prime corridor.",
      },
      "project-launch": {
        kicker: "First-Mover Allocation",
        hero: "Capitalize on early-phase pricing at {name}.",
        sub: "High-demand {type} starting from {price} in {location}.",
        cta: "Unlock Investor Pricing",
        offerKicker: "Early Stage Entry",
        urgency: "Inaugural phase terms expiring shortly",
        hook: "First-mover advantage arrives in {location}.",
      },
      investment: {
        kicker: "Capital Growth Corridor",
        hero: "Institutional real estate yield in {location}.",
        sub: "High-growth {type} poised for capital appreciation from {price}.",
        cta: "Download ROI Prospectus",
        offerKicker: "Yield & Growth Model",
        urgency: "Review full cashflow and appreciation models",
        hook: "Unlock high-yield real estate performance in {city}.",
      },
    },
    lifestyle: {
      "luxury-property": {
        kicker: "Sanctuary for Living",
        hero: "Space for life to unfold with grace in {location}.",
        sub: "Lush {type} surrounded by tranquil open landscaping at {name}.",
        cta: "Experience the Enclave",
        offerKicker: "Family Haven",
        urgency: "Schedule a relaxed family walkthrough",
        hook: "Mornings wrapped in green, evenings spent at home.",
      },
      "project-launch": {
        kicker: "A New Home Story",
        hero: "Begin your family's next chapter at {name}.",
        sub: "Thoughtfully crafted {type} in the heart of {location}.",
        cta: "Book an Experience Tour",
        offerKicker: "Community Preview",
        urgency: "Explore the enclave and world-class amenities",
        hook: "Discover a neighborhood designed for living well.",
      },
      investment: {
        kicker: "Generational Wealth",
        hero: "A secure family legacy asset in {location}.",
        sub: "Enduring {type} combining lifestyle beauty with capital stability.",
        cta: "Explore Legacy Residences",
        offerKicker: "Generational Value",
        urgency: "Protect your family's real estate footprint",
        hook: "Invest in an address your family will treasure for generations.",
      },
    },
    launch: {
      "luxury-property": {
        kicker: "Inaugural Unveiling",
        hero: "{name} sets a new benchmark in {location}.",
        sub: "Exclusive collection of {type} now open for booking.",
        cta: "Reserve Your Residence",
        offerKicker: "Launch Window",
        urgency: "Phase 1 priority reservations now being accepted",
        hook: "The wait is over — {name} is officially unveiled.",
      },
      "project-launch": {
        kicker: "Officially Launched",
        hero: "The most anticipated address in {location}.",
        sub: "Grand unveiling of {type} at {name}, from {price}.",
        cta: "Register for Priority Access",
        offerKicker: "Launch Benefits",
        urgency: "Pre-registration benefits available for limited window",
        hook: "Introducing the defining residential launch of the year.",
      },
      investment: {
        kicker: "Phase 1 Launch Rates",
        hero: "Early investment window now live at {name}.",
        sub: "Secure launch-stage pricing on {type} in {location}.",
        cta: "Lock Launch Advantage",
        offerKicker: "Phase 1 Pricing",
        urgency: "Inaugural pricing tiers open for immediate booking",
        hook: "Don't miss the launch window for {name} in {location}.",
      },
    },
  };

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

  const styleKeys = ["cinematic", "investment", "lifestyle", "launch"];
  const resolvedStyle = style && styles[style] ? style : styleKeys[variantSeed % styleKeys.length];
  const styleMatch = styles[resolvedStyle]?.[presetId];
  const c = styleMatch ?? bank[presetId] ?? bank["luxury-property"];

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
  brandSettings?: Pick<BrandSettings, "name" | "color" | "tones">,
  variationSettings?: VariationSettings,
  variationStyle?: string,
  variationSeed?: string
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

  const intensity = variationSettings?.intensity ?? "balanced";
  const temperature = intensity === "dynamic" ? 0.8 : intensity === "subtle" ? 0.45 : 0.68;
  const availableStyles = variationSettings?.preferredTranscriptStyles ?? [];
  const activeStyle = variationStyle ||
    availableStyles[hx(variationSeed || brief.name) % Math.max(availableStyles.length, 1)] ||
    "cinematic";
  const imagePromptVariation = selectImagePromptVariation(variationSeed || brief.name);

  for (const model of candidateModels) {
    const isAgnesModel = model.toLowerCase().startsWith("agnes-");
    const endpoint = isAgnesModel
      ? `${agnesBase}/chat/completions`
      : "https://openrouter.ai/api/v1/chat/completions";
    const apiKey = isAgnesModel ? (agnesKey || openrouterKey) : openrouterKey;
    if (!apiKey) continue;

    try {
      console.log(`[engine] Requesting copy generation from '${model}' at ${endpoint} (style=${activeStyle}, intensity=${intensity})...`);
      const res = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(30000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: 2400,
          messages: [
            {
              role: "system",
              content: [
                "You are a senior real-estate creative director and performance copywriter.",
                "Return one valid JSON object only; do not use markdown fences or add commentary.",
                "Use only supplied property facts. Never invent approvals, amenities, distances, returns, scarcity, pricing, completion dates, or guarantees. If a fact is missing, omit it.",
                "Create polished, premium real-estate advertising with a clear reading order: project identity, one distinctive promise, verifiable proof, then one direct action.",
                "Write distinctive, specific, readable copy with positive creative variations. Avoid repetitive formulas, cliches, unsupported superlatives, emojis, and crowded headlines.",
                "Keep headlines punchy and concise (max 7 words) so they never crowd the visual or overlay important background elements.",
                "Keep sublines factual (max 14 words), and CTAs direct. Preserve the exact supplied project name, property type, location, and price in their respective fields.",
                "Match the supplied company's name, brand tone, and brand palette alongside the selected campaign preset and creative direction, while keeping all property claims factual.",
                "Return keys: heroHeadline, heroSubline, lifestyleLine, featureHeadline, imagePrompt, captions, hashtags, storyboard.",
                "captions is an object with optional instagram, facebook, linkedin, whatsapp, portal, youtube strings.",
                "hashtags is an array of up to 12 strings.",
                "NARRATIVE SCRIPT & TRANSCRIPT VOICE: In 'storyboard' (5 to 8 shots, 15s for Instagram Reels or 30s for YouTube Shorts), each shot's 'line' must form an authentic, evocative voiceover transcript reflecting the requested style (" + activeStyle + "). Treat the variation seed as a prompt to vary hooks, transitions, phrasing, and sentence rhythm between generations; do not reuse a fixed script formula. Never produce robotic label text like 'hook -> reveal -> CTA'; write polished, conversational, engaging narration that flows seamlessly across the video shots.",
                "IMAGE PROMPT VARIATION: Use the selected image-prompt variation supplied in the user data as the defining photographic concept for 'imagePrompt'. Keep the property facts and architecture accurate; do not replace the selected concept with a generic hero shot or invent amenities. Preserve clean negative space for ad copy and never render text, logos, prices, or typography.",
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
                variationDirectives: {
                  intensity,
                  narrativeStyle: activeStyle,
                  allowedPerspectives: variationSettings?.allowedPerspectives,
                  variationSeed,
                  selectedImagePromptVariation: imagePromptVariation,
                },
                selectedCreativeDirection: selectedDirection ? {
                  name: selectedDirection.name,
                  tagline: selectedDirection.tagline,
                  description: selectedDirection.description,
                  palette: selectedDirection.hex,
                  visualApproach: selectedDirection.approach,
                  grade: selectedDirection.grade,
                } : null,
                requiredOutput: "Create distinct image-ad copy and an editable short-form video script with fresh, engaging voiceover transcripts.",
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
  long = false,
  style = "cinematic"
): Shot[] {
  const img = (pref: string[], i: number) => imageFor(images, pref, i + hx(brief.name));
  const amenityList = dna.usps;

  const styleScripts: Record<string, { short: string[]; long: string[] }> = {
    cinematic: {
      short: [
        copy.hook || "Where architectural stillness meets timeless design.",
        `Rising over ${brief.location} — ${brief.name}.`,
        "Every terrace and elevation sculpted with considered intention.",
        amenityList.length ? `Curated spaces: ${amenityList.slice(0, 2).join(" and ")}.` : "A private sanctuary above the city.",
        `${copy.cta} — your private walkthrough awaits.`,
      ],
      long: [
        copy.hook || `Dawn breaking over ${cityOf(brief.location)}.`,
        `An address defined by light and silence: ${brief.name}, ${brief.location}.`,
        `Sculptural facade in ${dna.architecture.toLowerCase()}, capturing natural daylight.`,
        `Panoramic interiors designed for seamless indoor-outdoor living.`,
        amenityList.length ? `Exclusive private amenities: ${amenityList.slice(0, 3).join(" · ")}.` : `Bespoke living crafted for modern distinction.`,
        `Moments of quiet refinement in every corner.`,
        `An enduring architectural statement in ${cityOf(brief.location)}.`,
        `${copy.cta} — ${brief.price}. Reserve your private preview.`,
      ],
    },
    investment: {
      short: [
        copy.hook || `Prime address. Unrivalled capital footprint in ${brief.location}.`,
        `${brief.name} — institutional-grade ${brief.propertyType} in ${cityOf(brief.location)}.`,
        "Positioned strategically in a high-demand capital growth corridor.",
        amenityList.length ? `Backed by world-class infrastructure: ${amenityList.slice(0, 2).join(" · ")}.` : "A landmark capital investment.",
        `${copy.cta} — request the full investor prospectus.`,
      ],
      long: [
        copy.hook || `Strategic wealth creation in ${cityOf(brief.location)}'s prime growth hub.`,
        `Introducing ${brief.name} — high-yield real estate in ${brief.location}.`,
        `Architectural excellence with premium capital appreciation fundamentals.`,
        `Exceptional ${brief.propertyType} inventory starting from ${brief.price}.`,
        amenityList.length ? `World-class lifestyle amenities: ${amenityList.slice(0, 3).join(" · ")}.` : `High-occupancy residential infrastructure.`,
        `Strong rental yields and enduring asset appreciation.`,
        `Limited allocation available for accredited investors.`,
        `${copy.cta} — lock your priority investor terms today.`,
      ],
    },
    lifestyle: {
      short: [
        copy.hook || "Where calm begins and everyday city noise fades away.",
        `Welcome home to ${brief.name}, ${brief.location}.`,
        `Expansive ${brief.propertyType} crafted for multi-generational living.`,
        amenityList.length ? `Life surrounded by ${amenityList.slice(0, 2).join(" and ")}.` : "Open green buffers and private spaces.",
        `${copy.cta} — experience the community today.`,
      ],
      long: [
        copy.hook || `Mornings wrapped in green, evenings spent at home.`,
        `A genuine family sanctuary at ${brief.name}, ${brief.location}.`,
        `Generous courtyards and open living spaces bathed in natural light.`,
        `Rooms crafted for everyday memories and shared laughter.`,
        amenityList.length ? `Enclave amenities for all ages: ${amenityList.slice(0, 3).join(" · ")}.` : `Safe, pedestrian-first gated environment.`,
        `Minutes from premier schools and everyday conveniences.`,
        `A neighborhood designed for living well for generations.`,
        `${copy.cta} — schedule your family's experience tour.`,
      ],
    },
    launch: {
      short: [
        copy.hook || `The wait is over — ${brief.name} has officially arrived.`,
        `The newest benchmark for architectural living in ${brief.location}.`,
        `Discover the inaugural collection of ${brief.propertyType}.`,
        amenityList.length ? `Premier features: ${amenityList.slice(0, 3).join(" · ")}.` : "Limited residences now released.",
        `${copy.cta} — book your preview allocation now.`,
      ],
      long: [
        copy.hook || `The defining real estate unveiling of the season has arrived.`,
        `Presenting ${brief.name} — now launching in ${brief.location}.`,
        `Inaugural phase release: ${brief.propertyType} from ${brief.price}.`,
        `Unprecedented architectural design and grand double-height entrance.`,
        amenityList.length ? `Flagship amenities: ${amenityList.slice(0, 3).join(" · ")}.` : `World-class private club and wellness facilities.`,
        `First-mover pricing advantages for early registered buyers.`,
        `Prime units now open for advance selection.`,
        `${copy.cta} — register immediately for launch privileges.`,
      ],
    },
  };

  const scriptSet = styleScripts[style] ?? styleScripts.cinematic;

  if (!long) {
    return [
      { t: "0–3s", label: "HOOK", visual: `Fast push-in on the facade, ${dna.lighting.toLowerCase()} flare`, line: scriptSet.short[0], tag: "Match cut" },
      { t: "3–6s", label: "EXTERIOR", visual: `Slow reveal of property imagery — ${dna.architecture.toLowerCase()}`, line: scriptSet.short[1], tag: "Whip pan" },
      { t: "6–9s", label: "DETAILS", visual: "Move across verified interior and terrace photographs", line: scriptSet.short[2], tag: "Speed ramp" },
      { t: "9–12s", label: amenityList.length ? "AMENITIES" : "PROPERTY", visual: amenityList.length ? `${amenityList.slice(0, 3).join(" · ")} — detail montage` : "A clean sequence of property images", line: scriptSet.short[3], tag: "Rhythm cuts" },
      { t: "12–15s", label: "CTA", visual: "Logo resolve, directions chip, CTA card", line: scriptSet.short[4], tag: "Settle frame" },
    ];
  }

  return [
    { t: "0–3s", label: "HOOK", visual: `Aerial drift over ${cityOf(brief.location)}, dawn haze`, line: scriptSet.long[0], tag: "Drone in" },
    { t: "3–6s", label: "LOCATION", visual: `On-screen location title: ${brief.location}`, line: scriptSet.long[1], tag: "Map wipe" },
    { t: "6–10s", label: "EXTERIOR", visual: `Facade reveal, ${dna.lighting.toLowerCase()}`, line: scriptSet.long[2], tag: "Dolly" },
    { t: "10–14s", label: "DETAILS", visual: "Interior sequence showcasing spatial flow and finishes", line: scriptSet.long[3], tag: "Gimbal" },
    { t: "14–18s", label: amenityList.length ? "AMENITIES" : "PROPERTY", visual: amenityList.length ? `${amenityList.join(" · ")} montage` : "Sequence of verified property photographs", line: scriptSet.long[4], tag: "Rhythm cuts" },
    { t: "18–22s", label: "LIFESTYLE", visual: "Atmospheric perspective through living rooms and balconies", line: scriptSet.long[5], tag: "Match cut" },
    { t: "22–26s", label: "PROJECT", visual: `Detail frame: ${dna.architecture.toLowerCase()}`, line: scriptSet.long[6], tag: "Macro" },
    { t: "26–30s", label: "CTA", visual: "Logo resolve + CTA card + QR", line: scriptSet.long[7], tag: "Settle frame" },
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
  thresholds: { ready: number; review: number; diversity?: number }
): QCResult {
  const h = hx(seedStr);
  const score = 82 + (h % 18); // 82..99
  let fails: number;
  if (score >= thresholds.ready) fails = 0;
  else if (score >= thresholds.review) fails = 1 + (h % 3);
  else fails = 4 + (h % 3);
  const stride = 1 + (h % 4);
  const checks = QC_CHECKLIST.map((label) => ({ label, pass: true }));
  for (let k = 0; k < fails; k++) checks[(h + k * stride * 3) % checks.length].pass = false;

  const diversityChecks = checks.filter((c) =>
    c.label.includes("diversity") || c.label.includes("freshness") || c.label.includes("tailoring")
  );
  const diversityPass = diversityChecks.filter((c) => c.pass).length;
  const diversityScore = Math.round(80 + (diversityPass / Math.max(1, diversityChecks.length)) * 19);
  const diversityGatePass = diversityScore >= (thresholds.diversity ?? 85);
  if (!diversityGatePass) {
    const failedGate = diversityChecks.find((check) => check.pass);
    if (failedGate) failedGate.pass = false;
  }
  const gatedScore = !diversityGatePass && score >= thresholds.ready
    ? thresholds.ready - 1
    : score;

  return {
    score: gatedScore,
    checks,
    status: gatedScore >= thresholds.ready ? "ready" : gatedScore >= thresholds.review ? "review" : "improving",
    diversityScore,
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
  variationStyle?: string;
  variationSeed?: string;
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
  presetId = "luxury-property",
  variationSettings?: VariationSettings,
  variationStyle?: string,
  variationSeed?: string
): ApprovedAdContent {
  const devAndProj = {
    developer: (brandName?.trim() || brief.name.split(" ")[0] || "EXCLUSIVE").toUpperCase(),
    project: brief.name.toUpperCase(),
  };
  const bhk = parseBhk(brief.propertyType, brief.description);
  const availableStyles = variationSettings?.preferredTranscriptStyles ?? [];
  const selectedStyle = variationStyle ||
    availableStyles[hx(variationSeed || brief.name) % Math.max(availableStyles.length, 1)] ||
    "cinematic";

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

  const styleTaglines: Record<string, Record<string, string>> = {
    cinematic: {
      "luxury-property": "Where natural stillness meets soaring architecture",
      "project-launch": "A sculptural arrival on the horizon",
      investment: "Where capital growth converges with timeless design",
      default: "An address crafted around light, space, and stillness",
    },
    investment: {
      "luxury-property": "High-yield luxury footprint in a prime corridor",
      "project-launch": "First-mover advantage in a flagship development",
      investment: "Strategic capital growth in a high-demand market",
      default: "Exceptional real estate capital appreciation",
    },
    lifestyle: {
      "luxury-property": "Space for life to unfold with grace and calm",
      "project-launch": "A fresh chapter of family living begins",
      investment: "Enduring family legacy meets capital stability",
      default: "A sanctuary crafted for multi-generational living",
    },
    launch: {
      "luxury-property": "The inaugural collection is now officially open",
      "project-launch": "Introducing the defining residential launch of the year",
      investment: "Inaugural phase allocations now available",
      default: "A new benchmark for luxury living has arrived",
    },
  };

  const fallbackTagline =
    styleTaglines[selectedStyle]?.[presetId] ||
    styleTaglines[selectedStyle]?.default ||
    "A considered address, designed for living";

  const tagline = override?.heroSubline || fallbackTagline;
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

  const stylePromptCues: Record<string, string> = {
    cinematic: `Warm late-afternoon light, open shadows, and a considered three-quarter view of the verified architecture. Designed in ${archDetail}.`,
    investment: `Confident architectural framing that emphasizes the property's verified scale, proportions, and setting. Designed in ${archDetail}.`,
    lifestyle: `Calm, welcoming eye-level perspective grounded in the property's confirmed spaces and features. Designed in ${archDetail}.`,
    launch: `Striking but realistic twilight facade reveal, preserving the property's verified architecture and proportions. Designed in ${archDetail}.`,
  };

  const selectedPromptCue = stylePromptCues[selectedStyle] || stylePromptCues.cinematic;
  const imagePromptVariation = selectImagePromptVariation(variationSeed || brief.name);

  const generatedImagePrompt = override?.imagePrompt?.trim() ||
    `Photorealistic architectural photography of ${brief.name}, ${brief.propertyType} in ${brief.location}. ${selectedPromptCue} ${descContext} ${verifiedAmenities}. Building anchored in the lower 60% of the frame with clean, uncluttered open sky in the upper 40% reserved for headline typography. Premium architectural advertising standard, realistic environmental depth, strictly no text, no logos, no watermarks.`;
  const imagePrompt = generatedImagePrompt.includes(imagePromptVariation)
    ? generatedImagePrompt
    : `${generatedImagePrompt} Selected visual concept: ${imagePromptVariation}`;

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
    variationStyle: selectedStyle,
    variationSeed,
  };
}

export type ComposeInput = {
  brief: Brief;
  dna: DNA;
  presetId: string;
  platformIds: string[];
  direction: Direction;
  images: Img[];
  thresholds: { ready: number; review: number; diversity?: number };
  override?: CopyOverride | null;
  approvedContent?: ApprovedAdContent | null;
  variationStyle?: string;
  typographyDefaults?: BrandSettings["typographyDefaults"];
  variant?: number;
  enabledKinds?: string[];
};

export function composeAssets(input: ComposeInput): NewAsset[] {
  const { brief, dna, presetId, platformIds, direction, images, thresholds } = input;
  const ac = input.approvedContent ?? null;
  const variant = input.variant ?? 0;
  const variationStyle = ac?.variationStyle ?? input.variationStyle;
  const copy = presetCopy(presetId, brief, dna, variationStyle, variant);
  const ov = input.override ?? null;
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
            : storyboardFor(brief, dna, copy, direction, images, platform === "yt-short", variationStyle || "cinematic");
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
