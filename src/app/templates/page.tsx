import { LayoutTemplate, Move, Ruler, ShieldCheck, Type } from "lucide-react";
import { ensureSeed } from "@/db/seed";
import { getBrand } from "@/db/queries";
import {
  KIND_BLURBS,
  KIND_LABELS,
  PLATFORMS,
  PRESETS,
  SAMPLE_BLUEPRINTS,
  SAMPLE_SHOTS,
} from "@/lib/creative/presets";
import { analyzeDNA, presetCopy } from "@/lib/creative/engine";
import { AssetVisual, type AdAssetLike } from "@/components/ad-creative";
import { Chip, DynIcon, SectionHead } from "@/components/ui";
import { TemplateManager } from "./template-manager";

export const revalidate = 3600;

const bp = SAMPLE_BLUEPRINTS[0];
const brief = { name: bp.name, location: bp.location, propertyType: bp.propertyType, price: bp.price, audience: bp.audience, amenities: bp.amenities };
const dna = analyzeDNA(brief);
const copy = presetCopy("luxury-property", brief, dna);
const shot = (label: string, idx: number) =>
  SAMPLE_SHOTS.find((s) => s.set === "villa" && s.label === label)?.url ?? SAMPLE_SHOTS[idx].url;

export default async function TemplatesPage() {
  await ensureSeed();
  const brand = await getBrand();

  const samples: AdAssetLike[] = [
    { kind: "hero", platform: "ig-post", aspect: "4:5", payload: { kicker: copy.kicker.toUpperCase(), headline: copy.hero, subline: copy.sub, priceLine: brief.price, cta: copy.cta, image: shot("Exterior", 0), hex: ["#0B0A08", "#D9AB5E", "#8C6B4A"] } },
    { kind: "feature", platform: "ig-post", aspect: "4:5", payload: { kicker: "INSIDE " + brief.name.toUpperCase(), headline: "Designed for Modern Living", bullets: dna.usps, cta: copy.cta, image: shot("Living", 1), hex: ["#0B0A08", "#D9AB5E", "#8C6B4A"] } },
    { kind: "location", platform: "ig-post", aspect: "4:5", payload: { kicker: "CONNECTED TO EVERYTHING", headline: "Everything Within Minutes", rows: dna.locationAdvantages, cta: "Explore the Location", image: "/images/props/aerial.jpg", hex: ["#0B0A08", "#D9AB5E", "#8C6B4A"] } },
    { kind: "offer", platform: "ig-post", aspect: "4:5", payload: { kicker: "LIMITED PERIOD OFFER", headline: brief.name, priceLine: `Starting ${brief.price}*`, fine: "*T&C apply · Limited residences", cta: "Book a Site Visit", image: shot("Amenities", 3), hex: ["#0B0A08", "#D9AB5E", "#8C6B4A"] } },
    { kind: "lifestyle", platform: "ig-post", aspect: "4:5", payload: { kicker: "THE LIFE INSIDE", headline: "More Than a Home.", subline: `A way of life — ${dna.positioning}.`, cta: copy.cta, image: shot("Garden", 4), hex: ["#0B0A08", "#D9AB5E", "#8C6B4A"] } },
    { kind: "hero", platform: "linkedin", aspect: "1.91:1", payload: { kicker: copy.kicker.toUpperCase(), headline: "A rare address in Whitefield, Bengaluru.", subline: copy.sub, priceLine: brief.price, cta: copy.cta, image: shot("Exterior", 0), layout: "wide", hex: ["#0B0A08", "#D9AB5E", "#8C6B4A"] } },
  ];

  const rules = [
    { icon: Type, title: "AI visuals, template type", body: "Generative models never render logo, headline, price or CTA — the design engine locks those to the brand grid. Typography stays sharp, legal and on-brand." },
    { icon: Ruler, title: "Safe zones, enforced", body: "Every frame respects platform UI overlays — Stories keep the CTA low, Reels dodge the right rail, portals keep the logo off the carousel chrome." },
    { icon: Move, title: "Composition DNA", body: "Kicker → serif headline → proof → price/CTA. One idea per frame. The image carries the dream; the grid carries the brand." },
    { icon: ShieldCheck, title: "QC before publish", body: "Each frame clears the 11-point brand check and your thresholds before it can be marked Ready to Post." },
  ];

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="anim-up mb-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">Ad System</div>
        <h1 className="font-display mt-2 text-[34px] font-medium leading-tight">Deterministic design, <span className="gold-text italic">generative vision.</span></h1>
        <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-mute">
          Campaigns are assembled from these battle-tested real-estate templates. AI handles the
          photography and atmosphere; the design engine handles everything a buyer must actually read.
        </p>
      </div>

      <TemplateManager samples={samples} brand={brand} />

      {/* rules */}
      <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {rules.map((r, i) => (
          <div key={r.title} className="anim-up panel panel-hover p-5" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="mb-3 w-fit rounded-xl bg-gold/10 p-2.5 text-gold hairline"><r.icon size={16} /></div>
            <div className="font-display text-[16px]">{r.title}</div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-mute">{r.body}</p>
          </div>
        ))}
      </div>

      {/* presets */}
      <div className="mt-10">
        <SectionHead kicker="One-click" title={`Campaign Presets · ${PRESETS.length}`} />
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          {PRESETS.map((p, i) => (
            <div key={p.id} className="anim-up panel panel-hover p-4.5 p-5" style={{ animationDelay: `${i * 40}ms` }}>
              <DynIcon name={p.icon} size={18} className="text-gold" />
              <div className="mt-3 text-[14px] font-medium">{p.label}</div>
              <p className="mt-1 text-[11.5px] leading-snug text-faint">{p.desc}</p>
              <div className="mt-3 border-t border-line pt-3">
                <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-faint">Default platforms</div>
                <div className="flex gap-1.5 text-mute">
                  {p.defaultPlatforms.map((pl) => (
                    <span key={pl} title={pl}><DynIcon name={PLATFORMS.find((x) => x.id === pl)?.icon ?? "Globe"} size={13} /></span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* aspect system */}
      <div className="mt-10">
        <SectionHead kicker="Formats" title="Platform-first aspect system" />
        <div className="panel grid gap-0 overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORMS.map((pl, i) => (
            <div key={pl.id} className="anim-up flex items-center gap-3.5 border-b border-line/60 px-5 py-4 sm:border-r" style={{ animationDelay: `${i * 30}ms` }}>
              <span className="rounded-lg border border-line bg-panel2 p-2 text-gold"><DynIcon name={pl.icon} size={15} /></span>
              <div className="flex-1">
                <div className="text-[13px] font-medium">{pl.label}</div>
                <div className="font-mono text-[9.5px] uppercase tracking-widest text-faint">{pl.note}</div>
              </div>
              <Chip tone="gold">{pl.aspect}</Chip>
            </div>
          ))}
        </div>
      </div>

      <div className="anim-up mt-10 flex items-center gap-4 rounded-2xl border border-gold/25 bg-gold/5 px-6 py-5">
        <LayoutTemplate size={20} className="shrink-0 text-gold" />
        <p className="text-[13px] leading-relaxed text-cream/85">
          <span className="font-medium text-gold">Design tokens travel with the campaign.</span>{" "}
          Swap the Brand Kit gold for your developer brand and every template — present and future —
          re-locks instantly. No creative agency turnaround, no off-brand posts.
        </p>
      </div>
    </div>
  );
}
