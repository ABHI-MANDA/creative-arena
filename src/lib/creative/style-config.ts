export type CreativeDesignStyle = "editorial" | "minimal" | "bold";

export type ScrimSettings = {
  opacity: number;
  color: string;
  height: number;
};

export const DEFAULT_SCRIM_SETTINGS: ScrimSettings = {
  opacity: 65,
  color: "#0c1012",
  height: 48,
};

export const SCRIM_PRESETS: {
  label: string;
  settings: ScrimSettings;
}[] = [
  { label: "Dark Ambient", settings: { opacity: 65, color: "#0c1012", height: 48 } },
  { label: "Soft Shadow", settings: { opacity: 30, color: "#000000", height: 35 } },
  { label: "Deep Vignette", settings: { opacity: 80, color: "#000000", height: 85 } },
  { label: "No Scrim", settings: { opacity: 0, color: "#000000", height: 48 } },
];

export const CREATIVE_DESIGN_STYLES: {
  value: CreativeDesignStyle;
  label: string;
}[] = [
  { value: "editorial", label: "Editorial" },
  { value: "minimal", label: "Minimal" },
  { value: "bold", label: "Bold" },
];

export const CREATIVE_STYLE_CONFIG = {
  colors: {
    background: "#16272e",
    dark: "#1e3f4d",
    accent: "#d9ab5e",
    light: "#f4eee1",
    text: "#fffdf5",
    mutedText: "rgba(244, 238, 225, 0.92)",
    ctaBackground: "#ffffff",
    ctaForeground: "#171208",
  },
  typography: {
    sans: "Inter, sans-serif",
    display: "'Playfair Display', serif",
    mono: "monospace",
  },
  image: {
    filter: "saturate(1.08) contrast(1.035) brightness(0.94)",
    scale: 1.015,
  },
  canvasExport: {
    background: "#0c1012",
    topScrimColor: "rgba(52, 146, 201, 0.65)",
    topScrimFade: "rgba(52, 146, 201, 0)",
  },
  layout: {
    widePanelWidth: "44%",
    widePanelPadding: "2.4cqw 2.8cqw",
    posterHeaderPadding: "3.8cqw 4cqw",
    ctaRadius: 4,
  },
  effects: {
    textShadow: "0 2px 14px rgba(127, 163, 180, 0.95), 0 1px 3px rgb(143, 179, 189)",
    headlineShadow: "0 3px 20px rgba(110, 145, 158, 0.95), 0 1px 3px rgb(124, 159, 175)",
    ctaShadow: "0 -2px 16px rgba(0,0,0,.35)",
  },
} as const;

export function contrastingTextBackground(color: string): string {
  const hex = /^#[\da-f]{6}$/i.test(color) ? color.slice(1) : "171208";
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const luminance = channels
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.5 ? CREATIVE_STYLE_CONFIG.colors.dark : CREATIVE_STYLE_CONFIG.colors.ctaBackground;
}

export type CreativeStyle = {
  design: CreativeDesignStyle;
  colors: {
    background: string;
    dark: string;
    accent: string;
    light: string;
    text: string;
    mutedText: string;
    ctaBackground: string;
    ctaForeground: string;
  };
  typography: typeof CREATIVE_STYLE_CONFIG.typography;
  image: typeof CREATIVE_STYLE_CONFIG.image;
  canvasExport: typeof CREATIVE_STYLE_CONFIG.canvasExport;
  layout: typeof CREATIVE_STYLE_CONFIG.layout;
  effects: typeof CREATIVE_STYLE_CONFIG.effects;
};

function normalizeHex(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (/^#[\da-f]{6}$/i.test(value)) return value;
  if (/^#[\da-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return fallback;
}

export function resolveCreativeStyle(
  hex?: string[],
  design: CreativeDesignStyle = "editorial"
): CreativeStyle {
  const [dark, accent, light] = hex ?? [];
  return {
    ...CREATIVE_STYLE_CONFIG,
    design,
    colors: {
      ...CREATIVE_STYLE_CONFIG.colors,
      dark: normalizeHex(dark, CREATIVE_STYLE_CONFIG.colors.dark),
      accent: normalizeHex(accent, CREATIVE_STYLE_CONFIG.colors.accent),
      light: normalizeHex(light, CREATIVE_STYLE_CONFIG.colors.light),
    },
  };
}
