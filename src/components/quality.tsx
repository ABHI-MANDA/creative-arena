import Link from "next/link";
import { Check, Settings2, Sparkles, X } from "lucide-react";
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
  thresholds: { ready: number; review: number; diversity?: number };
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
  const diversityChecks = checks.filter((c) =>
    c.label.toLowerCase().includes("diversity") ||
    c.label.toLowerCase().includes("freshness") ||
    c.label.toLowerCase().includes("tailoring")
  );
  const diversityPassed = diversityChecks.filter((c) => c.pass).length;
  const diversityTarget = thresholds.diversity ?? 85;

  return (
    <div className={cx("panel overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-mute">Brand Ad Quality Check</span>
          <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-gold">
            {checks.length}-Point Audit
          </span>
        </div>
        <Link href="/brand" className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-faint transition-colors hover:text-gold">
          <Settings2 size={12} /> Configure
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-5 border-b border-line px-5 py-5">
        <div className="flex items-center gap-4">
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
        <div className="rounded-xl border border-line bg-panel2/60 px-3.5 py-2.5">
          <div className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-wider text-gold font-semibold">
            <Sparkles size={11} /> Diversity &amp; Variation Gate
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-[12px] font-bold text-cream">
              {diversityPassed}/{diversityChecks.length} Verified
            </span>
            <span className="text-[10px] text-faint">(Threshold ≥{diversityTarget}%)</span>
          </div>
          <div className="mt-0.5 text-[9.5px] text-faint">Unique perspective, fresh voiceover, ratio tailored</div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-0 px-5 py-3 sm:grid-cols-2">
        {checks.map((c, i) => {
          const isDiversityCheck =
            c.label.toLowerCase().includes("diversity") ||
            c.label.toLowerCase().includes("freshness") ||
            c.label.toLowerCase().includes("tailoring");
          return (
            <div key={c.label} className="flex items-center justify-between gap-2.5 border-b border-line/50 py-2.5 last:border-0" style={{ animationDelay: `${i * 35}ms` }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={cx(
                    "check-pop flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full",
                    c.pass ? "bg-sage/15 text-sage" : "bg-rust/15 text-rust"
                  )}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  {c.pass ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
                </span>
                <span className={cx("text-[12px] truncate", c.pass ? "text-cream/80" : "text-rust/90")}>{c.label}</span>
              </div>
              {isDiversityCheck && (
                <span className="shrink-0 rounded bg-gold/15 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-wider text-gold">
                  Variety
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-t border-line px-5 py-3 text-[10.5px] leading-relaxed text-faint flex items-center justify-between">
        <span>Thresholds &amp; diversity rules are yours to tune in the Brand Kit.</span>
        <Link href="/brand" className="text-gold hover:underline">Edit Gates →</Link>
      </div>
    </div>
  );
}
