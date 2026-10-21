"use client";

import { useState } from "react";
import { Check, Loader2, Lock, Palette, ShieldCheck, Type } from "lucide-react";
import { AD_TEXT_SECTIONS, type AdTextSection, type BrandSettings } from "@/lib/creative/presets";
import { AdCreative } from "@/components/ad-creative";
import { cx } from "@/lib/utils";
import { DEFAULT_SCRIM_SETTINGS } from "@/lib/creative/style-config";

const TONES = ["Elegant", "Trustworthy", "Bold", "Warm", "Minimal", "Aspirational", "Technical", "Playful"];

export function BrandEditor({ initial }: { initial: BrandSettings }) {
  const [brand, setBrand] = useState<BrandSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const set = <K extends keyof BrandSettings>(k: K, v: BrandSettings[K]) =>
    setBrand((b) => ({ ...b, [k]: v }));

  const toggleTone = (t: string) =>
    set("tones", brand.tones.includes(t) ? brand.tones.filter((x) => x !== t) : [...brand.tones, t]);

  const setFontSize = (section: AdTextSection, value: number) =>
    set("typographyDefaults", {
      ...brand.typographyDefaults,
      fontSizes: { ...brand.typographyDefaults.fontSizes, [section]: value },
    });

  const setFontColor = (section: AdTextSection, value: string) =>
    set("typographyDefaults", {
      ...brand.typographyDefaults,
      fontColors: { ...brand.typographyDefaults.fontColors, [section]: value },
    });

  const save = async () => {
    setBusy(true);
    setSaved(false);
    setSaveError("");
    try {
      const response = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brand),
      });
      if (!response.ok) throw new Error("Could not save the Brand Kit.");
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Could not save the Brand Kit.");
    } finally {
      setBusy(false);
    }
  };

  const preview = {
    kind: "hero",
    platform: "ig-post",
    aspect: "4:5",
    payload: {
      kicker: `THE ${brand.name.toUpperCase()} COLLECTION`,
      headline: "A rare address in Whitefield.",
      subline: "4 BHK villas for those who arrive — crafted, not built.",
      priceLine: "₹4.8 Cr onwards",
      cta: "Explore Residences",
      image: "/images/props/villa-hero.jpg",
      hex: ["#0B0A08", brand.color, "#8C6B4A"],
      fontSizes: brand.typographyDefaults.fontSizes,
      fontColors: brand.typographyDefaults.fontColors,
      scrimSettings: DEFAULT_SCRIM_SETTINGS,
    },
  };

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="anim-up mb-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">Brand Kit & Quality Gates</div>
        <h1 className="font-display mt-2 text-[34px] font-medium leading-tight">One brand. <span className="gold-text italic">Every frame.</span></h1>
        <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-mute">
          Templates inherit these tokens instantly. QC thresholds decide when an asset may be marked
          Ready to Post — tune them to your team&apos;s bar.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        {/* form */}
        <div className="anim-up anim-d1 panel h-fit p-6 md:p-7">
          <div className="mb-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.26em] text-mute">
            <Palette size={13} className="text-gold" /> Identity
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="label mb-1.5">Brand name</div>
              <input className="input" value={brand.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <div className="label mb-1.5">Domain</div>
              <input className="input" value={brand.domain} onChange={(e) => set("domain", e.target.value)} />
            </div>
            <div>
              <div className="label mb-1.5">Signature colour</div>
              <div className="flex items-center gap-2.5">
                <input type="color" value={brand.color} onChange={(e) => set("color", e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-panel2" />
                <input className="input" value={brand.color} onChange={(e) => set("color", e.target.value)} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="label mb-2">Brand tone</div>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button key={t} onClick={() => toggleTone(t)} className={cx("rounded-full border px-3.5 py-1.5 text-[12px] transition-all", brand.tones.includes(t) ? "border-gold/60 bg-gold/10 text-gold" : "border-line text-faint hover:text-mute")}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-line pt-6">
            <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.26em] text-mute">
              <Type size={13} className="text-gold" /> Typography defaults
            </div>
            <p className="mb-5 text-[12px] leading-relaxed text-faint">
              Set baseline size and color per copy line. These apply to new campaign generations.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {AD_TEXT_SECTIONS.map(({ key, label }) => (
                <div key={key} className="rounded-xl border border-line bg-coal/60 p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label htmlFor={`brand-font-size-${key}`} className="text-[11.5px] font-medium text-cream/90">
                      {label}
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-gold">
                        {brand.typographyDefaults.fontSizes[key]}%
                      </span>
                      <input
                        type="color"
                        aria-label={`${label} color`}
                        value={brand.typographyDefaults.fontColors[key]}
                        onChange={(event) => setFontColor(key, event.target.value)}
                        className="h-7 w-8 cursor-pointer rounded border border-line bg-panel"
                      />
                    </label>
                  </div>
                  <input
                    id={`brand-font-size-${key}`}
                    type="range"
                    min={75}
                    max={140}
                    step={5}
                    value={brand.typographyDefaults.fontSizes[key]}
                    onChange={(event) => setFontSize(key, Number(event.target.value))}
                    className="w-full accent-[var(--gold)]"
                    aria-label={`${label} font size`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 border-t border-line pt-6">
            <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.26em] text-mute">
              <ShieldCheck size={13} className="text-gold" /> Quality gates
            </div>
            <p className="mb-5 text-[12px] leading-relaxed text-faint">
              These thresholds are internal review gates — configurable by you, not an objective
              measure of advertising effectiveness.
            </p>
            <div className="space-y-6">
              <div>
                <div className="mb-2 flex justify-between text-[12px]">
                  <span className="text-cream/85">Ready to Post — minimum QC score</span>
                  <span className="font-mono text-sage">≥ {brand.thresholds.ready}</span>
                </div>
                <input type="range" min={88} max={99} value={brand.thresholds.ready} onChange={(e) => {
                  const v = Number(e.target.value);
                  set("thresholds", { ready: v, review: Math.min(brand.thresholds.review, v - 1) });
                }} className="w-full" />
              </div>
              <div>
                <div className="mb-2 flex justify-between text-[12px]">
                  <span className="text-cream/85">Needs Review — floor before auto-improve</span>
                  <span className="font-mono text-warn">{brand.thresholds.review} – {brand.thresholds.ready - 1}</span>
                </div>
                <input type="range" min={60} max={94} value={brand.thresholds.review} onChange={(e) => {
                  const v = Number(e.target.value);
                  set("thresholds", { ready: Math.max(brand.thresholds.ready, v + 1), review: v });
                }} className="w-full" />
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
            {saved ? (
              <span className="flex items-center gap-1.5 text-[12.5px] text-sage"><Check size={14} /> Brand kit saved</span>
            ) : saveError ? (
              <span role="alert" className="text-[12px] text-rust">{saveError}</span>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Changes apply to all new generations</span>
            )}
            <button onClick={save} disabled={busy} className="btn-gold flex items-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-semibold disabled:opacity-50">
              {busy ? <Loader2 size={14} className="spin-slow" /> : <Lock size={13} />} Save Brand Kit
            </button>
          </div>
        </div>

        {/* live preview */}
        <div className="anim-up anim-d2 space-y-4">
          <div>
            <div className="mb-2.5 flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.22em] text-faint">
              <span>Live lock-up preview</span>
              <span className="text-gold">4:5 · hero</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-line shadow-[0_30px_60px_-30px_rgba(0,0,0,.8)]">
              <AdCreative asset={preview} brand={brand} />
            </div>
          </div>
          <div className="panel p-5">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-mute">Gate behaviour</div>
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between"><span className="text-mute">Score 96, all checks pass</span><span className="font-mono text-sage">→ Ready to Post</span></div>
              <div className="flex justify-between"><span className="text-mute">Score 90, minor contrast flag</span><span className="font-mono text-warn">→ Needs Review</span></div>
              <div className="flex justify-between"><span className="text-mute">Below floor</span><span className="font-mono text-rust">→ Auto-Improve</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
