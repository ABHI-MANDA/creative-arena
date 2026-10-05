import Link from "next/link";
import { Check, Settings2, X } from "lucide-react";
import { ScoreRing, StatusPill } from "./ui";
import { cx } from "@/lib/utils";

export function QualityPanel({
  score,
  checks,
  status,
  thresholds,
  compact = false,
  className,
}: {
  score: number;
  checks: { label: string; pass: boolean }[];
  status: string;
  thresholds: { ready: number; review: number };
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <div className={cx("flex items-center gap-3", className)}>
        <ScoreRing score={score} size={40} />
        <StatusPill status={status} />
      </div>
    );
  }
  const passed = checks.filter((c) => c.pass).length;
  return (
    <div className={cx("panel overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-mute">Brand Ad Quality Check</div>
        <Link href="/brand" className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-faint transition-colors hover:text-gold">
          <Settings2 size={12} /> Configure
        </Link>
      </div>
      <div className="flex items-center gap-5 border-b border-line px-5 py-5">
        <ScoreRing score={score} size={76} stroke={5} />
        <div>
          <StatusPill status={status} />
          <div className="mt-2 font-mono text-[11px] text-mute">
            {passed}/{checks.length} checks passed
          </div>
          <div className="mt-1 text-[11px] leading-relaxed text-faint">
            ≥{thresholds.ready} ready to post · {thresholds.review}–{thresholds.ready - 1} review · &lt;{thresholds.review} auto-improve
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-0 px-5 py-3 sm:grid-cols-2">
        {checks.map((c, i) => (
          <div key={c.label} className="flex items-center gap-2.5 border-b border-line/50 py-2.5 last:border-0" style={{ animationDelay: `${i * 45}ms` }}>
            <span
              className={cx(
                "check-pop flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full",
                c.pass ? "bg-sage/15 text-sage" : "bg-rust/15 text-rust"
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {c.pass ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
            </span>
            <span className={cx("text-[12px]", c.pass ? "text-cream/80" : "text-rust/90")}>{c.label}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-line px-5 py-3 text-[10.5px] leading-relaxed text-faint">
        Thresholds are internal review gates — they are yours to tune in the Brand Kit, not an objective
        measure of advertising effectiveness.
      </div>
    </div>
  );
}
