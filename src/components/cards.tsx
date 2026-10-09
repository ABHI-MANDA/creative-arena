import Link from "next/link";
import { ArrowRight, Building2, Clapperboard, FolderOpen, MapPin, PlaySquare, Share2 } from "lucide-react";
import type { CampaignRow, PropertyCard as PropertyCardT } from "@/db/queries";
import { platformById } from "@/lib/creative/presets";
import { Chip, DynIcon, ScoreRing, StatusPill } from "./ui";
import { LiveTimeAgo } from "./live-time";

export function PropertyCard({ card }: { card: PropertyCardT }) {
  const { property: p, images, dna, campaignCount, assetCount } = card;
  const cover = images.find((i) => i.label === "Exterior")?.url ?? images[0]?.url;
  return (
    <div className="panel panel-hover group overflow-hidden">
      <Link href={`/properties/${p.id}`} prefetch={true} className="relative block aspect-[16/8.6] overflow-hidden">
        {cover && (
          <img
            src={cover}
            alt={p.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.045]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/15 to-transparent" />
        <div className="absolute left-4 top-4 flex gap-2">
          <span className="rounded-full bg-ink/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-gold backdrop-blur">
            {p.propertyType}
          </span>
          {dna && <StatusPill status="analyzed" />}
        </div>
        <div className="absolute inset-x-4 bottom-3.5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-[21px] font-medium leading-tight">{p.name}</h3>
              <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-cream/70">
                <MapPin size={11.5} /> {p.location}
              </div>
            </div>
            <div className="text-right font-mono text-[13px] text-gold">{p.price}</div>
          </div>
        </div>
      </Link>
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-[11px] text-faint">
        <span className="flex items-center gap-1.5">
          <Clapperboard size={12} /> {campaignCount} campaigns
        </span>
        <span className="flex items-center gap-1.5">
          <FolderOpen size={12} /> {assetCount} assets
        </span>
        <span className="font-mono">{images.length} shots</span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        <Link href={`/campaigns/new?property=${p.id}`} prefetch={true} className="btn-gold flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11.5px] font-semibold">
          Create Campaign <ArrowRight size={12} />
        </Link>
        <Link href={`/campaigns/new?property=${p.id}&platforms=9:16`} prefetch={true} className="btn-ghost flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11.5px] text-gold">
          <PlaySquare size={12.5} /> Generate 9:16 Ad
        </Link>
        <Link href={`/campaigns/new?property=${p.id}&platforms=9:16,1:1,4:5,16:9`} prefetch={true} className="btn-ghost col-span-2 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11.5px] text-mute">
          <Share2 size={12.5} /> Generate Ads · 9:16 + 1:1 + 4:5 + 16:9
        </Link>
      </div>
    </div>
  );
}

export function CampaignRowCard({ row }: { row: CampaignRow }) {
  const { campaign: c, propertyName, propertyLocation, cover, assetCount, avgScore, approvedCount } = row;
  return (
    <Link
      href={`/campaigns/${c.id}`}
      prefetch={true}
      className="panel panel-hover group flex items-center gap-4 px-4 py-3.5"
    >
      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg hairline">
        {cover ? (
          <img src={cover} alt={c.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-panel2 text-faint">
            <Building2 size={16} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium">{c.name}</span>
          <StatusPill status={c.status} />
        </div>
        <div className="mt-0.5 truncate text-[12px] text-faint">
          {propertyName} {propertyLocation && `· ${propertyLocation}`} · updated <LiveTimeAgo date={c.createdAt} />
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Chip tone="gold">{c.presetLabel}</Chip>
          <span className="flex items-center gap-1.5 text-faint">
            {(c.platforms ?? []).slice(0, 5).map((pl) => (
              <span key={pl} className="font-mono text-[9.5px] font-bold text-gold/80">
                {platformById(pl).aspect}
              </span>
            ))}
          </span>
        </div>
      </div>
      <div className="hidden items-center gap-5 sm:flex">
        <div className="text-right">
          <div className="font-mono text-[15px]">{assetCount}</div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-faint">assets</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[15px]">{approvedCount}</div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-faint">approved</div>
        </div>
        {avgScore > 0 && <ScoreRing score={avgScore} size={42} />}
      </div>
    </Link>
  );
}
