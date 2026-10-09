"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2, Sparkles, X } from "lucide-react";
import type { ApprovedAdContent } from "@/lib/creative/engine";

export function ReviewContentModal({
  campaignId,
  property,
  directionId,
  platformsCount = 4,
  isOpen,
  onClose,
  onSuccess,
}: {
  campaignId: string;
  property: { id: string; name: string; location: string; propertyType: string; price: string; cover?: string | null };
  directionId?: string;
  platformsCount?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [contentDraft, setContentDraft] = useState<ApprovedAdContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadContent = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/prepare-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directionId }),
      });
      const data = (await res.json()) as { ok?: boolean; content?: ApprovedAdContent; error?: string };
      if (!res.ok || !data.content) throw new Error(data.error ?? "Failed to prepare ad content");
      setContentDraft(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load content for review");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadContent();
    }
  }, [isOpen, campaignId]);

  const handleApproveAndGenerate = async () => {
    if (!contentDraft) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directionId,
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
                  <textarea
                    rows={3}
                    className="input w-full font-mono text-[11.5px] leading-relaxed resize-y"
                    value={contentDraft.imagePrompt}
                    onChange={(e) => setContentDraft({ ...contentDraft, imagePrompt: e.target.value })}
                    placeholder="Describe architectural facade, swimming pool, lighting..."
                  />
                </div>
              </div>

              {/* Right Column: Live Mock Card */}
              <div className="lg:col-span-5">
                <div className="rounded-xl border border-gold/30 bg-coal p-4 space-y-2.5">
                  <div className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-wider text-faint border-b border-line/60 pb-2">
                    <span className="text-gold font-semibold">Live Preview</span>
                    <span>Real-time Layout</span>
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
                      <div className="mt-0.5 flex flex-col items-center">
                        <p className="font-sans font-semibold tracking-[0.12em] text-white/95 text-[8.5px] drop-shadow">
                          {contentDraft.tagline || "WHERE LUXURY MEETS NATURE"}
                        </p>
                        <div className="w-14 h-[1px] bg-white/40 mt-0.5" />
                      </div>
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
            onClick={loadContent}
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

