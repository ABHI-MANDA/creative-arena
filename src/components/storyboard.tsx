import type { Shot } from "@/lib/creative/engine";
import { Clapperboard, Music2 } from "lucide-react";

export function Storyboard({
  shots,
  music,
  durationBadge,
  images,
}: {
  shots: Shot[];
  music?: string;
  durationBadge?: string;
  images: string[];
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Clapperboard size={15} className="text-gold" />
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-mute">
            Reel Storyboard · {shots.length} shots {durationBadge ? `· ${durationBadge}` : ""}
          </span>
        </div>
        {music && (
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-faint">
            <Music2 size={12} /> {music}
          </span>
        )}
      </div>
      <div className="nice-scroll flex snap-x gap-4 overflow-x-auto px-5 py-5">
        {shots.map((s, i) => (
          <div
            key={s.label + s.t}
            className="panel-hover w-[168px] shrink-0 snap-start overflow-hidden rounded-2xl hairline bg-coal"
          >
            <div className="relative aspect-[9/12] overflow-hidden">
              <img
                src={images[i % images.length]}
                alt={s.label}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-transparent to-ink/85" />
              <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
                <span className="rounded-md bg-ink/75 px-2 py-1 font-mono text-[9px] text-gold backdrop-blur">{s.t}</span>
                <span className="rounded-md bg-gold/85 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-[#171208]">
                  {s.label}
                </span>
              </div>
              <p className="absolute inset-x-3 bottom-3 font-display text-[15px] italic leading-snug text-cream">
                “{s.line}”
              </p>
            </div>
            <div className="px-3.5 py-3">
              <p className="text-[11px] leading-relaxed text-mute">{s.visual}</p>
              <div className="mt-2 inline-block rounded-full border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-faint">
                {s.tag}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
