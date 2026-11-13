"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Film, Layers, Loader2, Palette, Shuffle, Sparkles, X } from "lucide-react";
import type { ApprovedAdContent, Direction } from "@/lib/creative/engine";
import { TRANSCRIPT_STYLE_OPTIONS, type TranscriptStyle } from "@/lib/creative/presets";
import { cx } from "@/lib/utils";

function createVariationSeed(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function ReviewContentModal({
  campaignId,
  property,
  directionId,
  directions,
  platformsCount = 4,
  isOpen,
  onClose,
  onSuccess,
}: {
  campaignId: string;
  property: { id: string; name: string; location: string; propertyType: string; price: string; cover?: string | null };
  directionId?: string;
  directions?: Direction[];
  platformsCount?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [directionChoice, setDirectionChoice] = useState({
    source: directionId,
    selected: directionId ?? directions?.[0]?.id,
  });
  const activeDirectionId = directionChoice.source === directionId
    ? directionChoice.selected ?? directions?.[0]?.id
    : directionId ?? directions?.[0]?.id;
  const [activeStyle, setActiveStyle] = useState<TranscriptStyle>();
  const [availableStyles, setAvailableStyles] = useState<TranscriptStyle[]>([]);
  const [autoDiversifyAspects, setAutoDiversifyAspects] = useState(true);
  const [contentDraft, setContentDraft] = useState<ApprovedAdContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const variationSeedRef = useRef<string | undefined>(undefined);
  const requestIdRef = useRef(0);

  const loadContent = useCallback(async (
    targetDirId?: string,
    targetStyle?: TranscriptStyle,
    targetSeed?: string
  ) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/prepare-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directionId: targetDirId,
          variationStyle: targetStyle,
          variationSeed: targetSeed ?? variationSeedRef.current,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        content?: ApprovedAdContent;
        error?: string;
        variationSeed?: string;
        variationStyles?: TranscriptStyle[];
        autoDiversifyAspects?: boolean;
      };
      if (!res.ok || !data.content) throw new Error(data.error ?? "Failed to prepare ad content");
      if (requestId !== requestIdRef.current) return;
      setContentDraft(data.content);
      variationSeedRef.current = data.variationSeed ?? data.content.variationSeed;
      setActiveStyle(data.content.variationStyle as TranscriptStyle);
      setAvailableStyles(data.variationStyles ?? TRANSCRIPT_STYLE_OPTIONS.map((style) => style.id));
      setAutoDiversifyAspects(data.autoDiversifyAspects !== false);
    } catch (e) {
      if (requestId === requestIdRef.current) {
        setError(e instanceof Error ? e.message : "Failed to load content for review");
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [campaignId]);

  const switchVariationStyle = (newStyle: TranscriptStyle) => {
    setActiveStyle(newStyle);
    void loadContent(activeDirectionId ?? directionId ?? directions?.[0]?.id, newStyle);
  };

  const shuffleVariation = () => {
    const candidateStyles = availableStyles.filter((style) => style !== activeStyle);
    const randomStyle = candidateStyles[Math.floor(Math.random() * candidateStyles.length)] ?? activeStyle;
    const variationSeed = createVariationSeed();
    variationSeedRef.current = variationSeed;
    if (randomStyle) setActiveStyle(randomStyle);
    void loadContent(
      activeDirectionId ?? directionId ?? directions?.[0]?.id,
      randomStyle,
      variationSeed
    );
  };

  useEffect(() => {
    if (!isOpen) {
      requestIdRef.current++;
      variationSeedRef.current = undefined;
      return;
    }
    variationSeedRef.current = undefined;
    const timer = setTimeout(() => {
      void loadContent(directionId ?? directions?.[0]?.id);
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, campaignId, directionId, directions, loadContent]);

  const handleApproveAndGenerate = async () => {
    if (!contentDraft) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directionId: activeDirectionId,
          approvedContent: contentDraft,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Generation failed");
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate ads");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-[1140px] rounded-2xl border border-line/80 bg-coal shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line/70 px-6 py-4 bg-panel2/60">
          <div className="flex items-center gap-2.5">
            <span className="rounded-full border border-gold/40 bg-gold/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gold font-semibold">
              Step: Content Review &amp; Approval
            </span>
            <span className="font-medium text-[14px] text-cream">Review Contents for Ad Post Images</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-line/40 hover:text-cream"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Loader2 size={32} className="spin-slow text-gold mb-3" />
              <p className="text-[14px] font-medium text-cream">Preparing and formatting ad contents…</p>
              <p className="text-[12px] text-faint mt-1">Extracting headlines, BHK highlight, amenities, and image prompts for review</p>
            </div>
          ) : contentDraft ? (
            <div className="grid gap-6 lg:grid-cols-12 items-start">
              {/* Left Column: Form */}
              <div className="lg:col-span-7 space-y-4">
                {directions && directions.length > 0 && (
                  <div className="rounded-xl border border-line/70 bg-panel/50 p-4 space-y-2.5">
                    <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-gold font-semibold">
                      <span className="flex items-center gap-1.5"><Palette size={12} /> Creative Direction</span>
                      <span className="text-faint text-[9px]">Select Direction</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {directions.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            setDirectionChoice({ source: directionId, selected: d.id });
                            void loadContent(d.id, activeStyle, variationSeedRef.current);
                          }}
                          className={cx(
                            "rounded-lg p-2.5 text-left border transition-all text-xs",
                            activeDirectionId === d.id
                              ? "border-gold bg-gold/15 text-cream ring-1 ring-gold/40 shadow-sm"
                              : "border-line bg-coal/70 text-mute hover:border-gold/40 hover:text-cream"
                          )}
                        >
                          <div className="h-2 w-full rounded-sm mb-1.5" style={{ background: `linear-gradient(90deg, ${d.hex[0]}, ${d.hex[2] || d.hex[1]})` }} />
                          <div className="font-semibold truncate text-[11.5px]">{d.name}</div>
                          <div className="font-mono text-[9px] text-faint truncate">{d.tagline}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Positive Variation & Automated Style Controls */}
                <div className="rounded-xl border border-line/80 bg-panel/70 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-gold font-semibold">
                      <Sparkles size={12} className="text-gold" /> Auto-Variation &amp; Script Style
                    </span>
                    <button
                      type="button"
                      onClick={shuffleVariation}
                      disabled={loading}
                      className="flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold transition-all hover:bg-gold/20"
                    >
                      <Shuffle size={12} /> Shuffle Variations
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {TRANSCRIPT_STYLE_OPTIONS.filter((style) => availableStyles.includes(style.id)).map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => switchVariationStyle(v.id)}
                        disabled={loading}
                        className={cx(
                          "rounded-lg p-2 text-left border transition-all text-xs",
                          activeStyle === v.id
                            ? "border-gold bg-gold/15 text-cream ring-1 ring-gold/40 shadow-sm"
                            : "border-line bg-coal/70 text-mute hover:border-gold/40 hover:text-cream"
                        )}
                      >
                        <div className="font-semibold text-[11px] truncate">{v.label}</div>
                        <div className="text-[9.5px] text-faint line-clamp-1 mt-0.5">{v.desc}</div>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-faint pt-1 border-t border-line/50">
                    <span className="flex items-center gap-1.5 text-sage">
                      <Check size={11} /> {autoDiversifyAspects ? "Per-format visual variation active" : "One visual direction across formats"}
                    </span>
                    <span>Auto-selected from Brand Kit</span>
                  </div>
                </div>

                <div className="rounded-xl border border-line/70 bg-panel/50 p-4.5 space-y-3.5">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-gold font-semibold">
                    <span>Ad Image Typography &amp; Content</span>
                    <span className="text-faint text-[9px]">Edit Any Field</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label mb-1 text-[10.5px]">Developer / Brand</label>
                      <input
                        type="text"
                        className="input w-full font-sans text-[12.5px]"
                        value={contentDraft.developer}
                        onChange={(e) => setContentDraft({ ...contentDraft, developer: e.target.value })}
                        placeholder="e.g. PURAVANKARA"
                      />
                    </div>
                    <div>
                      <label className="label mb-1 text-[10.5px]">Project Name / Headline</label>
                      <input
                        type="text"
                        className="input w-full font-sans text-[12.5px] font-semibold"
                        value={contentDraft.project}
                        onChange={(e) => setContentDraft({ ...contentDraft, project: e.target.value })}
                        placeholder="e.g. CODENAME PARK"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label mb-1 text-[10.5px]">Tagline / Hook</label>
                    <input
                      type="text"
                      className="input w-full font-sans text-[12.5px]"
                      value={contentDraft.tagline}
                      onChange={(e) => setContentDraft({ ...contentDraft, tagline: e.target.value })}
                      placeholder="e.g. WHERE LUXURY MEETS NATURE"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label mb-1 text-[10.5px]">Configuration (BHK)</label>
                      <input
                        type="text"
                        className="input w-full font-sans text-[12.5px] font-bold text-gold"
                        value={contentDraft.bhk}
                        onChange={(e) => setContentDraft({ ...contentDraft, bhk: e.target.value })}
                        placeholder="e.g. 3 & 4 BHK"
                      />
                    </div>
                    <div>
                      <label className="label mb-1 text-[10.5px]">Typology &amp; Location</label>
                      <input
                        type="text"
                        className="input w-full font-sans text-[12.5px]"
                        value={contentDraft.locationTag}
                        onChange={(e) => setContentDraft({ ...contentDraft, locationTag: e.target.value })}
                        placeholder="e.g. LUXURY RESIDENCES IN HENNUR"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label mb-1 text-[10.5px]">Key Amenities Line (pipe-separated)</label>
                    <input
                      type="text"
                      className="input w-full font-sans text-[12.5px]"
                      value={contentDraft.amenitiesLine}
                      onChange={(e) => setContentDraft({ ...contentDraft, amenitiesLine: e.target.value })}
                      placeholder="e.g. 80% OPEN SPACES | 20 WORLD CLASS AMENITIES"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label mb-1 text-[10.5px]">Starting Price Block</label>
                      <input
                        type="text"
                        className="input w-full font-sans text-[12.5px] font-bold text-cream"
                        value={contentDraft.price}
                        onChange={(e) => setContentDraft({ ...contentDraft, price: e.target.value })}
                        placeholder="e.g. ₹3.2 CR*"
                      />
                    </div>
                    <div>
                      <label className="label mb-1 text-[10.5px]">Button Text (CTA)</label>
                      <input
                        type="text"
                        className="input w-full font-sans text-[12.5px] font-semibold text-gold"
                        value={contentDraft.cta}
                        onChange={(e) => setContentDraft({ ...contentDraft, cta: e.target.value })}
                        placeholder="BOOK NOW"
                      />
                    </div>
                  </div>
                </div>

                {/* AI Image Generation Prompt */}
                <div className="rounded-xl border border-line/70 bg-panel/50 p-4.5 space-y-2">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-gold font-semibold">
                    <span>AI Image Generation Prompt</span>
                    <span className="text-faint text-[9px]">Agnes AI / FLUX</span>
                  </div>
                  <p className="text-[10.5px] leading-relaxed text-faint">
                    This editable base prompt is combined with 12 seeded concepts, including neutral illustrative residential interiors, and distinct treatments for each ad.
                  </p>
                  <textarea
                    rows={3}
                    className="input w-full font-mono text-[11.5px] leading-relaxed resize-y"
                    value={contentDraft.imagePrompt}
                    onChange={(e) => setContentDraft({ ...contentDraft, imagePrompt: e.target.value })}
                    placeholder="Describe architectural facade, swimming pool, lighting..."
                  />
                </div>

                {/* Video Reel Transcript Voiceover */}
                <div className="rounded-xl border border-line/70 bg-panel/50 p-4 space-y-2">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-gold font-semibold">
                    <span className="flex items-center gap-1.5"><Film size={12} /> Video Reel Transcript Voiceover</span>
                    <span className="text-faint text-[9.5px] capitalize">{activeStyle} narration</span>
                  </div>
                  <div className="rounded-lg border border-line/60 bg-coal/70 p-3 text-[11.5px] text-cream/90 italic leading-relaxed">
                    “{contentDraft.tagline}. Rising over {property.location} — {contentDraft.project}. Crafted for distinguished living. {contentDraft.cta} — reserve your private walkthrough.”
                  </div>
                  <div className="text-[10px] text-faint flex items-center justify-between">
                    <span>Generated from active narrative style</span>
                    <span className="text-gold">15s / 30s Reel Storyboard Ready</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Mock Card */}
              <div className="lg:col-span-5">
                <div className="rounded-xl border border-gold/30 bg-coal p-4 space-y-2.5">
                  <div className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-wider text-faint border-b border-line/60 pb-2">
                    <span className="text-gold font-semibold">Live Preview</span>
                    <span>Real-time Layout</span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-0.5 pb-1">
                    <label className="min-w-0 flex-1">
                      <span className="label mb-1 block text-[9.5px]">Layout</span>
                      <select
                        value={contentDraft.layout ?? "automatic"}
                        onChange={(e) => setContentDraft({ ...contentDraft, layout: e.target.value as ApprovedAdContent["layout"] })}
                        className="input w-full text-[10.5px] py-1"
                        aria-label="Preview layout"
                      >
                        <option value="automatic">Automatic for aspect ratio</option>
                        <option value="poster">Poster</option>
                        <option value="split">Split layout</option>
                      </select>
                    </label>
                    <label className="min-w-0 flex-1">
                      <span className="label mb-1 block text-[9.5px]">Design style</span>
                      <select
                        value={contentDraft.designStyle ?? "editorial"}
                        onChange={(e) => setContentDraft({ ...contentDraft, designStyle: e.target.value as ApprovedAdContent["designStyle"] })}
                        className="input w-full text-[10.5px] py-1"
                        aria-label="Preview design style"
                      >
                        <option value="editorial">Editorial</option>
                        <option value="minimal">Minimal</option>
                        <option value="bold">Bold</option>
                      </select>
                    </label>
                  </div>

                  <div
                    className="relative w-full rounded-lg overflow-hidden flex flex-col justify-between shadow-xl border border-line"
                    style={{
                      aspectRatio: "4/5",
                      background: "linear-gradient(180deg, #0b130e 0%, #111a14 45%, #080d09 100%)",
                    }}
                  >
                    <div
                      className="absolute inset-0 opacity-35 bg-cover bg-center pointer-events-none"
                      style={{
                        backgroundImage: `url(${property.cover || "/images/props/villa-hero.jpg"})`,
                      }}
                    />
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: "linear-gradient(180deg, rgba(6,10,8,0.8) 0%, rgba(6,10,8,0.25) 35%, transparent 50%, rgba(4,8,6,0.6) 80%, rgba(3,6,5,0.95) 100%)"
                      }}
                    />

                    {/* Top Typography Zone */}
                    <div className="relative z-10 pt-4 px-3 text-center">
                      <div className="font-sans font-bold tracking-[0.16em] text-white text-[10px] drop-shadow">
                        {contentDraft.developer || "DEVELOPER"}
                      </div>
                      <div className="font-sans font-extrabold uppercase tracking-[0.05em] text-white text-[17px] leading-tight mt-0.5 drop-shadow-md">
                        {contentDraft.project || "PROJECT NAME"}
                      </div>
                      <p className="font-sans font-semibold tracking-[0.12em] text-white/95 text-[8.5px] drop-shadow mt-0.5">
                        {contentDraft.tagline || "WHERE LUXURY MEETS NATURE"}
                      </p>
                      <div className="font-sans font-black tracking-tight text-white text-[22px] leading-none mt-1.5 drop-shadow-lg">
                        {contentDraft.bhk || "3 & 4 BHK"}
                      </div>
                      <div className="font-sans font-semibold tracking-[0.18em] text-white/90 text-[8px] mt-0.5 drop-shadow">
                        {contentDraft.locationTag || "LUXURY RESIDENCES"}
                      </div>
                      <div className="font-sans font-medium tracking-[0.08em] text-white/85 text-[7.5px] mt-0.5 drop-shadow">
                        {contentDraft.amenitiesLine || "80% OPEN SPACES | 20 WORLD CLASS AMENITIES"}
                      </div>
                      <div className="mt-1.5 flex flex-col items-center">
                        <div className="font-sans font-semibold tracking-[0.16em] text-white/80 text-[6.5px] flex items-center gap-1.5">
                          <span className="w-3.5 h-[1px] bg-white/40" />
                          <span>STARTING FROM</span>
                          <span className="w-3.5 h-[1px] bg-white/40" />
                        </div>
                        <div className="font-sans font-black text-white text-[15px] leading-none mt-0.5 drop-shadow-md">
                          {contentDraft.price || "₹3.2 CR*"}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1" />

                    {/* Bottom White Button: "BOOK NOW" */}
                    <div className="relative z-10 w-full text-center font-sans font-bold text-[#0c120e] bg-white py-2 px-3 text-[11px] tracking-[0.08em] shadow">
                      {contentDraft.cta || "BOOK NOW"}
                    </div>
                  </div>

                  <p className="text-center font-mono text-[9px] text-faint">
                    Live layout preview reflects your edits instantly.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-[13px] text-rust">
              {error || "Could not load content for review."}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 bg-panel2/60 px-6 py-4">
          <button
            onClick={shuffleVariation}
            disabled={loading || submitting}
            className="btn-ghost rounded-xl px-4 py-2.5 text-[12px] text-cream/90 border border-line hover:border-gold/50"
          >
            <Sparkles size={13} className="mr-1.5 inline text-gold" /> Re-draft with AI
          </button>

          <div className="flex items-center gap-2.5">
            {error && <span className="text-[12px] text-rust mr-2">{error}</span>}
            <button
              onClick={onClose}
              disabled={submitting}
              className="btn-ghost rounded-xl px-4 py-2.5 text-[12px] text-mute"
            >
              Cancel
            </button>
            <button
              onClick={handleApproveAndGenerate}
              disabled={loading || submitting || !contentDraft}
              className="btn-gold flex items-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-semibold shadow-md shadow-gold/10 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="spin-slow" /> : <Check size={14} />}
              Approve &amp; Generate Final Output <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
