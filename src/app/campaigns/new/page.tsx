"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Loader2, Music2, Palette, Sparkles, Wand2 } from "lucide-react";
import { PLATFORMS, PRESETS } from "@/lib/creative/presets";
import type { Direction } from "@/lib/creative/engine";
import { DynIcon } from "@/components/ui";
import { cx } from "@/lib/utils";
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

function CampaignWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const [properties, setProperties] = useState<PropertyLite[]>([]);
  const [propertyId, setPropertyId] = useState(params.get("property") ?? "");
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [propertiesError, setPropertiesError] = useState("");
  const [propertyLoadAttempt, setPropertyLoadAttempt] = useState(0);
  const [preset, setPreset] = useState("luxury-property");
  const [platforms, setPlatforms] = useState<string[]>(
    params.get("platforms")?.split(",").filter(Boolean) ?? ["ig-post", "ig-reel", "ig-story"]
  );
  const [stage, setStage] = useState<"brief" | "directions">("brief");
  const [directions, setDirections] = useState<Direction[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [modelSelection, setModelSelection] = useState("auto");
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [modelMessage, setModelMessage] = useState("Loading free models…");
  const [selectedDir, setSelectedDir] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setPropertiesLoading(true);
    setPropertiesError("");
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

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directionId: directions[selectedDir]?.id, model: modelSelection }),
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
                  <button onClick={() => setPropertyLoadAttempt((attempt) => attempt + 1)} className="mt-2 text-gold underline">Retry</button>
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

            {/* platforms */}
            <div className="label mb-3 mt-8">3 · Where will you post?</div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {PLATFORMS.map((pl) => {
                const on = platforms.includes(pl.id);
                return (
                  <button key={pl.id} onClick={() => togglePlatform(pl.id)} className={cx("sel-card flex items-center gap-3 rounded-xl p-3.5 text-left", on && "sel-on")}>
                    <DynIcon name={pl.icon} size={17} className={on ? "text-gold" : "text-mute"} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-medium">{pl.label}</div>
                      <div className="font-mono text-[9.5px] uppercase tracking-widest text-faint">{pl.aspect} · {pl.note}</div>
                    </div>
                    <span className={cx("flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border", on ? "border-gold bg-gold text-[#171208]" : "border-line")}>
                      {on && <Check size={10} strokeWidth={4} />}
                    </span>
                  </button>
                );
              })}
            </div>

            {error && <p className="mt-4 text-[12.5px] text-rust">{error}</p>}
            <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                {chosenPreset.objective} · {platforms.length} platform{platforms.length === 1 ? "" : "s"}
              </span>
              <button onClick={getDirections} disabled={!valid || busy} className="btn-gold flex items-center gap-2 rounded-xl px-6 py-3 text-[13.5px] font-semibold disabled:opacity-40">
                {busy ? <Loader2 size={15} className="spin-slow" /> : <Sparkles size={15} />}
                Propose Creative Directions
              </button>
            </div>
          </div>
        </div>
      )}


            <div className="mt-8 max-w-xl">
              <label htmlFor="creative-model" className="label mb-2 block">4 · Generation model</label>
              <select id="creative-model" value={modelSelection} onChange={(event) => setModelSelection(event.target.value)} className="input w-full">
                <option value="auto">Automatic · best suitable free model</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>{model.name}{model.name.toLowerCase().includes("free") ? "" : " (free)"} · {model.contextLength.toLocaleString()} context</option>
                ))}
              </select>
              <p className="mt-1.5 text-[10.5px] text-faint">{modelMessage}. Chosen model and fallback are logged with generation activity.</p>
            </div>
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
            <button onClick={generate} disabled={busy} className="btn-gold flex items-center gap-2 rounded-xl px-7 py-3.5 text-[14px] font-semibold disabled:opacity-50">
              {busy ? <Loader2 size={15} className="spin-slow" /> : <Wand2 size={15} />}
              Generate Campaign <ArrowRight size={14} />
            </button>
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
