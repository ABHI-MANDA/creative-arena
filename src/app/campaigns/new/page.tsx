"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Loader2, Music2, Palette, Sparkles, Wand2 } from "lucide-react";
import { DEFAULT_BRAND, platformById, PLATFORMS, PRESETS, type BrandSettings } from "@/lib/creative/presets";
import type { AdTextSection, ApprovedAdContent, AssetPayload, Direction } from "@/lib/creative/engine";
import { AssetVisual } from "@/components/ad-creative";
import { DynIcon } from "@/components/ui";
import { aspectCss, cx, ratioOf } from "@/lib/utils";
import type { OpenRouterModel } from "@/lib/creative/models";

type PropertyLite = {
  id: string;
  name: string;
  location: string;
  propertyType: string;
  price: string;
  cover: string | null;
  analyzed: boolean;
};

const FONT_SIZE_CONTROLS: { key: AdTextSection; label: string }[] = [
  { key: "developer", label: "Company / brand" },
  { key: "headline", label: "Project headline" },
  { key: "tagline", label: "Tagline" },
  { key: "bhk", label: "Configuration" },
  { key: "location", label: "Location" },
  { key: "amenities", label: "Amenities" },
  { key: "price", label: "Price block" },
  { key: "cta", label: "CTA ribbon" },
];

function CampaignWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const [properties, setProperties] = useState<PropertyLite[]>([]);
  const [propertyId, setPropertyId] = useState(params.get("property") ?? "");
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [propertiesError, setPropertiesError] = useState("");
  const [brand, setBrand] = useState<BrandSettings>(DEFAULT_BRAND);
  const [propertyLoadAttempt, setPropertyLoadAttempt] = useState(0);
  const [preset, setPreset] = useState("luxury-property");
  const [platforms, setPlatforms] = useState<string[]>(
    params.get("platforms")?.split(",").filter(Boolean) ?? ["9:16", "1:1", "4:5", "16:9"]
  );
  const [previewAspect, setPreviewAspect] = useState(
    params.get("platforms")?.split(",").filter(Boolean)[0] ?? "4:5"
  );
  const [stage, setStage] = useState<"brief" | "directions" | "review">("brief");
  const [directions, setDirections] = useState<Direction[]>([]);
  const [contentDraft, setContentDraft] = useState<ApprovedAdContent | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [modelSelection, setModelSelection] = useState("auto");
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [modelMessage, setModelMessage] = useState("Loading free models…");
  const [selectedDir, setSelectedDir] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/properties")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load properties.");
        return response.json() as Promise<PropertyLite[] | { items: PropertyLite[] }>;
      })
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items;
        if (!Array.isArray(items) || items.some((item) => !item.id || !item.name)) {
          throw new Error("The property list returned an invalid response.");
        }
        if (!active) return;
        setProperties(items);
        setPropertyId((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? "");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setPropertiesError(cause instanceof Error ? cause.message : "Could not load properties.");
      })
      .finally(() => {
        if (active) setPropertiesLoading(false);
      });
    return () => { active = false; };
  }, [propertyLoadAttempt]);

  useEffect(() => {
    let active = true;
    fetch("/api/brand")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load brand settings.");
        return response.json() as Promise<BrandSettings>;
      })
      .then((settings) => {
        if (active && settings?.name) setBrand(settings);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load brand settings.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    fetch("/api/models")
      .then(async (response) => {
        const data = await response.json() as { models?: OpenRouterModel[]; error?: string };
        setModels(data.models ?? []);
        setModelMessage(data.error ?? (data.models?.length ? `${data.models.length} free models available` : "No free model catalog is available; automatic mode uses the local engine."));
      })
      .catch(() => setModelMessage("Could not load model catalog; automatic mode will use the local engine."));
  }, []);

  const chosenPreset = PRESETS.find((p) => p.id === preset)!;
  const valid = useMemo(() => properties.some((property) => property.id === propertyId) && platforms.length > 0, [properties, propertyId, platforms]);

  const togglePlatform = (id: string) =>
    setPlatforms((cur) => (cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id]));

  const retryProperties = () => {
    setPropertiesLoading(true);
    setPropertiesError("");
    setPropertyLoadAttempt((attempt) => attempt + 1);
  };

  const previewPlatform = platforms.includes(previewAspect) ? previewAspect : platforms[0] ?? "4:5";
  const previewSpec = platformById(previewPlatform);
  const selectedProperty = properties.find((property) => property.id === propertyId);
  const previewPayload: AssetPayload | null = contentDraft ? {
    kicker: contentDraft.developer,
    headline: contentDraft.project,
    fine: contentDraft.tagline,
    subline: [contentDraft.bhk, contentDraft.locationTag].filter(Boolean).join(" · "),
    locationLabel: contentDraft.locationTag,
    bullets: contentDraft.amenitiesLine.split(/\s*\|\s*/).map((item) => item.trim()).filter(Boolean),
    priceLine: contentDraft.price,
    cta: contentDraft.cta,
    imagePrompt: contentDraft.imagePrompt,
    image: selectedProperty?.cover ?? "/images/props/villa-hero.jpg",
    hex: directions[selectedDir]?.hex,
    layout: contentDraft.layout === "poster" ? "overlay" : contentDraft.layout === "split" ? "wide" : undefined,
    designStyle: contentDraft.designStyle ?? "editorial",
    fontSizes: contentDraft.fontSizes,
  } : null;
  const previewAsset = previewPayload ? {
    kind: "hero",
    platform: previewPlatform,
    aspect: previewSpec.aspect,
    title: contentDraft?.project || selectedProperty?.name || "Ad preview",
    payload: previewPayload,
  } : null;

  const getDirections = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, presetId: preset, platforms, model: modelSelection }),
      });
      const data = (await res.json()) as { id?: string; directions?: Direction[]; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? "Failed to plan campaign");
      setCampaignId(data.id);
      setDirections(data.directions ?? []);
      setSelectedDir(0);
      setStage("directions");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const prepareReview = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/prepare-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directionId: directions[selectedDir]?.id, model: modelSelection }),
      });
      const data = (await res.json()) as { ok?: boolean; content?: ApprovedAdContent; error?: string };
      if (!res.ok || !data.content) throw new Error(data.error ?? "Failed to prepare ad content for review");
      setContentDraft(data.content);
      setStage("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to prepare ad content");
    } finally {
      setBusy(false);
    }
  };

  const generateWithApproval = async () => {
    if (!contentDraft) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directionId: directions[selectedDir]?.id,
          model: modelSelection,
          approvedContent: contentDraft,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Generation failed");
      router.push(`/campaigns/${campaignId}?fresh=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1180px]">
      <Link href="/campaigns" className="mb-5 inline-flex items-center gap-2 text-[12.5px] text-faint transition-colors hover:text-gold">
        <ArrowLeft size={14} /> Campaigns
      </Link>

      {stage === "brief" && (
        <div className="anim-up panel overflow-hidden">
          <div className="border-b border-line px-7 py-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">Create Property Campaign</div>
            <h1 className="font-display mt-2 text-[30px] font-medium leading-tight">
              A brief. A direction. <span className="gold-text italic">A full ad system.</span>
            </h1>
          </div>

          <div className="px-7 py-6">
            {/* property */}
            <div className="label mb-3">1 · Property</div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {properties.map((p) => (
                <button key={p.id} onClick={() => setPropertyId(p.id)} className={cx("sel-card flex items-center gap-3 rounded-xl p-3 text-left", propertyId === p.id && "sel-on")}>
                  <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg hairline">
                    {p.cover && <img src={p.cover} alt={p.name} className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium">{p.name}</div>
                    <div className="truncate text-[11.5px] text-faint">{p.location} · {p.propertyType}</div>
                    <div className="mt-1 font-mono text-[10px] text-gold">{p.price}</div>
                  </div>
                  {propertyId === p.id && (
                    <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold text-[#171208]">
                      <Check size={11} strokeWidth={3} />
                    </span>
                  )}
                </button>
              ))}
              {properties.length === 0 && propertiesLoading && (
                <div className="col-span-2 rounded-xl border border-dashed border-line p-6 text-center text-[12.5px] text-faint">
                  Loading existing properties…
                </div>
              )}
              {properties.length === 0 && !propertiesLoading && propertiesError && (
                <div className="col-span-2 rounded-xl border border-dashed border-line p-6 text-center text-[12.5px] text-faint">
                  <p>{propertiesError}</p>
                  <button onClick={retryProperties} className="mt-2 text-gold underline">Retry</button>
                </div>
              )}
              {properties.length === 0 && !propertiesLoading && !propertiesError && (
                <div className="col-span-2 rounded-xl border border-dashed border-line p-6 text-center text-[12.5px] text-faint">
                  No properties found. <Link className="text-gold underline" href="/properties/new">Create your first property</Link>.
                </div>
              )}
            </div>

            {/* preset */}
            <div className="label mb-3 mt-8">2 · Campaign preset</div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              {PRESETS.map((p) => (
                <button key={p.id} onClick={() => { setPreset(p.id); setPlatforms((cur) => cur.length ? cur : p.defaultPlatforms); }} className={cx("sel-card rounded-xl p-3.5 text-left", preset === p.id && "sel-on")}>
                  <DynIcon name={p.icon} size={17} className={preset === p.id ? "text-gold" : "text-mute"} />
                  <div className="mt-2.5 text-[12.5px] font-medium leading-tight">{p.label}</div>
                  <div className="mt-1 text-[10.5px] leading-snug text-faint">{p.desc}</div>
                </button>
              ))}
            </div>

            {/* aspect ratios */}
            <div className="label mb-3 mt-8">3 · Aspect Ratios</div>
            <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
              {PLATFORMS.map((pl) => {
                const on = platforms.includes(pl.id);
                const r = ratioOf(pl.aspect);
                return (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => togglePlatform(pl.id)}
                    className={cx("sel-card flex flex-col items-center justify-center gap-2.5 rounded-xl p-3 text-center transition-all", on && "sel-on")}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-panel2">
                      <div
                        className={cx("rounded-[2px] border transition-colors", on ? "border-gold bg-gold/30" : "border-mute bg-mute/20")}
                        style={{
                          aspectRatio: aspectCss(pl.aspect),
                          maxHeight: 34,
                          maxWidth: 34,
                          height: r <= 1 ? 32 : Math.round(32 / r),
                          width: r >= 1 ? 32 : Math.round(32 * r),
                        }}
                      />
                    </div>
                    <div className="font-mono text-[13.5px] font-bold text-cream">{pl.aspect}</div>
                    <span className={cx("flex h-4 w-4 shrink-0 items-center justify-center rounded border", on ? "border-gold bg-gold text-[#171208]" : "border-line")}>
                      {on && <Check size={9} strokeWidth={4} />}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* generation model */}
            <div className="mt-8 max-w-xl">
              <label htmlFor="creative-model" className="label mb-2 block">4 · Generation model</label>
              <select id="creative-model" value={modelSelection} onChange={(event) => setModelSelection(event.target.value)} className="input w-full">
                <option value="auto">Automatic · Agnes 3.0 Flash (Recommended)</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>{model.name} · {model.contextLength.toLocaleString()} context</option>
                ))}
              </select>
              <p className="mt-1.5 text-[10.5px] text-faint">{modelMessage}. Chosen model and fallback are logged with generation activity.</p>
            </div>

            {error && <p className="mt-4 text-[12.5px] text-rust">{error}</p>}
            <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                {chosenPreset.objective} · {platforms.length} aspect ratio{platforms.length === 1 ? "" : "s"}
              </span>
              <button onClick={getDirections} disabled={!valid || busy} className="btn-gold flex items-center gap-2 rounded-xl px-6 py-3 text-[13.5px] font-semibold disabled:opacity-40">
                {busy ? <Loader2 size={15} className="spin-slow" /> : <Sparkles size={15} />}
                Propose Creative Directions
              </button>
            </div>
          </div>
        </div>
      )}
      {stage === "directions" && (
        <div className="anim-up">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">Step 2 · Creative Directions</div>
              <h1 className="font-display mt-2 text-[30px] font-medium leading-tight">Three ways to tell the story.</h1>
              <p className="mt-1.5 text-[13px] text-mute">Pick one — M &amp; A generates the complete campaign in that voice.</p>
            </div>
            <button onClick={() => setStage("brief")} className="btn-ghost rounded-xl px-4 py-2.5 text-[12px] text-mute">
              <ArrowLeft size={13} className="mr-1.5 inline" /> Edit brief
            </button>
          </div>

          <div className="grid gap-4.5 lg:grid-cols-3">
            {directions.map((d, i) => (
              <button
                key={d.id}
                onClick={() => setSelectedDir(i)}
                className={cx("sel-card group relative overflow-hidden rounded-2xl p-0 text-left", selectedDir === i && "sel-on")}
              >
                <div className="h-36 w-full" style={{ background: `linear-gradient(135deg, ${d.hex[0]}, ${d.hex[2]} 130%)` }}>
                  <div className="flex h-full flex-col justify-between p-4" style={{ background: `radial-gradient(300px 140px at 80% 0%, ${d.hex[1]}33, transparent)` }}>
                    <span className="w-fit rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.24em]" style={{ background: `${d.hex[0]}cc`, color: d.hex[1] }}>
                      Concept {String.fromCharCode(65 + i)}
                    </span>
                    <div className="font-display text-[24px] font-medium leading-tight" style={{ color: "#f4eee1" }}>
                      {d.name}
                    </div>
                  </div>
                </div>
                <div className="p-4.5 p-5">
                  <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.24em]" style={{ color: d.hex[1] }}>{d.tagline}</div>
                  <p className="text-[12px] leading-relaxed text-mute">{d.description}</p>
                  <div className="mt-3.5 space-y-1.5">
                    {d.approach.slice(0, 3).map((a) => (
                      <div key={a} className="flex items-center gap-2 text-[11.5px] text-cream/75">
                        <span className="h-1 w-1 rounded-full" style={{ background: d.hex[1] }} /> {a}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5">
                    <span className="flex gap-1.5">
                      {d.hex.map((hexc) => (
                        <span key={hexc} className="h-4 w-4 rounded-full border border-white/15" style={{ background: hexc }} />
                      ))}
                    </span>
                    {selectedDir === i ? (
                      <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-gold text-[#171208]"><Check size={12} strokeWidth={3.5} /></span>
                    ) : (
                      <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full border border-line" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="anim-up anim-d2 mt-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              <span className="flex items-center gap-1.5"><Music2 size={12} /> {directions[selectedDir]?.music}</span>
              <span className="flex items-center gap-1.5"><Palette size={12} /> {directions[selectedDir]?.grade}</span>
            </div>
            {error && <p className="text-[12.5px] text-rust">{error}</p>}
            <button onClick={prepareReview} disabled={busy} className="btn-gold flex items-center gap-2 rounded-xl px-7 py-3.5 text-[14px] font-semibold disabled:opacity-50">
              {busy ? <Loader2 size={15} className="spin-slow" /> : <Sparkles size={15} />}
              Review &amp; Approve Content <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {stage === "review" && contentDraft && (
        <div className="anim-up">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
                <span>Step 3 · Content Review &amp; Approval</span>
                <span className="rounded-full bg-gold/15 px-2 py-0.5 text-gold border border-gold/30">
                Ready to customize
                </span>
              </div>
              <h1 className="font-display mt-2 text-[30px] font-medium leading-tight">
                Review &amp; correct contents before final output.
              </h1>
              <p className="mt-1.5 text-[13px] text-mute">
                AI has drafted the ad. Leave any optional detail blank, edit the copy, or customize the preview before generating.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStage("directions")}
                className="btn-ghost rounded-xl px-4 py-2.5 text-[12px] text-mute"
              >
                <ArrowLeft size={13} className="mr-1.5 inline" /> Back to directions
              </button>
              <button
                onClick={prepareReview}
                disabled={busy}
                className="btn-ghost rounded-xl px-4 py-2.5 text-[12px] text-cream/90 border border-line hover:border-gold/50"
              >
                {busy ? <Loader2 size={13} className="spin-slow mr-1.5 inline" /> : <Sparkles size={13} className="mr-1.5 inline text-gold" />}
                Re-draft with AI
              </button>
            </div>
          </div>

          <div className="grid gap-7 lg:grid-cols-12 items-start">
            {/* Left Column: Editable Fields */}
            <div className="lg:col-span-7 space-y-4">
              <div className="panel p-5.5 space-y-4 border border-line/80">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-gold font-semibold flex items-center justify-between">
                  <span>Ad Poster Typography &amp; Copy</span>
                  <span className="text-faint text-[9.5px]">Editable Contents</span>
                </div>

                {/* Developer & Project */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label mb-1.5 text-[11px]">Company / Brand</label>
                    <input
                      type="text"
                      className="input w-full font-sans text-[13px]"
                      value={contentDraft.developer}
                      maxLength={64}
                      onChange={(e) => setContentDraft({ ...contentDraft, developer: e.target.value })}
                      placeholder="Enter your company name"
                      aria-label="Company or brand name"
                    />
                  </div>
                  <div>
                    <label className="label mb-1.5 text-[11px]">Project Name / Headline</label>
                    <input
                      type="text"
                      className="input w-full font-sans text-[13px] font-semibold"
                      value={contentDraft.project}
                      maxLength={80}
                      onChange={(e) => setContentDraft({ ...contentDraft, project: e.target.value })}
                      placeholder="Enter the exact project name"
                      aria-label="Project name"
                    />
                  </div>
                </div>

                {/* Tagline */}
                <div>
                  <label className="label mb-1.5 text-[11px]">Tagline / Hook</label>
                  <input
                    type="text"
                    className="input w-full font-sans text-[13px]"
                    value={contentDraft.tagline}
                    maxLength={100}
                    onChange={(e) => setContentDraft({ ...contentDraft, tagline: e.target.value })}
                    placeholder="Add a campaign-specific tagline"
                  />
                </div>

                {/* BHK & Location */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label mb-1.5 text-[11px]">Configuration (BHK Highlight)</label>
                    <input
                      type="text"
                      className="input w-full font-sans text-[13px] font-bold text-gold"
                      value={contentDraft.bhk}
                      maxLength={40}
                      onChange={(e) => setContentDraft({ ...contentDraft, bhk: e.target.value })}
                      placeholder="Only enter a verified configuration"
                    />
                  </div>
                  <div>
                    <label className="label mb-1.5 text-[11px]">Typology &amp; Location</label>
                    <input
                      type="text"
                      className="input w-full font-sans text-[13px]"
                      value={contentDraft.locationTag}
                      maxLength={100}
                      onChange={(e) => setContentDraft({ ...contentDraft, locationTag: e.target.value })}
                      placeholder="Property type and location"
                    />
                  </div>
                </div>

                {/* Key Amenities Line */}
                <div>
                  <label className="label mb-1.5 text-[11px]">Key Amenities Line (pipe-separated)</label>
                  <input
                    type="text"
                    className="input w-full font-sans text-[13px]"
                    value={contentDraft.amenitiesLine}
                    maxLength={140}
                    onChange={(e) => setContentDraft({ ...contentDraft, amenitiesLine: e.target.value })}
                    placeholder="Only include verified property features"
                  />
                </div>

                {/* Starting Price & CTA */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label mb-1.5 text-[11px]">Starting Price Block</label>
                    <input
                      type="text"
                      className="input w-full font-sans text-[13px] font-bold text-cream"
                      value={contentDraft.price}
                      maxLength={48}
                      onChange={(e) => setContentDraft({ ...contentDraft, price: e.target.value })}
                      placeholder="Enter verified price if available"
                    />
                  </div>
                  <div>
                    <label className="label mb-1.5 text-[11px]">White CTA Ribbon Text</label>
                    <input
                      type="text"
                      className="input w-full font-sans text-[13px] font-semibold text-gold"
                      value={contentDraft.cta}
                      maxLength={40}
                      onChange={(e) => setContentDraft({ ...contentDraft, cta: e.target.value })}
                      placeholder="Add a campaign-specific call to action"
                      aria-label="White CTA ribbon text"
                    />
                  </div>
                </div>
              </div>

              {/* AI Image Generation Prompt */}
              <div className="panel p-5.5 space-y-2.5 border border-line/80">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-gold font-semibold flex items-center justify-between">
                  <span>AI Image Visual Prompt (Agnes AI / FLUX)</span>
                  <span className="text-faint text-[9.5px]">Photographic Brief</span>
                </div>
                <p className="text-[11.5px] text-faint">
                  Edit the visual direction. The image prompt is adapted to your company, campaign preset, verified property details, and each selected aspect ratio. Text and the white CTA ribbon are added separately.
                </p>
                <textarea
                  rows={5}
                  className="input w-full font-mono text-[12px] leading-relaxed resize-y"
                  value={contentDraft.imagePrompt}
                  onChange={(e) => setContentDraft({ ...contentDraft, imagePrompt: e.target.value })}
                  placeholder="Describe the property-focused visual direction. Avoid adding unverified features."
                  aria-label="AI image visual direction"
                />
              </div>

              {/* Approval Button Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <p className="text-[12px] text-mute flex items-center gap-1.5">
                  <Check size={14} className="text-gold" /> Ready to generate final output across {platforms.length} aspect ratios.
                </p>
                {error && <p className="text-[12.5px] text-rust">{error}</p>}
                <button
                  onClick={generateWithApproval}
                  disabled={busy}
                  className="btn-gold flex items-center gap-2 rounded-xl px-8 py-3.5 text-[14px] font-semibold shadow-lg shadow-gold/10 disabled:opacity-50"
                >
                  {busy ? <Loader2 size={16} className="spin-slow" /> : <Sparkles size={16} />}
                  Approve &amp; Generate Final Output <ArrowRight size={14} />
                </button>
              </div>
            </div>

            {/* Right Column: Live, editable creative preview */}
            <div className="lg:col-span-5 sticky top-6">
              <div className="panel p-4.5 border border-gold/30 bg-coal/90 space-y-3">
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-faint border-b border-line pb-2.5">
                  <span className="text-gold font-medium">Live Ad Preview</span>
                  <div className="flex items-center gap-2">
                    <span>Preview</span>
                    <select
                      aria-label="Preview aspect ratio"
                      value={previewPlatform}
                      onChange={(event) => setPreviewAspect(event.target.value)}
                      className="input max-w-[100px] py-1 text-[10px]"
                    >
                      {platforms.map((platform) => (
                        <option key={platform} value={platform}>{platformById(platform).aspect}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="label mb-1.5 block text-[10px]">Layout</span>
                    <select
                      value={contentDraft.layout ?? "automatic"}
                      onChange={(event) => setContentDraft({ ...contentDraft, layout: event.target.value as ApprovedAdContent["layout"] })}
                      className="input w-full text-[11px]"
                      aria-label="Preview layout"
                    >
                      <option value="automatic">Automatic for aspect ratio</option>
                      <option value="poster">Poster</option>
                      <option value="split">Split layout</option>
                    </select>
                  </label>
                  <label className="min-w-0 flex-1">
                    <span className="label mb-1.5 block text-[10px]">Design style</span>
                    <select
                      value={contentDraft.designStyle ?? "editorial"}
                      onChange={(event) => setContentDraft({ ...contentDraft, designStyle: event.target.value as ApprovedAdContent["designStyle"] })}
                      className="input w-full text-[11px]"
                      aria-label="Preview design style"
                    >
                      <option value="editorial">Editorial</option>
                      <option value="minimal">Minimal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </label>
                </div>

                <details className="rounded-lg border border-line/80 bg-ink/40 px-3 py-2">
                  <summary className="cursor-pointer select-none text-[11px] font-medium text-cream/90">
                    Customize font size by section
                    <span className="ml-2 font-mono text-[9px] text-faint">75%–140% · optional</span>
                  </summary>
                  <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2">
                    {FONT_SIZE_CONTROLS.map(({ key, label }) => {
                      const value = contentDraft.fontSizes?.[key] ?? 100;
                      return (
                        <label key={key} className="block">
                          <span className="mb-1 flex items-center justify-between text-[10px] text-mute">
                            <span>{label}</span>
                            <span className="font-mono text-gold">{value}%</span>
                          </span>
                          <input
                            type="range"
                            min={75}
                            max={140}
                            step={5}
                            value={value}
                            onChange={(event) => setContentDraft({
                              ...contentDraft,
                              fontSizes: { ...contentDraft.fontSizes, [key]: Number(event.target.value) },
                            })}
                            className="w-full accent-[var(--gold)]"
                            aria-label={`${label} font size`}
                          />
                        </label>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setContentDraft({ ...contentDraft, fontSizes: undefined })}
                      className="justify-self-start text-[10px] text-faint underline underline-offset-2 hover:text-cream"
                    >
                      Reset all font sizes
                    </button>
                  </div>
                </details>

                <div
                  className="mx-auto overflow-hidden rounded-xl border border-line"
                  style={{
                    aspectRatio: aspectCss(previewSpec.aspect),
                    width: `min(100%, ${Math.round(ratioOf(previewSpec.aspect) * 68)}vh)`,
                  }}
                >
                  {previewAsset && <AssetVisual asset={previewAsset} brand={brand} />}
                </div>

                <div className="text-center font-mono text-[9.5px] text-faint">
                  Edit copy, layout, style, or aspect ratio. Clear optional fields to omit them. Preview and final output stay in sync.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1180px] text-[13px] text-faint">Loading wizard…</div>}>
      <CampaignWizard />
    </Suspense>
  );
}
