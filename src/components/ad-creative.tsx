import type { AdTextSection, AssetPayload } from "@/lib/creative/engine";
import Image from "next/image";
import type { BrandSettings } from "@/lib/creative/presets";
import { platformById } from "@/lib/creative/presets";
import { aspectCss, cx, ratioOf } from "@/lib/utils";
import { BadgeCheck, Film, MapPin } from "lucide-react";
import { ScoreRing } from "./ui";

export type AdAssetLike = {
  kind: string;
  platform: string;
  aspect: string;
  title?: string;
  payload: AssetPayload;
  score?: number;
  status?: string;
  approved?: boolean;
};

function getPaletteTones(hex?: string[]) {
  const dark = hex?.[0] || "#0c100d";
  const accent = hex?.[1] || "#d9ab5e";
  const light = hex?.[2] || "#f4eee1";
  return { dark, accent, light };
}

function scaledFontSize(
  payload: AssetPayload,
  section: AdTextSection,
  minimum: number,
  preferred: number,
  maximum: number
) {
  const percentage = payload.fontSizes?.[section];
  const scale = typeof percentage === "number" && Number.isFinite(percentage)
    ? Math.min(1.4, Math.max(0.75, percentage / 100))
    : 1;
  return `clamp(${(minimum * scale).toFixed(1)}px, ${(preferred * scale).toFixed(2)}cqw, ${(maximum * scale).toFixed(1)}px)`;
}

/* ---------- brand lock-up ---------- */
function BrandRow({ brand }: { brand: BrandSettings }) {
  return null;
}

function CtaPill({ cta, wide, poster, accent = "#d9ab5e" }: { cta: string; wide?: boolean; poster?: boolean; accent?: string }) {
  if (typeof cta !== "string" && typeof cta !== "number") return null;
  return (
    <span
      className="inline-flex items-center font-sans font-semibold tracking-wide"
      style={{
        gap: "1cqw",
        background: poster ? "linear-gradient(180deg,#fffef8,#edf2ee)" : `linear-gradient(180deg,#fffdf7,${accent})`,
        color: poster ? "#131b14" : "#171208",
        borderRadius: 999,
        padding: poster ? "1.55cqw 3.1cqw" : wide ? "1cqw 2.4cqw" : "1.5cqw 3.4cqw",
        boxShadow: poster ? "0 1cqw 3.2cqw rgba(0,0,0,.45), 0 0.2cqw 0.8cqw rgba(0,0,0,.25)" : "0 1cqw 3.2cqw rgba(0,0,0,.45), 0 0.3cqw 1cqw rgba(0,0,0,.35)",
      }}
    >
      <span className={wide ? "adw-cta" : "ad-cta"}>{String(cta)}</span>
    </span>
  );
}

function PriceGhost({ price, wide }: { price: string; wide?: boolean }) {
  if (typeof price !== "string" && typeof price !== "number") return null;
  return (
    <span
      style={{
        border: "1px solid rgba(255,255,255,.38)",
        color: "rgba(255,253,245,.95)",
        borderRadius: 999,
        padding: wide ? "0.9cqw 2cqw" : "1.3cqw 3cqw",
        backdropFilter: "blur(8px)",
        background: "rgba(8,12,10,.48)",
        boxShadow: "0 0.6cqw 2cqw rgba(0,0,0,.3)",
      }}
    >
      <span className={wide ? "adw-price" : "ad-price"} style={{ fontSize: wide ? "2.2cqw" : "3.4cqw" }}>
        {String(price)}
      </span>
    </span>
  );
}

function safeText(val: unknown): string {
  if (typeof val === "string" || typeof val === "number") return String(val);
  return "";
}

function parseBhk(propertyType?: string, subline?: string): string {
  const combined = `${propertyType ?? ""} ${subline ?? ""}`;
  const match = combined.match(/\b(\d+(?:\s*[,/&]\s*\d+)*\s*BHK)\b/i);
  if (match) {
    return match[1].replace(/\s*\/\s*/g, " & ").toUpperCase();
  }
  return "";
}

function parseDeveloperAndProject(
  kicker?: string,
  headline?: string,
  brandName?: string
): { developer: string; project: string } {
  if (kicker !== undefined && !kicker.trim()) {
    return { developer: "", project: (headline || "").toUpperCase() };
  }
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

function PosterBody({ asset, brand }: { asset: AdAssetLike; brand: BrandSettings }) {
  const p = asset.payload;
  const minimal = p.designStyle === "minimal";
  const bold = p.designStyle === "bold";
  const bullets = (p.bullets ?? []).slice(0, 3);

  const { developer, project } = parseDeveloperAndProject(p.kicker, p.headline, brand.name);
  const bhk = parseBhk(p.subline, p.kicker);
  const locationTag = p.locationLabel
    ? p.locationLabel.toUpperCase()
    : p.subline
    ? p.subline.toUpperCase()
    : "";
  const amenitiesLine = bullets.length >= 2
    ? `${bullets[0]} | ${bullets[1]}`.toUpperCase()
    : bullets.length === 1
    ? bullets[0].toUpperCase()
    : "";
  const tagline = p.fine?.toUpperCase() ?? "";
  const price = p.priceLine ?? "";
  const contactText = p.cta?.toUpperCase() ?? "";

  return (
    <div className="poster-copy-zone absolute inset-0 flex flex-col justify-between">
      {/* Upper 40% Sky Typography Zone */}
      <div className={cx("poster-copy-header pt-[3.8cqw] px-[4cqw]", minimal ? "text-left" : "text-center")} style={{ maxWidth: "96%", margin: "0 auto" }}>
        {/* Developer / Brand Name */}
        <div
          className="font-sans font-bold tracking-[0.18em] text-white"
          style={{
            fontSize: scaledFontSize(p, "developer", 11, 3.2, 28),
            textShadow: "0 2px 14px rgba(0,0,0,.95), 0 1px 3px rgba(0,0,0,1)",
          }}
        >
          {developer}
        </div>

        {/* Project Name */}
        <h2
          className="font-sans font-extrabold uppercase tracking-[0.06em] text-white leading-none mt-[0.8cqw]"
          style={{
            fontSize: bold
              ? scaledFontSize(p, "headline", 22, 7.2, 72)
              : scaledFontSize(p, "headline", 20, 6.4, 64),
            textShadow: "0 3px 20px rgba(0,0,0,.95), 0 1px 3px rgba(0,0,0,1)",
            fontFamily: minimal ? "Inter, sans-serif" : undefined,
          }}
        >
          {project}
        </h2>

        {/* Hook / Tagline with subtle divider */}
        {tagline && <div className={cx("mt-[1.4cqw] flex flex-col", minimal ? "items-start" : "items-center")}>
          <p
            className="font-sans font-semibold tracking-[0.16em] text-white/95"
            style={{
              fontSize: scaledFontSize(p, "tagline", 9, 2.3, 22),
              textShadow: "0 2px 12px rgba(0,0,0,.9), 0 1px 2px rgba(0,0,0,1)",
            }}
          >
            {tagline}
          </p>
          <div className="w-[18cqw] h-[1px] bg-white/40 mt-[0.8cqw]" />
        </div>}

        {/* Configuration / BHK Highlight */}
        {bhk && <div
          className="font-sans font-black tracking-tight text-white leading-none mt-[1.6cqw]"
          style={{
            fontSize: scaledFontSize(p, "bhk", 24, 7.6, 76),
            textShadow: "0 4px 24px rgba(0,0,0,1), 0 1px 3px rgba(0,0,0,1)",
          }}
        >
          {bhk}
        </div>}

        {/* Typology & Location Subtitle */}
        {locationTag && <div
          className="font-sans font-semibold tracking-[0.22em] text-white/95 mt-[1.1cqw]"
          style={{
            fontSize: scaledFontSize(p, "location", 8, 2.2, 20),
            textShadow: "0 2px 12px rgba(0,0,0,.9), 0 1px 2px rgba(0,0,0,1)",
          }}
        >
          {locationTag}
        </div>}

        {/* Key Amenities / Open Space Line */}
        {amenitiesLine && <div
          className="font-sans font-medium tracking-[0.12em] text-white/90 mt-[1.1cqw]"
          style={{
            fontSize: scaledFontSize(p, "amenities", 8, 1.95, 18),
            textShadow: "0 2px 10px rgba(0,0,0,.9), 0 1px 2px rgba(0,0,0,1)",
          }}
        >
          {amenitiesLine}
        </div>}

        {/* Price Tag with side lines */}
        {price && <div className={cx("mt-[1.8cqw] flex flex-col", minimal ? "items-start" : "items-center")}>
          <div
            className="font-sans font-semibold tracking-[0.2em] text-white/85 flex items-center gap-[1.5cqw]"
            style={{ fontSize: scaledFontSize(p, "price", 7.5, 1.8, 16) }}
          >
            <span className="w-[6cqw] h-[1px] bg-white/40" />
            <span>STARTING FROM</span>
            <span className="w-[6cqw] h-[1px] bg-white/40" />
          </div>
          <div
            className="font-sans font-black text-white leading-none mt-[0.5cqw]"
            style={{
              fontSize: scaledFontSize(p, "price", 18, 5.6, 54),
              letterSpacing: "-0.01em",
              textShadow: "0 3px 20px rgba(0,0,0,1), 0 1px 3px rgba(0,0,0,1)",
            }}
          >
            {price}
          </div>
        </div>}
      </div>

      {/* Middle Zone remains completely OPEN and UNOBSTRUCTED for the architectural facade and pool */}

      {/* Bottom Contact Call Bar */}
      {contactText &&       <div
      className={cx("poster-cta-ribbon w-full text-center font-sans font-bold text-[#0c120e] mt-auto", minimal && "text-left", bold && "uppercase")}
        style={{
          background: "#ffffff",
          padding: "1.8cqw 2cqw",
        fontSize: bold
          ? scaledFontSize(p, "cta", 12, 3, 28)
          : scaledFontSize(p, "cta", 11, 2.7, 24),
          letterSpacing: "0.06em",
          boxShadow: "0 -2px 16px rgba(0,0,0,.35)",
        borderTop: bold ? `0.55cqw solid ${p.hex?.[1] ?? "#d9ab5e"}` : undefined,
        overflowWrap: "anywhere",
      }}
      >
        {contactText}
      </div>}
    </div>
  );
}

function OverlayBody({ asset, brand }: { asset: AdAssetLike; brand: BrandSettings }) {
  return <PosterBody asset={asset} brand={brand} />;
}

/* ---------- wide (split) compositions ---------- */
function WideBody({ asset, brand }: { asset: AdAssetLike; brand: BrandSettings }) {
  const p = asset.payload;
  const { dark, accent } = getPaletteTones(p.hex);
  const { developer, project } = parseDeveloperAndProject(p.kicker, p.headline, brand.name);
  const bhk = parseBhk(p.subline, p.kicker);
  const tagline = p.fine?.toUpperCase() ?? "";
  const contactText = p.cta?.toUpperCase() ?? "";
  const price = p.priceLine ?? "";
  const bullets = (p.bullets ?? []).slice(0, 3);
  const amenitiesLine = bullets.length >= 2
    ? `${bullets[0]} | ${bullets[1]}`.toUpperCase()
    : bullets.length === 1
    ? bullets[0].toUpperCase()
    : "";

  return (
    <div className={cx("absolute inset-0 flex", p.designStyle === "minimal" && "text-left")}>
      <div
        className="flex h-full flex-col justify-between"
        style={{
          width: "44%",
          padding: "2.4cqw 2.8cqw",
          background: p.designStyle === "bold" ? `linear-gradient(160deg, ${accent}66, ${dark})` : `linear-gradient(160deg, ${dark}, #0b0907)`,
          borderRight: `1px solid ${accent}3d`,
        }}
      >
        <div className="flex flex-col">
          {/* Developer / Brand */}
          <div
            className="font-sans font-bold tracking-[0.18em] text-white/90"
            style={{ fontSize: scaledFontSize(p, "developer", 9, 1.8, 18) }}
          >
            {developer}
          </div>

          {/* Project Title */}
          <h2
            className="font-sans font-extrabold uppercase tracking-[0.06em] text-white leading-tight mt-[0.6cqw]"
            style={{ fontSize: scaledFontSize(p, "headline", 16, 3.6, 36) }}
          >
            {project}
          </h2>

          {/* Tagline */}
          {tagline && <div className="mt-[0.6cqw]">
            <p
              className="font-sans font-semibold tracking-[0.14em] text-white/90"
              style={{ fontSize: scaledFontSize(p, "tagline", 8, 1.4, 14) }}
            >
              {tagline}
            </p>
            <div className="w-[12cqw] h-[1px] bg-white/40 mt-[0.4cqw]" />
          </div>}

          {/* BHK Highlight */}
          {bhk && <div
            className="font-sans font-black tracking-tight text-white leading-none mt-[1.2cqw]"
            style={{ fontSize: scaledFontSize(p, "bhk", 18, 4.2, 42) }}
          >
            {bhk}
          </div>}

          {/* Amenities Line */}
          {amenitiesLine && <div
            className="font-sans font-medium tracking-[0.1em] text-white/85 mt-[0.8cqw]"
            style={{ fontSize: scaledFontSize(p, "amenities", 7, 1.3, 13) }}
          >
            {amenitiesLine}
          </div>}

          {/* Price Block */}
          {price && <div className="mt-[1.2cqw] flex flex-col">
            <div
              className="font-sans font-semibold tracking-[0.18em] text-white/80 flex items-center gap-[0.8cqw]"
              style={{ fontSize: scaledFontSize(p, "price", 7, 1.2, 12) }}
            >
              <span className="w-[3cqw] h-[1px] bg-white/40" />
              <span>STARTING FROM</span>
              <span className="w-[3cqw] h-[1px] bg-white/40" />
            </div>
            <div
              className="font-sans font-black text-white leading-none mt-[0.4cqw]"
              style={{ fontSize: scaledFontSize(p, "price", 14, 3.2, 32) }}
            >
              {price}
            </div>
          </div>}
        </div>

        {/* Bottom Contact Call Bar */}
        {contactText && <div
          className="w-full text-center font-sans font-bold text-[#0c120e] mt-auto"
          style={{
            background: "#ffffff",
            padding: "1.2cqw 1.6cqw",
            fontSize: scaledFontSize(p, "cta", 9, 1.6, 16),
            letterSpacing: "0.06em",
            borderRadius: "4px",
            boxShadow: "0 2px 12px rgba(0,0,0,.35)",
            borderTop: p.designStyle === "bold" ? `0.55cqw solid ${accent}` : undefined,
            overflowWrap: "anywhere",
          }}
        >
          {contactText}
        </div>}
      </div>

      <div className="relative h-full flex-1">
        <img src={p.image} alt={asset.title ?? "ad visual"} className="ad-img" />
        <div
          className="ad-wide-scrim"
          style={{
            background: `linear-gradient(90deg, ${dark}cc, transparent 35%), linear-gradient(180deg, transparent 65%, ${dark}77)`
          }}
        />
      </div>
    </div>
  );
}

/* ---------- main renderer ---------- */
export function AdCreative({
  asset,
  brand,
  showScore = false,
  showGuides = false,
  className,
}: {
  asset: AdAssetLike;
  brand: BrandSettings;
  showScore?: boolean;
  showGuides?: boolean;
  className?: string;
}) {
  const wide = asset.payload.layout ? asset.payload.layout === "wide" : ["linkedin", "portal"].includes(asset.platform);
  const { dark, accent } = getPaletteTones(asset.payload.hex);

  return (
    <div
      className={cx("adframe select-none", className)}
      data-design-style={asset.payload.designStyle ?? "editorial"}
      style={{ aspectRatio: aspectCss(asset.aspect), borderRadius: "inherit" }}
    >
      {!wide && (
        <>
          <img src={asset.payload.image} alt={asset.title ?? "ad visual"} className="ad-img" />
          {/* Dynamic project-adaptive scrim for 100% typography contrast and open focal subject visibility */}
          <div
            className="ad-scrim"
            style={{
              background: `
                radial-gradient(ellipse at 50% 45%, transparent 22%, ${dark}33 100%),
                linear-gradient(180deg, rgba(6,10,8,0.72) 0%, rgba(6,10,8,0.22) 28%, transparent 42%, rgba(4,8,6,0.52) 68%, rgba(3,6,5,0.95) 100%),
                linear-gradient(112deg, ${accent}18, transparent 48%, ${dark}24)
              `
            }}
          />
          {/* Subtle color grading layer tying visual into project Creative DNA */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(135deg, ${accent}0d, ${dark}18)`,
              mixBlendMode: "soft-light",
              pointerEvents: "none",
            }}
          />
        </>
      )}
      {wide && <div className="absolute inset-0 bg-coal" />}

      {wide ? <WideBody asset={asset} brand={brand} /> : <OverlayBody asset={asset} brand={brand} />}

      {showGuides && (
        <>
          <div className="safe-guide" style={{ inset: "4%" }} />
          <div className="safe-guide" style={{ inset: "8%", borderColor: `${accent}73` }} />
        </>
      )}

      {showScore && typeof asset.score === "number" && (
        <div className="absolute right-2 top-2 z-10 rounded-xl bg-ink/80 p-1 backdrop-blur">
          <ScoreRing score={asset.score} size={34} />
        </div>
      )}
    </div>
  );
}

/* ---------- copy pack card ---------- */
export function CopyVisual({
  asset,
  brand,
  className,
}: {
  asset: AdAssetLike;
  brand: BrandSettings;
  className?: string;
}) {
  const p = asset.payload;
  const captions = (p.captions ?? []).slice(0, 2);
  const tags = (p.hashtags ?? []).slice(0, 8);
  return (
    <div className={cx("flex flex-col justify-between bg-coal p-5", className)} style={{ aspectRatio: aspectCss(asset.aspect) }}>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-mute">{brand.name}</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-faint">COPY PACK</span>
        </div>
        {captions.map((c) => (
          <div key={c.platform} className="mb-2.5 rounded-xl border border-line bg-panel p-3">
            <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-gold">{c.label}</div>
            <p className="line-clamp-3 whitespace-pre-line text-[11px] leading-relaxed text-cream/85">{c.text}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] text-mute">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- visual dispatcher ---------- */
export function AssetVisual(props: {
  asset: AdAssetLike;
  brand: BrandSettings;
  showScore?: boolean;
  showGuides?: boolean;
  className?: string;
}) {
  const { asset, className } = props;
  if (asset.kind === "copy") return <CopyVisual asset={asset} brand={props.brand} className={cx("overflow-hidden", className)} />;
  return <AdCreative {...props} />;
}
