"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BadgeCheck, Edit3, FolderOpen } from "lucide-react";
import type { AssetPayload } from "@/lib/creative/engine";
import { KIND_LABELS, platformById, type BrandSettings } from "@/lib/creative/presets";
import { cx } from "@/lib/utils";
import { LiveTimeAgo } from "@/components/live-time";
import { AssetVisual } from "@/components/ad-creative";
import { CreativeEditorModal } from "@/components/editor/CreativeEditorModal";
import { DynIcon, EmptyState, SectionHead } from "@/components/ui";

type Item = {
  id: string;
  kind: string;
  platform: string;
  aspect: string;
  title: string;
  payload: AssetPayload;
  score: number;
  status: string;
  approved: boolean;
  createdAt: string;
  campaignId: string;
  campaignName: string;
  propertyId: string;
  propertyName: string;
  preset: string;
};

export function AssetLibrary({
  items,
  brand,
  initialProperty,
}: {
  items: Item[];
  brand: BrandSettings;
  initialProperty: string;
}) {
  const router = useRouter();
  const [platform, setPlatform] = useState("all");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const platforms = useMemo(() => ["all", ...new Set(items.filter((i) => !initialProperty || i.propertyId === initialProperty).map((i) => i.platform))], [items, initialProperty]);
  const kinds = useMemo(() => ["all", ...new Set(items.map((i) => i.kind))], [items]);

  const scoped = initialProperty ? items.filter((i) => i.propertyId === initialProperty) : items;

  const filtered = scoped.filter(
    (i) =>
      (platform === "all" || i.platform === platform) &&
      (kind === "all" || i.kind === kind) &&
      (status === "all" || (status === "approved" ? i.approved : i.status === status))
  );

  const Select = ({ value, set, opts, fmt }: { value: string; set: (v: string) => void; opts: string[]; fmt: (v: string) => string }) => (
    <div className="flex flex-wrap items-center gap-1.5">
      {opts.map((o) => (
        <button
          key={o}
          onClick={() => set(o)}
          className={cx(
            "rounded-full border px-3 py-1.5 text-[11px] transition-all",
            value === o ? "border-gold/60 bg-gold/10 text-gold" : "border-line text-faint hover:text-mute"
          )}
        >
          {fmt(o)}
        </button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1280px]">
      {editingItem && (
        <CreativeEditorModal
          asset={editingItem}
          brand={brand}
          onClose={() => setEditingItem(null)}
          onSaveSuccess={() => {
            setEditingItem(null);
            router.refresh();
          }}
        />
      )}
      <SectionHead
        kicker="Library"
        title={`Generated Ads · ${scoped.length}`}
        action={
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
            {filtered.length} shown
          </span>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Nothing generated yet"
          sub="Assets from every campaign land here — filterable by platform, format and QC status."
          action={<Link href="/campaigns/new" className="btn-gold rounded-xl px-5 py-2.5 text-[13px] font-semibold">Generate a campaign</Link>}
        />
      ) : (
        <>
          <div className="anim-up mb-6 space-y-3 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="w-16 font-mono text-[9.5px] uppercase tracking-[0.2em] text-faint">Platform</span>
              <Select value={platform} set={setPlatform} opts={platforms} fmt={(v) => (v === "all" ? "All" : platformById(v).short)} />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-16 font-mono text-[9.5px] uppercase tracking-[0.2em] text-faint">Format</span>
              <Select value={kind} set={setKind} opts={kinds} fmt={(v) => (v === "all" ? "All" : KIND_LABELS[v] ?? v)} />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-16 font-mono text-[9.5px] uppercase tracking-[0.2em] text-faint">Status</span>
              <Select value={status} set={setStatus} opts={["all", "ready", "review", "improving", "approved"]} fmt={(v) => (v === "all" ? "All" : v === "ready" ? "Ready" : v === "review" ? "Review" : v === "improving" ? "Improving" : "Approved")} />
            </div>
          </div>

          {initialProperty && scoped[0] && (
            <div className="mb-5 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
              Filtered: {scoped[0].propertyName}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((i, idx) => (
              <div key={i.id} className="anim-up panel panel-hover overflow-hidden rounded-2xl border border-line bg-coal" style={{ animationDelay: `${Math.min(idx, 10) * 40}ms` }}>
                {/* TOP TOOLBAR HEADER */}
                <div className="border-b border-line bg-panel/90 px-3.5 py-3 backdrop-blur space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-widest text-faint">
                      <span className={i.platform === "multi" ? "text-gold" : "text-mute"}>
                        <DynIcon name={i.platform === "multi" ? "Sparkles" : platformById(i.platform).icon} size={11.5} />
                      </span>
                      {KIND_LABELS[i.kind] ?? i.kind} · {i.aspect}
                    </span>
                    <span className={cx(
                      "flex items-center gap-1 font-mono text-[10px]",
                      i.approved ? "text-sage" : i.score >= brand.thresholds.ready ? "text-sage" : i.score >= brand.thresholds.review ? "text-warn" : "text-rust"
                    )}>
                      {i.approved && <BadgeCheck size={11} />} QC {i.score}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-line/60 pt-2">
                    <button
                      onClick={() => setEditingItem(i)}
                      className="flex items-center gap-1.5 rounded-lg border border-gold/50 bg-gold/15 px-2.5 py-1 text-[11px] font-semibold text-gold transition-all hover:bg-gold/25"
                    >
                      <Edit3 size={12} /> Edit Creative
                    </button>
                    {i.payload.editingStatus === "edited" && (
                      <span className="rounded-full bg-sage/15 px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-wider text-sage font-medium">Edited</span>
                    )}
                  </div>
                </div>

                <AssetVisual asset={i} brand={brand} />

                <div className="px-3.5 py-2.5 border-t border-line/60">
                  <Link href={`/campaigns/${i.campaignId}`} className="group/link flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[11.5px] font-medium text-cream/85">{i.campaignName}</div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-faint">
                        {i.propertyName} · <LiveTimeAgo date={i.createdAt} />
                      </div>
                    </div>
                    <ArrowUpRight size={13} className="shrink-0 text-faint transition-colors group-hover/link:text-gold" />
                  </Link>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full panel px-6 py-12 text-center text-[13px] text-faint">
                No assets match these filters.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
