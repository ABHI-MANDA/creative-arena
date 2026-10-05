/* Campaign presets, platform specs, ad-system config and the sample shot library. */

export type PlatformSpec = {
  id: string;
  label: string;
  short: string;
  aspect: string;
  icon: string;
  note: string;
  video?: boolean;
};

export const PLATFORMS: PlatformSpec[] = [
  { id: "ig-reel", label: "Instagram Reel", short: "Reel", aspect: "9:16", icon: "Instagram", note: "15–30s · hook first", video: true },
  { id: "ig-post", label: "Instagram Post", short: "Post", aspect: "1:1", icon: "Instagram", note: "1:1 feed square" },
  { id: "ig-story", label: "Instagram Story", short: "Story", aspect: "9:16", icon: "Instagram", note: "9:16 · CTA low" },
  { id: "fb-ad", label: "Facebook Ad", short: "Facebook", aspect: "1:1", icon: "Facebook", note: "1:1 feed square" },
  { id: "yt-short", label: "YouTube Short", short: "Short", aspect: "9:16", icon: "Youtube", note: "≤ 30s · 9:16", video: true },
  { id: "linkedin", label: "LinkedIn", short: "LinkedIn", aspect: "1:1", icon: "Linkedin", note: "1:1 square" },
  { id: "whatsapp", label: "WhatsApp", short: "WhatsApp", aspect: "1:1", icon: "MessageCircle", note: "1:1 · broadcast" },
  { id: "portal", label: "Property Portal", short: "Portal", aspect: "1:1", icon: "Globe", note: "1:1 square" },
];

export const platformById = (id: string): PlatformSpec =>
  PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[1];

export type Preset = {
  id: string;
  label: string;
  icon: string;
  desc: string;
  objective: string;
  defaultPlatforms: string[];
};

export const PRESETS: Preset[] = [
  { id: "luxury-property", label: "Luxury Property", icon: "Crown", desc: "Position the home as a rare, premium address.", objective: "Desire & brand positioning", defaultPlatforms: ["ig-post", "ig-reel", "ig-story", "linkedin"] },
  { id: "project-launch", label: "Project Launch", icon: "Rocket", desc: "Announce the project to the market with impact.", objective: "Awareness & registrations", defaultPlatforms: ["ig-post", "fb-ad", "yt-short", "whatsapp"] },
  { id: "new-phase-launch", label: "New Phase Launch", icon: "Layers", desc: "Open bookings for the next phase of the project.", objective: "Phase-II bookings", defaultPlatforms: ["ig-post", "fb-ad", "whatsapp"] },
  { id: "property-sale", label: "Property Sale", icon: "BadgePercent", desc: "Drive enquiries, walkthroughs and site visits.", objective: "Lead generation", defaultPlatforms: ["ig-post", "fb-ad", "whatsapp", "portal"] },
  { id: "rental", label: "Rental", icon: "KeyRound", desc: "Fill premium rentals fast with the right tenants.", objective: "Rental enquiries", defaultPlatforms: ["fb-ad", "whatsapp", "portal"] },
  { id: "investment", label: "Investment", icon: "TrendingUp", desc: "ROI-led narrative for investor audiences.", objective: "Investor leads", defaultPlatforms: ["linkedin", "fb-ad", "portal"] },
  { id: "open-house", label: "Open House", icon: "DoorOpen", desc: "Invite buyers to experience the home in person.", objective: "Event footfall", defaultPlatforms: ["ig-post", "ig-story", "whatsapp"] },
  { id: "festival-offer", label: "Festival Offer", icon: "Sparkles", desc: "Festive season offers, tokens and waivers.", objective: "Time-boxed offers", defaultPlatforms: ["ig-post", "fb-ad", "whatsapp"] },
  { id: "construction-progress", label: "Construction Progress", icon: "HardHat", desc: "Build trust with real, on-camera milestones.", objective: "Confidence & trust", defaultPlatforms: ["linkedin", "ig-reel", "fb-ad"] },
  { id: "location-highlight", label: "Location Highlight", icon: "MapPin", desc: "Sell the neighbourhood, not just the home.", objective: "Location-led desire", defaultPlatforms: ["ig-reel", "ig-post", "portal"] },
];

export const presetById = (id: string): Preset =>
  PRESETS.find((p) => p.id === id) ?? PRESETS[0];

/* Which ad templates each platform receives */
export const PLATFORM_KINDS: Record<string, string[]> = {
  "ig-post": ["hero", "feature", "location", "lifestyle", "offer"],
  "ig-story": ["story", "offer"],
  "ig-reel": ["reel"],
  "fb-ad": ["hero", "offer", "location"],
  "yt-short": ["reel"],
  linkedin: ["hero", "feature"],
  whatsapp: ["offer", "story"],
  portal: ["hero", "feature", "location"],
};

export const KIND_LABELS: Record<string, string> = {
  hero: "Hero Ad",
  feature: "Feature Ad",
  location: "Location Ad",
  offer: "Offer Ad",
  lifestyle: "Lifestyle Ad",
  story: "Story Frame",
  reel: "Reel Sequence",
  copy: "Copy Pack",
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
