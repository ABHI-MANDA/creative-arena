/* Campaign presets, aspect ratio specifications, ad-system config and the sample shot library. */

export type PlatformSpec = {
  id: string;
  label: string;
  short: string;
  aspect: string;
  icon?: string;
  note?: string;
  video?: boolean;
};

export const ASPECT_RATIOS: PlatformSpec[] = [
  { id: "9:16", label: "9:16", short: "9:16", aspect: "9:16", icon: "Smartphone", note: "9:16" },
  { id: "1:1", label: "1:1", short: "1:1", aspect: "1:1", icon: "Square", note: "1:1" },
  { id: "4:5", label: "4:5", short: "4:5", aspect: "4:5", icon: "RectangleVertical", note: "4:5" },
  { id: "16:9", label: "16:9", short: "16:9", aspect: "16:9", icon: "RectangleHorizontal", note: "16:9" },
  { id: "4:3", label: "4:3", short: "4:3", aspect: "4:3", icon: "Maximize", note: "4:3" },
  { id: "3:2", label: "3:2", short: "3:2", aspect: "3:2", icon: "Camera", note: "3:2" },
  { id: "2:3", label: "2:3", short: "2:3", aspect: "2:3", icon: "Grid", note: "2:3" },
  { id: "21:9", label: "21:9", short: "21:9", aspect: "21:9", icon: "Tv", note: "21:9" },
];

export const PLATFORMS: PlatformSpec[] = ASPECT_RATIOS;

export const platformById = (id: string): PlatformSpec => {
  const match = ASPECT_RATIOS.find((p) => p.id === id || p.aspect === id);
  if (match) return match;
  const legacyToAspect: Record<string, string> = {
    "ig-reel": "9:16",
    "ig-story": "9:16",
    "yt-short": "9:16",
    "ig-post": "1:1",
    "fb-ad": "1:1",
    "linkedin": "16:9",
    "whatsapp": "1:1",
    "portal": "16:9",
  };
  const asp = legacyToAspect[id] || "1:1";
  return ASPECT_RATIOS.find((p) => p.aspect === asp) ?? ASPECT_RATIOS[0];
};

export type Preset = {
  id: string;
  label: string;
  icon: string;
  desc: string;
  objective: string;
  defaultPlatforms: string[];
};

export const PRESETS: Preset[] = [
  { id: "luxury-property", label: "Luxury Property", icon: "Crown", desc: "Position the home as a rare, premium address.", objective: "Desire & brand positioning", defaultPlatforms: ["9:16", "1:1", "4:5", "16:9"] },
  { id: "project-launch", label: "Project Launch", icon: "Rocket", desc: "Announce the project to the market with impact.", objective: "Awareness & registrations", defaultPlatforms: ["9:16", "1:1", "4:5", "16:9"] },
  { id: "new-phase-launch", label: "New Phase Launch", icon: "Layers", desc: "Open bookings for the next phase of the project.", objective: "Phase-II bookings", defaultPlatforms: ["9:16", "1:1", "4:5", "16:9"] },
  { id: "property-sale", label: "Property Sale", icon: "BadgePercent", desc: "Drive enquiries, walkthroughs and site visits.", objective: "Lead generation", defaultPlatforms: ["9:16", "1:1", "4:5", "16:9"] },
  { id: "rental", label: "Rental", icon: "KeyRound", desc: "Fill premium rentals fast with the right tenants.", objective: "Rental enquiries", defaultPlatforms: ["9:16", "1:1", "4:5", "16:9"] },
  { id: "investment", label: "Investment", icon: "TrendingUp", desc: "ROI-led narrative for investor audiences.", objective: "Investor leads", defaultPlatforms: ["9:16", "1:1", "4:5", "16:9"] },
  { id: "open-house", label: "Open House", icon: "DoorOpen", desc: "Invite buyers to experience the home in person.", objective: "Event footfall", defaultPlatforms: ["9:16", "1:1", "4:5", "16:9"] },
  { id: "festival-offer", label: "Festival Offer", icon: "Sparkles", desc: "Festive season offers, tokens and waivers.", objective: "Time-boxed offers", defaultPlatforms: ["9:16", "1:1", "4:5", "16:9"] },
  { id: "construction-progress", label: "Construction Progress", icon: "HardHat", desc: "Build trust with real, on-camera milestones.", objective: "Confidence & trust", defaultPlatforms: ["9:16", "1:1", "4:5", "16:9"] },
  { id: "location-highlight", label: "Location Highlight", icon: "MapPin", desc: "Sell the neighbourhood, not just the home.", objective: "Location-led desire", defaultPlatforms: ["9:16", "1:1", "4:5", "16:9"] },
];

export const presetById = (id: string): Preset =>
  PRESETS.find((p) => p.id === id) ?? PRESETS[0];

/* Which ad templates each platform receives */
export const PLATFORM_KINDS: Record<string, string[]> = {
  "9:16": ["hero"],
  "1:1": ["hero"],
  "4:5": ["hero"],
  "16:9": ["hero"],
  "4:3": ["hero"],
  "3:2": ["hero"],
  "2:3": ["hero"],
  "21:9": ["hero"],
  "ig-post": ["hero"],
  "ig-story": ["hero"],
  "ig-reel": ["hero"],
  "fb-ad": ["hero"],
  "yt-short": ["hero"],
  linkedin: ["hero"],
  whatsapp: ["hero"],
  portal: ["hero"],
};

export const KIND_LABELS: Record<string, string> = {
  hero: "Ad Post",
  feature: "Ad Post",
  location: "Ad Post",
  offer: "Ad Post",
  lifestyle: "Ad Post",
  story: "Ad Post",
  reel: "Ad Post",
  copy: "Ad Post",
};

export const KIND_BLURBS: Record<string, string> = {
  hero: "The signature frame. Image-led, brand-first, one idea.",
  feature: "USP grid over interiors. Proof, not poetry.",
  location: "Time-to-everything rows. The commute is the ad.",
  offer: "Price burst + deadline. Built to convert.",
  lifestyle: "Emotional serif line over the life inside.",
  story: "9:16 with a low CTA, safe-zone aware.",
  reel: "Shot-by-shot storyboard: hook → reveal → CTA.",
  copy: "Captions + hashtags per platform, on-brand.",
};

export const DEFAULT_THRESHOLDS = { ready: 95, review: 80 };

export type BrandSettings = {
  name: string;
  mark: string;
  color: string;
  domain: string;
  tones: string[];
  thresholds: { ready: number; review: number };
};

export const DEFAULT_BRAND: BrandSettings = {
  name: "M & A",
  mark: "M",
  color: "#D9AB5E",
  domain: "",
  tones: ["Elegant", "Trustworthy"],
  thresholds: DEFAULT_THRESHOLDS,
};

export const QC_CHECKLIST = [
  "Property accuracy",
  "Brand consistency",
  "Visual quality",
  "Text readability",
  "CTA visibility",
  "Logo placement",
  "Aspect ratio",
  "Safe margins",
  "No unwanted objects",
  "No distorted architecture",
  "No incorrect property claims",
];

export const SAMPLE_SHOTS: { url: string; label: string; set: string }[] = [
  { url: "/images/props/villa-hero.jpg", label: "Exterior", set: "villa" },
  { url: "/images/props/villa-living.jpg", label: "Living", set: "villa" },
  { url: "/images/props/villa-bedroom.jpg", label: "Bedroom", set: "villa" },
  { url: "/images/props/villa-pool.jpg", label: "Amenities", set: "villa" },
  { url: "/images/props/villa-garden.jpg", label: "Garden", set: "villa" },
  { url: "/images/props/tower-hero.jpg", label: "Exterior", set: "tower" },
  { url: "/images/props/tower-clubhouse.jpg", label: "Clubhouse", set: "tower" },
  { url: "/images/props/tower-kitchen.jpg", label: "Kitchen", set: "tower" },
  { url: "/images/props/tower-view.jpg", label: "View", set: "tower" },
  { url: "/images/props/aerial.jpg", label: "Location", set: "both" },
];

export const SAMPLE_BLUEPRINTS = [
  {
    id: "villa",
    name: "Green Valley Estates",
    location: "Whitefield, Bengaluru",
    propertyType: "4 BHK Luxury Villas",
    price: "₹4.8 Cr onwards",
    audience: "CXOs and premium family buyers, 38–55",
    amenities: "Private garden, Smart home, Clubhouse, Infinity pool, Tree-lined avenues, EV charging",
    description:
      "A gated enclave of 62 courtyard villas wrapped in tropical landscaping, minutes from Bengaluru's tech corridor.",
  },
  {
    id: "tower",
    name: "Skyline Heights Residences",
    location: "Hebbal, Bengaluru",
    propertyType: "2/3/4 BHK Sky Residences",
    price: "₹1.45 Cr onwards",
    audience: "Young tech leaders and NRI investors, 28–45",
    amenities: "Sky deck, Infinity pool, Concierge, Co-work lounge, Spa, Kids' zone",
    description:
      "A 34-storey glass tower with a 1.2 acre sky deck, concierge living and Hebbal lake views.",
  },
];
