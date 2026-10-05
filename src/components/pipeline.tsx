"use client";

import { useEffect, useState } from "react";
import { Check, CircleDashed, Loader2, Sparkles } from "lucide-react";
import { cx } from "@/lib/utils";

type Step = { label: string; lines: string[] };

export function PipelineOverlay({
  campaignName,
  assetCount,
  platforms,
  onDone,
}: {
  campaignName: string;
  assetCount: number;
  platforms: string[];
  onDone: () => void;
}) {
  const steps: Step[] = [
    { label: "AI analyzing property", lines: ["Reading Creative DNA…", "Matching reference architecture", "Locking structure-preservation profile"] },
    { label: "Building creative direction", lines: ["Direction: Golden Hour Cinema", "Grade: amber lift, crushed blacks", "Typography: serif-led lock-up"] },
    { label: "Generating visuals", lines: [`Enhancing ${platforms.length} platform masters`, "Reference-preserving renders", "Sky, lighting & atmosphere passes"] },
    { label: "Composing ad system", lines: [`Laying out ${assetCount} deliverables`, "Safe zones + brand lock-up applied", "Copy pack + hashtags written"] },
    { label: "Brand ad quality check", lines: ["11-point QC sweep", "Structure, claims, readability…", "Thresholds applied from Brand Kit"] },
    { label: "Packaging campaign", lines: ["Assembling ready-to-post package", "Manifest + captions + storyboard", "Done."] },
  ];

  const [step, setStep] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    if (step >= steps.length) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
    const total = steps[step].lines.length;
    if (lineIdx < total) {
      const t = setTimeout(() => setLineIdx((v) => v + 1), 260 + Math.random() * 240);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setStep((s) => s + 1);
      setLineIdx(0);
    }, 320);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, lineIdx]);

  return (
    <div className="anim-up panel mx-auto max-w-2xl overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10 text-gold hairline">
          <Sparkles size={17} />
        </div>
        <div>
          <div className="font-display text-lg leading-tight">Creating campaign</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">{campaignName}</div>
        </div>
      </div>
      <div className="px-6 py-5">
        {steps.map((s, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <div key={s.label} className={cx("flex gap-3.5 pb-5 last:pb-0", !active && !done && "opacity-40")}>
              <div className="flex flex-col items-center">
                {done ? (
                  <span className="check-pop flex h-5.5 w-5.5 items-center justify-center rounded-full bg-sage/15 text-sage">
                    <Check size={11} strokeWidth={3} />
                  </span>
                ) : active ? (
                  <Loader2 size={20} className="spin-slow text-gold" />
                ) : (
                  <CircleDashed size={20} className="text-faint" />
                )}
                {i < steps.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className={cx("text-[14px] font-medium", active ? "text-cream" : done ? "text-mute" : "text-faint")}>
                  {s.label}
                </div>
                {active && (
                  <div className="mt-1.5 space-y-1">
                    {s.lines.slice(0, lineIdx).map((l) => (
                      <div key={l} className="anim-up font-mono text-[11px] text-faint">
                        <span className="text-gold/70">▸</span> {l}
                      </div>
                    ))}
                    {lineIdx < s.lines.length && <div className="shimmer h-3 w-40 rounded bg-panel2" />}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
