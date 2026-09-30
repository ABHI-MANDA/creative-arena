import type { AssetPayload } from "@/lib/creative/engine";
import Image from "next/image";
import type { BrandSettings } from "@/lib/creative/presets";
import { platformById } from "@/lib/creative/presets";
import { aspectCss, cx, ratioOf } from "@/lib/utils";
import { ArrowUpRight, BadgeCheck, Film, MapPin } from "lucide-react";
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

/* ---------- brand lock-up ---------- */
function BrandRow({ brand }: { brand: BrandSettings }) {
  return (
    <div className="flex items-center" style={{ gap: "1.6cqw" }}>
      <Image
        src="/images/brand-logo.png"
        alt=""
        width={128}
        height={128}
        style={{ width: "4.6cqw", height: "4.6cqw", minWidth: 14, minHeight: 14 }}
        className="object-contain"
      />
      <span
        className="font-mono uppercase"
        style={{ fontSize: "2.1cqw", letterSpacing: "0.34em", color: "rgba(244,238,225,.92)" }}
      >
        {brand.name}
      </span>
    </div>
  );
}

function CtaPill({ cta, wide, poster }: { cta: string; wide?: boolean; poster?: boolean }) {
  return (
    <span
      className="inline-flex items-center font-sans"
      style={{
        gap: "1cqw",
        background: poster ? "linear-gradient(180deg,#fffef8,#e7eee8)" : "linear-gradient(180deg,#ecc987,#c08b3c)",
        color: poster ? "#17251b" : "#171208",
        borderRadius: 999,
        padding: poster ? "1.55cqw 3.1cqw" : wide ? "1cqw 2.4cqw" : "1.5cqw 3.4cqw",
        boxShadow: poster ? "0 1cqw 3cqw rgba(0,0,0,.32)" : "0 0.8cqw 2.4cqw rgba(0,0,0,.35)",
      }}
    >
      <span className={wide ? "adw-cta" : "ad-cta"}>{cta}</span>
      <ArrowUpRight style={{ width: wide ? "2cqw" : "3cqw", height: wide ? "2cqw" : "3cqw", minWidth: 8, minHeight: 8 }} />
    </span>
  );
}

function PriceGhost({ price, wide }: { price: string; wide?: boolean }) {
  return (
    <span
      style={{
        border: "1px solid rgba(244,238,225,.35)",
        color: "rgba(244,238,225,.92)",
        borderRadius: 999,
        padding: wide ? "0.9cqw 2cqw" : "1.3cqw 3cqw",
        backdropFilter: "blur(6px)",
        background: "rgba(11,10,8,.28)",
      }}
    >
      <span className={wide ? "adw-price" : "ad-price"} style={{ fontSize: wide ? "2.2cqw" : "3.4cqw" }}>
        {price}
      </span>
    </span>
  );
}

function PosterBody({ asset, brand }: { asset: AdAssetLike; brand: BrandSettings }) {
  const p = asset.payload;
  const spec = platformById(asset.platform);
  const bullets = (p.bullets ?? []).slice(0, 3);

  return (
    <div className="absolute inset-0 flex flex-col" style={{ padding: "4.8cqw" }}>
      <div className="flex items-start justify-between">
        <BrandRow brand={brand} />
        <span className="ad-micro font-mono uppercase" style={{ border: "1px solid rgba(244,238,225,.36)", borderRadius: 999, padding: "0.8cqw 2cqw", background: "rgba(7,15,12,.28)" }}>
          {spec.short} · {asset.aspect}
        </span>
      </div>

      <div className="mt-[5cqw] text-center">
        {p.kicker && <div className="ad-poster-kicker">{p.kicker}</div>}
        <h3 className="ad-poster-title">{p.headline}</h3>
        {p.subline && <p className="ad-poster-type">{p.subline}</p>}
        {p.fine && <p className="ad-poster-tagline">{p.fine}</p>}
      </div>

      <div className="mt-auto">
        {bullets.length > 0 && (
          <div className="ad-poster-benefits">
            {bullets.map((bullet) => <span key={bullet}>{bullet}</span>)}
          </div>
        )}
        <div className="ad-poster-details">
          {p.locationLabel && (
            <div className="ad-poster-location">
              <MapPin style={{ width: "3.1cqw", height: "3.1cqw", minWidth: 11, minHeight: 11 }} />
              <span>{p.locationLabel}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between" style={{ gap: "2cqw", marginTop: "2.2cqw" }}>
            {p.priceLine && <span className="ad-poster-price">{p.priceLine}</span>}
            {p.cta && <CtaPill cta={p.cta} poster />}
          </div>
        </div>
        <div className="mt-[2.4cqw] flex justify-between">
          <span className="ad-micro">{brand.domain}</span>
          <span className="ad-micro uppercase" style={{ letterSpacing: "0.18em" }}>THE RESIDENCES</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- overlay compositions ---------- */
function OverlayBody({ asset, brand }: { asset: AdAssetLike; brand: BrandSettings }) {
  const p = asset.payload;
  const spec = platformById(asset.platform);
  const portrait = ratioOf(asset.aspect) <= 1;

  if (asset.kind === "hero") return <PosterBody asset={asset} brand={brand} />;

  const bullets = (p.bullets ?? []).slice(0, 4);
  const rows = (p.rows ?? []).slice(0, 4);

  return (
    <div className="absolute inset-0 flex flex-col justify-between" style={{ padding: "4.6cqw" }}>
      <div className="flex items-start justify-between">
        <BrandRow brand={brand} />
        <span
          className="ad-micro font-mono uppercase"
          style={{ border: "1px solid rgba(244,238,225,.25)", borderRadius: 999, padding: "0.8cqw 2cqw" }}
        >
          {spec.short} · {asset.aspect}
        </span>
      </div>

      <div className="flex flex-col" style={{ gap: "1.6cqw" }}>
        {asset.kind === "offer" && (
          <span
            className="ad-chip self-start font-mono uppercase"
            style={{
              background: "linear-gradient(180deg,#ecc987,#c08b3c)",
              color: "#171208",
              borderRadius: "0.8cqw",
              padding: "1cqw 2.2cqw",
              letterSpacing: "0.24em",
            }}
          >
            {p.kicker}
          </span>
        )}
        {asset.kind !== "offer" && p.kicker && <span className="ad-kicker">{p.kicker}</span>}

        {asset.kind === "lifestyle" || asset.kind === "reel" ? (
          <h3 className="ad-h-ital">{asset.kind === "reel" ? p.hook : p.headline}</h3>
        ) : (
          <h3 className="ad-h" style={asset.kind === "offer" ? { fontSize: "6.4cqw" } : undefined}>
            {p.headline}
          </h3>
        )}

        {asset.kind === "hero" || asset.kind === "story" ? (
          <p className="ad-sub" style={{ maxWidth: "80%" }}>{p.subline}</p>
        ) : null}

        {asset.kind === "lifestyle" && p.subline && <p className="ad-sub" style={{ maxWidth: "86%" }}>{p.subline}</p>}

        {asset.kind === "feature" && (
          <div className="grid grid-cols-2" style={{ gap: "1.4cqw", marginTop: "0.6cqw" }}>
            {bullets.map((b) => (
              <div
                key={b}
                className="ad-chip flex items-center"
                style={{
                  gap: "1.2cqw",
                  border: "1px solid rgba(244,238,225,.22)",
                  background: "rgba(11,10,8,.34)",
                  backdropFilter: "blur(5px)",
                  borderRadius: "1cqw",
                  padding: "1.3cqw 1.8cqw",
                }}
              >
                <span style={{ width: "0.9cqw", height: "0.9cqw", minWidth: 3, minHeight: 3, borderRadius: 999, background: "#d9ab5e" }} />
                {b}
              </div>
            ))}
          </div>
        )}

        {asset.kind === "location" && (
          <div style={{ marginTop: "1cqw" }}>
            {rows.map((r, i) => (
              <div
                key={r.label}
                className="ad-row flex items-center justify-between"
                style={{
                  borderTop: i === 0 ? "none" : "1px solid rgba(244,238,225,.16)",
                  padding: "1.15cqw 0",
                }}
              >
                <span style={{ color: "rgba(244,238,225,.92)" }}>{r.label}</span>
                {r.mins !== undefined && (
                  <span className="font-mono" style={{ color: "#d9ab5e", fontSize: "2.6cqw" }}>
                    {r.mins} MIN
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {asset.kind === "offer" && (
          <>
            <div className="ad-price" style={{ color: "#ecd9ac" }}>{p.priceLine}</div>
            {p.fine && <div className="ad-micro">{p.fine}</div>}
          </>
        )}

        {asset.kind === "reel" && (
          <div className="flex flex-wrap items-center" style={{ gap: "1.4cqw" }}>
            <span
              className="ad-chip inline-flex items-center font-mono uppercase"
              style={{ gap: "1cqw", border: "1px solid rgba(217,171,94,.5)", color: "#d9ab5e", borderRadius: 999, padding: "1cqw 2.2cqw" }}
            >
              <Film style={{ width: "2.6cqw", height: "2.6cqw", minWidth: 9 }} /> {(p.shots ?? []).length}-shot storyboard
            </span>
            <span className="ad-micro">{p.music}</span>
          </div>
        )}

        {p.cta && asset.kind !== "reel" && (
          <div className="flex items-center" style={{ gap: "1.8cqw", marginTop: "0.6cqw" }}>
            <CtaPill cta={p.cta} />
            {(asset.kind === "hero" || asset.kind === "story") && p.priceLine && <PriceGhost price={p.priceLine} />}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="ad-micro">{asset.kind === "reel" ? "Made with M & A Creative Engine" : (p.subline && asset.kind !== "story" ? "" : "")}{brand.domain}</span>
        {portrait && <span className="ad-micro uppercase" style={{ letterSpacing: "0.22em" }}>{asset.kind.toUpperCase()} SERIES</span>}
      </div>
    </div>
  );
}

/* ---------- wide (split) compositions ---------- */
function WideBody({ asset, brand }: { asset: AdAssetLike; brand: BrandSettings }) {
  const p = asset.payload;
  const bullets = (p.bullets ?? []).slice(0, 3);
  const rows = (p.rows ?? []).slice(0, 4);
  return (
    <div className="absolute inset-0 flex">
      <div
        className="flex h-full flex-col justify-between"
        style={{ width: "46%", padding: "2.6cqw", background: "linear-gradient(160deg,#17140f,#100e0a)", borderRight: "1px solid rgba(217,171,94,.25)" }}
      >
        <BrandRow brand={brand} />
        <div style={{ marginTop: "1.4cqw" }}>
          {p.kicker && <div className="adw-kicker" style={{ marginBottom: "1cqw" }}>{p.kicker}</div>}
          <h3 className="adw-h">{p.headline}</h3>
          {p.subline && <p className="adw-sub" style={{ marginTop: "1cqw" }}>{p.subline}</p>}
          {bullets.length > 0 && (
            <div style={{ marginTop: "1.2cqw", display: "grid", gap: "0.7cqw" }}>
              {bullets.map((b) => (
                <div key={b} className="adw-chip flex items-center" style={{ gap: "0.8cqw", color: "rgba(244,238,225,.9)" }}>
                  <span style={{ width: "0.6cqw", height: "0.6cqw", minWidth: 3, minHeight: 3, borderRadius: 99, background: "#d9ab5e" }} />
                  {b}
                </div>
              ))}
            </div>
          )}
          {rows.length > 0 && (
            <div style={{ marginTop: "1cqw" }}>
              {rows.map((r, i) => (
                <div key={r.label} className="adw-row flex justify-between" style={{ borderTop: i ? "1px solid rgba(244,238,225,.14)" : "none", padding: "0.7cqw 0" }}>
                  <span style={{ color: "rgba(244,238,225,.9)" }}>{r.label}</span>
                  {r.mins !== undefined && <span className="font-mono" style={{ color: "#d9ab5e", fontSize: "1.7cqw" }}>{r.mins} MIN</span>}
                </div>
              ))}
            </div>
          )}
          {asset.kind === "offer" && p.priceLine && <div className="adw-price" style={{ marginTop: "1cqw", color: "#ecd9ac" }}>{p.priceLine}</div>}
        </div>
        <div className="flex items-center" style={{ gap: "1.4cqw" }}>
          {p.cta && <CtaPill cta={p.cta} wide />}
          {p.priceLine && asset.kind === "hero" && <PriceGhost price={p.priceLine} wide />}
        </div>
      </div>
      <div className="relative h-full flex-1">
        <img src={p.image} alt={asset.title ?? "ad visual"} className="ad-img" />
        <div className="ad-wide-scrim" />
        <span className="adw-micro absolute" style={{ right: "1.6cqw", bottom: "1.4cqw" }}>{brand.domain}</span>
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
  const wide = asset.payload.layout === "wide" || ["linkedin", "portal"].includes(asset.platform);
  const receipt: string | undefined = asset.payload.hex?.[1];

  return (
    <div className={cx("adframe select-none", className)} style={{ aspectRatio: aspectCss(asset.aspect), borderRadius: "inherit" }}>
      {!wide && (
        <>
          <img src={asset.payload.image} alt={asset.title ?? "ad visual"} className="ad-img" />
          <div className="ad-scrim" />
          {receipt && (
            <div style={{ position: "absolute", inset: 0, background: receipt, opacity: 0.08, mixBlendMode: "soft-light" }} />
          )}
        </>
      )}
      {wide && <div className="absolute inset-0 bg-coal" />}

      {wide ? <WideBody asset={asset} brand={brand} /> : <OverlayBody asset={asset} brand={brand} />}

      {showGuides && (
        <>
          <div className="safe-guide" style={{ inset: "4%" }} />
          <div className="safe-guide" style={{ inset: "8%", borderColor: "rgba(217,171,94,.45)" }} />
        </>
      )}

      {showScore && typeof asset.score === "number" && (
        <div className="absolute right-2 top-2 z-10 rounded-xl bg-ink/80 p-1 backdrop-blur">
          <ScoreRing score={asset.score} size={34} />
        </div>
      )}
      {asset.approved && (
        <div className="absolute left-2 top-2 z-10 rounded-full bg-ink/80 p-1 text-sage backdrop-blur">
          <BadgeCheck size={15} />
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
          <div className="flex items-center gap-2">
            <Image src="/images/brand-logo.png" alt="" width={24} height={24} className="h-6 w-6 object-contain" />
            <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-mute">{brand.name}</span>
          </div>
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
