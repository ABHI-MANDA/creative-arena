import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Clapperboard,
  Dna,
  FileCheck2,
  Gauge,
  Plus,
  TrendingUp,
} from "lucide-react";
import { ensureSeed } from "@/db/seed";
import { dashboardStats, listProperties, listRecentGenerations } from "@/db/queries";
import { CampaignRowCard, PropertyCard } from "@/components/cards";
import { SectionHead, StatCard } from "@/components/ui";
import { AssetVisual } from "@/components/ad-creative";
import { KIND_LABELS } from "@/lib/creative/presets";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const exactTimestamp = (value: Date) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(value);

export default async function OverviewPage() {
  await ensureSeed();
  const [stats, props] = await Promise.all([dashboardStats(), listProperties()]);

  const generations = await listRecentGenerations(500).catch(() => []);
  const recentGens = generations.slice(0, 7);
  const referenceTime = generations[0] ? new Date(generations[0].createdAt).getTime() : 0;
  const spark = Array.from({ length: 8 }, (_, i) => {
    const day = new Date(referenceTime - (7 - i) * 86400000);
    return generations.filter((generation) => new Date(generation.createdAt).toDateString() === day.toDateString()).length;
  });

  const fallbackHeroAsset = {
    id: "hero-fallback",
    campaignId: "fallback",
    propertyId: "fallback",
    kind: "hero",
    platform: "ig-post",
    aspect: "1:1",
    title: "Green Valley Villa",
    score: 98,
    status: "ready",
    approved: true,
    createdAt: new Date(),
    payload: {
      kicker: "Luxury Launch",
      headline: "Green Valley Villa",
      subline: "Private Pool Villa with Ocean Views",
      locationLabel: "Alibaug, MH",
      priceLine: "₹4.25 Cr",
      cta: "Schedule Private Tour",
      image: "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80",
      hex: ["#c99a4e", "#17251b"],
      bullets: ["Private Pool", "Ocean View", "Gated Community"],
    },
  };

  const heroAsset =
    stats.lib.find((l) => l.asset.kind === "hero")?.asset ??
    stats.lib[0]?.asset ??
    fallbackHeroAsset;
  const ready = stats.ready;
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="mx-auto max-w-[1280px]">
      {/* ---------- hero ---------- */}
      <section className="anim-up panel relative mb-8 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_240px_at_20%_-10%,rgba(217,171,94,.14),transparent)]" />
        <div className="relative grid gap-8 p-7 md:grid-cols-[1.5fr_1fr] md:p-10">
          <div>
            <div className="mb-3 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-sage" />
              Property-to-Ad Creative Agent · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <h1 className="font-display max-w-xl text-[34px] font-medium leading-[1.05] md:text-[46px]">
              {greeting}. Property photos in, <span className="gold-text italic">ready-to-post campaigns</span> out.
            </h1>
            <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-mute">
            An AI Creative Production Agent that understands a brand, analyzes references, plans campaigns, selects the appropriate AI models, generates content, evaluates the results, and continuously improves the campaign.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/properties/new" className="btn-gold flex items-center gap-2 rounded-xl px-5 py-3 text-[13.5px] font-semibold">
                <Plus size={15} /> Create New Property
              </Link>
              <Link href="/campaigns/new" className="btn-ghost flex items-center gap-2 rounded-xl px-5 py-3 text-[13.5px] text-gold">
                New Campaign <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-6 border-t border-line pt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              <span className="flex items-center gap-2"><Dna size={13} /> Creative DNA</span>
              <span className="flex items-center gap-2"><FileCheck2 size={13} /> 11-point QC</span>
              <span className="flex items-center gap-2"><Gauge size={13} /> Platform-safe formats</span>
            </div>
          </div>
          {heroAsset && (
            <div className="floaty hidden self-stretch md:flex md:flex-col">
              <div className="mb-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.22em] text-faint">
                <span>Latest hero frame</span>
                <span className="text-gold">QC {heroAsset.score}</span>
              </div>
              <div className="min-h-0 flex-1">
                <AssetVisual asset={heroAsset} brand={stats.brand} className="h-full w-full rounded-xl border border-line shadow-[0_30px_70px_-30px_rgba(0,0,0,.9)]" />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------- stats ---------- */}
      <section className="anim-up anim-d1 mb-8 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard icon={Clapperboard} label="Active Campaigns" value={String(stats.camps.filter((c) => c.campaign.status !== "archived").length)} sub={`${stats.camps.filter((c) => c.campaign.status === "draft").length} in draft`} spark={spark} accent />
        <StatCard icon={Building2} label="Assets Generated" value={String(stats.lib.length)} sub={`${new Set(stats.lib.map((l) => l.asset.platform)).size} platforms`} spark={spark} />
        <StatCard icon={Gauge} label="Avg QC Score" value={stats.avg ? `${stats.avg}` : "—"} sub="11-point brand check" />
        <StatCard icon={BadgeCheck} label="Approved / Ready" value={`${stats.approved} / ${ready}`} sub="Publishable now" />
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.6fr_1fr]">
        {/* ---------- left ---------- */}
        <div className="min-w-0">
          <div className="anim-up anim-d2">
            <SectionHead
              kicker="Portfolio"
              title="Recent Projects"
              action={
                <Link href="/properties" className="btn-ghost rounded-lg px-3.5 py-2 text-[12px] text-mute">
                  All properties
                </Link>
              }
            />
            <div className="grid gap-4.5 sm:grid-cols-2">
              {props.slice(0, 4).map((c) => (
                <PropertyCard key={c.property.id} card={c} />
              ))}
            </div>
          </div>

          <div className="anim-up anim-d3 mt-9">
            <SectionHead
              kicker="Production"
              title="Campaigns"
              action={
                <Link href="/campaigns" className="btn-ghost rounded-lg px-3.5 py-2 text-[12px] text-mute">
                  All campaigns
                </Link>
              }
            />
            <div className="space-y-3">
              {stats.camps.slice(0, 4).map((c) => (
                <CampaignRowCard key={c.campaign.id} row={c} />
              ))}
            </div>
          </div>
        </div>

        {/* ---------- right rail ---------- */}
        <div className="min-w-0 space-y-4">
          <div className="anim-up anim-d2 panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.26em] text-mute">
                <Activity size={12.5} className="text-gold" /> Creative activity
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-faint">live</span>
            </div>
            <div className="divide-y divide-line/60">
              {recentGens.map((g) => (
                <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${g.status === "success" ? "bg-sage" : "bg-rust"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] capitalize text-cream/85">{g.kind} — {g.model}</div>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[9px] text-faint">{timeAgo(g.createdAt)}</span>
                    <time dateTime={new Date(g.createdAt).toISOString()} className="block whitespace-nowrap font-mono text-[9px] text-mute" title={exactTimestamp(new Date(g.createdAt))}>
                      {exactTimestamp(new Date(g.createdAt))}
                    </time>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="anim-up anim-d3 panel p-5">
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.26em] text-mute">
              <TrendingUp size={12.5} className="text-gold" /> Ad system output
            </div>
            <div className="space-y-3">
              {stats.byKind.sort((a, b) => b[1] - a[1]).slice(0, 6).map(([kind, n]) => {
                const max = Math.max(...stats.byKind.map(([, v]) => v), 1);
                return (
                  <div key={kind}>
                    <div className="mb-1 flex justify-between text-[11.5px]">
                      <span className="text-cream/80">{KIND_LABELS[kind] ?? kind}</span>
                      <span className="font-mono text-mute">{n}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-panel2">
                      <div className="h-full rounded-full bg-gradient-to-r from-golddeep to-gold" style={{ width: `${(n / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
              {stats.byKind.length === 0 && <p className="text-[12px] text-faint">Generate a campaign to see output.</p>}
            </div>
          </div>

          <div className="anim-up anim-d4 panel p-5">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.26em] text-mute">Brand</div>
            <div className="flex items-center gap-3">
              <Image src="/images/brand-logo.png" alt="M & A" width={40} height={40} className="h-10 w-10 object-contain" />
              <div>
                <div className="text-[14px] font-medium">{stats.brand.name}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-faint">{stats.brand.tones.join(" · ")}</div>
              </div>
            </div>
            <Link href="/brand" className="btn-ghost mt-4 flex items-center justify-center rounded-lg px-3 py-2 text-[12px] text-mute">
              Open Brand Kit
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
