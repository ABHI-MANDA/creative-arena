"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Wand2 } from "lucide-react";
import { cx } from "@/lib/utils";

/**
 * Before → After studio. Bottom layer: the raw property photo.
 * Top layer: AI enhancement (deterministic grade) or the finished ad,
 * clipped by a draggable divider.
 */
export function BeforeAfter({
  original,
  finalAd,
  className,
}: {
  original: string;
  finalAd: ReactNode;
  className?: string;
}) {
  const [pos, setPos] = useState(58);
  const [mode, setMode] = useState<"enhanced" | "final">("enhanced");
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const move = (clientX: number) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(96, Math.max(4, pct)));
  };

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 size={14} className="text-gold" />
          <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-mute">
            Original → {mode === "enhanced" ? "AI Enhanced" : "Final Ad"}
          </span>
        </div>
        <div className="flex gap-1.5">
          {(["enhanced", "final"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cx(
                "rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-all",
                mode === m ? "bg-gold/15 text-gold border border-gold/40" : "border border-line text-faint hover:text-mute"
              )}
            >
              {m === "enhanced" ? "AI Enhanced" : "Final Ad"}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={ref}
        className="relative aspect-[16/10] w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-2xl hairline"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && move(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => (dragging.current = false)}
      >
        {/* bottom: original */}
        <img src={original} alt="Original property" className="absolute inset-0 h-full w-full object-cover" />
        <span className="absolute bottom-3 left-3 z-10 rounded-full bg-ink/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-cream/80 backdrop-blur">
          Original
        </span>

        {/* top: enhanced / final, clipped */}
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
          {mode === "enhanced" ? (
            <>
              <img
                src={original}
                alt="AI enhanced property"
                className="absolute inset-0 h-full w-full object-cover"
                style={{ filter: "brightness(1.07) contrast(1.1) saturate(1.22) sepia(0.12)" }}
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(180deg, rgba(233,163,84,.16), transparent 45%, rgba(23,18,8,.22))" }}
              />
            </>
          ) : (
            <div className="absolute inset-0">{finalAd}</div>
          )}
          <span className="absolute bottom-3 right-3 z-10 rounded-full bg-gold/85 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#171208]">
            {mode === "enhanced" ? "AI Enhanced" : "Final Ad"}
          </span>
        </div>

        {/* handle */}
        <div className="ba-handle" style={{ left: `${pos}%` }}>
          <div className="ba-grip">
            <ChevronLeft size={13} className="-mr-1 text-gold" />
            <ChevronRight size={13} className="-ml-1 text-gold" />
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
        <span>Structure preserved · 100%</span>
        <span>Sky replaced · warm grade</span>
        <span>Lighting: golden hour</span>
        <span>No distorted architecture</span>
      </div>
    </div>
  );
}
