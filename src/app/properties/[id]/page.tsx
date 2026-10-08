import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  Clock3,
  FolderOpen,
  Lightbulb,
  MapPin,
  Palette,
  PlaySquare,
  Share2,
  Target,
  Users,
} from "lucide-react";
import { ensureSeed } from "@/db/seed";
import { getBrand, getProperty, listPropertyCampaigns } from "@/db/queries";
import { presetCopy } from "@/lib/creative/engine";
import { AdCreative, type AdAssetLike } from "@/components/ad-creative";
import { BeforeAfter } from "@/components/before-after";
import { AnalyzeButton } from "@/components/analyze-button";
import { CampaignRowCard } from "@/components/cards";
import { Chip, SectionHead, StatusPill } from "@/components/ui";

export const revalidate = 30;

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await ensureSeed();
  const [bundle, brand, campRows] = await Promise.all([getProperty(id), getBrand(), listPropertyCampaigns(id)]);
  if (!bundle) notFound();
  const { property: p, images, dna, campaigns, assets } = bundle;
  const cover = images.find((i) => i.label === "Exterior")?.url ?? images[0]?.url ?? "/images/props/villa-hero.jpg";

  const copy = presetCopy("luxury-property", p, dna ?? {
    architecture: "", palette: [], paletteHex: [], lighting: "", audience: "", positioning: "",
    usps: [], features: { Exterior: [], Interior: [], Amenities: [], Location: [] }, visualStyle: "",
    brandTone: "", locationAdvantages: [], rawAmenities: [],
  });

  const heroSample: AdAssetLike = {
    kind: "hero",
    platform: "ig-post",
    aspect: "16:10",
    payload: {
      kicker: copy.kicker.toUpperCase(),
      headline: copy.hero,
      subline: copy.sub,
      priceLine: p.price,
      cta: copy.cta,
      image: cover,
      hex: ["#0B0A08", "#D9AB5E", "#8C6B4A"],
    },
  };

  const featureGroups = dna ? (Object.entries(dna.features) as [string, string[]][]) : [];

  return (
    <div className="mx-auto max-w-[1280px]">
      {/* ---------- property hero ---------- */}
      <section className="anim-up panel relative mb-7 overflow-hidden">
        <div className="relative aspect-[16/6.4] min-h-[240px]">
          <img src={cover} alt={p.name} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-6 md:p-8">
            <div>
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <Chip tone="gold">{p.propertyType}</Chip>
                {dna ? <StatusPill status="analyzed" /> : <StatusPill status="draft" />}
                <span className="rounded-full bg-ink/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-cream/75 backdrop-blur">
                  {images.length} reference shots
                </span>
              </div>
              <h1 className="font-display text-[32px] font-medium leading-[1.05] md:text-[44px]">{p.name}</h1>
              <div className="mt-2 flex items-center gap-2 text-[13px] text-cream/75">
                <MapPin size={13} /> {p.location}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-cream/60">Starting</div>
              <div className="font-display text-[26px] text-gold">{p.price}</div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 border-t border-line bg-coal/60 px-6 py-4">
          <Link href={`/campaigns/new?property=${p.id}`} prefetch={true} className="btn-gold flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-semibold">
            Create Campaign <ArrowUpRight size={13} />
          </Link>
          <Link href={`/campaigns/new?property=${p.id}&platforms=ig-reel`} prefetch={true} className="btn-ghost flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] text-gold">
            <PlaySquare size={14} /> Generate Reel
          </Link>
          <Link href={`/campaigns/new?property=${p.id}&platforms=ig-post,fb-ad,ig-story`} prefetch={true} className="btn-ghost flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] text-mute">
            <Share2 size={14} /> Generate Social Ads
          </Link>
          <Link href={`/assets?property=${p.id}`} prefetch={true} className="btn-ghost flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] text-mute">
            <FolderOpen size={14} /> View Assets ({assets.length})
          </Link>
          {!dna && <div className="ml-auto"><AnalyzeButton propertyId={p.id} /></div>}
        </div>
      </section>

      {dna ? (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
          {/* ---------- CREATIVE DNA ---------- */}
          <div>
            <div className="anim-up anim-d1 panel mb-6 overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-gold">Project Creative DNA</span>
                <AnalyzeButton propertyId={p.id} label="Re-analyze" />
              </div>
              <div className="grid gap-x-6 gap-y-5 px-5 py-5 sm:grid-cols-2">
                <DnaRow icon={Building2} label="Architecture" value={dna.architecture} />
                <DnaRow icon={Lightbulb} label="Lighting" value={dna.lighting} />
                <DnaRow icon={Users} label="Audience" value={dna.audience} />
                <DnaRow icon={Target} label="Positioning" value={dna.positioning} />
                <div className="sm:col-span-2">
                  <div className="mb-1.5 flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.24em] text-faint">
                    <Palette size={11.5} /> Palette
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {dna.palette.map((name, i) => (
                      <span key={name} className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-[12px] text-cream/85">
                        <span className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ background: dna.paletteHex[i] }} />
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="label mb-1.5">USPs</div>
                  <div className="flex flex-wrap gap-2">
                    {dna.usps.map((u) => (
                      <span key={u} className="rounded-lg border border-gold/30 bg-gold/8 px-3 py-1.5 text-[12px] text-gold">{u}</span>
                    ))}
                  </div>
                </div>
                <DnaRow label="Visual Style" value={dna.visualStyle} />
                <DnaRow label="Brand Tone" value={dna.brandTone} />
              </div>
            </div>

            {/* features grid */}
            <div className="anim-up anim-d2 panel overflow-hidden">
              <div className="border-b border-line px-5 py-4 font-mono text-[10px] uppercase tracking-[0.28em] text-gold">
                Extracted property features
              </div>
              <div className="grid gap-0 sm:grid-cols-2">
                {featureGroups.map(([group, items]) => (
                  <div key={group} className="border-b border-line/60 px-5 py-4 last:border-b-0 sm:border-r sm:even:border-r-0">
                    <div className="mb-2.5 font-mono text-[9.5px] uppercase tracking-[0.24em] text-faint">{group}</div>
                    <ul className="space-y-1.5">
                      {items.map((it) => (
                        <li key={it} className="flex items-center gap-2 text-[12.5px] text-cream/85">
                          <span className="h-1 w-1 rounded-full bg-gold" /> {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ---------- right column ---------- */}
          <div className="min-w-0 space-y-6">
            <div className="anim-up anim-d2">
              <BeforeAfter original={cover} finalAd={<AdCreative asset={heroSample} brand={brand} className="h-full w-full" />} />
            </div>

            <div className="anim-up anim-d3 panel overflow-hidden">
              <div className="flex items-center gap-2 border-b border-line px-5 py-4 font-mono text-[10px] uppercase tracking-[0.28em] text-gold">
                <Clock3 size={13} /> Location advantages
              </div>
              <div className="divide-y divide-line/60">
                {dna.locationAdvantages.map((l) => (
                  <div key={l.label} className="flex items-center justify-between px-5 py-3">
                    <span className="text-[13px] text-cream/85">{l.label}</span>
                    {l.mins !== undefined && <span className="font-mono text-[12px] text-gold">{l.mins} MIN</span>}
                  </div>
                ))}
                {!dna.locationAdvantages.length && (
                  <p className="px-5 py-4 text-[12px] text-faint">No verified travel-time data is available.</p>
                )}
              </div>
            </div>

            {/* shot gallery */}
            <div className="anim-up anim-d4 panel overflow-hidden">
              <div className="border-b border-line px-5 py-4 font-mono text-[10px] uppercase tracking-[0.28em] text-gold">
                Reference library · structure preserved
              </div>
              <div className="grid grid-cols-3 gap-1.5 p-2">
                {images.slice(0, 6).map((im) => (
                  <figure key={im.id} className="group relative overflow-hidden rounded-lg">
                    <img src={im.url} alt={im.label} className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <figcaption className="absolute bottom-1.5 left-1.5 rounded bg-ink/75 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-widest text-cream/85">{im.label}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="panel flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="rounded-2xl bg-panel2 p-4 text-gold hairline"><MapPin size={22} /></div>
          <div className="font-display text-2xl">DNA not extracted yet</div>
          <p className="max-w-md text-[13px] text-mute">Run the vision pass to derive architecture, palette, lighting, USPs and location advantages — every campaign inherits this DNA.</p>
          <AnalyzeButton propertyId={p.id} />
        </div>
      )}

      {/* campaigns */}
      <div className="mt-10">
        <SectionHead kicker="Production" title={`Campaigns for ${p.name}`} />
        {campaigns.length === 0 ? (
          <div className="panel px-6 py-10 text-center text-[13px] text-faint">
            No campaigns yet — create the first one from this property.
          </div>
        ) : (
          <div className="space-y-3">
            {campRows.map((r) => (
              <CampaignRowCard key={r.campaign.id} row={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DnaRow({ icon: Icon, label, value }: { icon?: React.ComponentType<{ size?: number }>; label: string; value: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.24em] text-faint">
        {Icon && <Icon size={11.5} />} {label}
      </div>
      <div className="font-display text-[16.5px] leading-snug text-cream">{value}</div>
    </div>
  );
}
