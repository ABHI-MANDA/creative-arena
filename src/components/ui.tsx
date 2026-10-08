import type { LucideIcon } from "lucide-react";
import { cx } from "@/lib/utils";

/* ---------- section heading ---------- */
export function SectionHead({
  kicker,
  title,
  action,
  className,
}: {
  kicker?: string;
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mb-4 flex items-end justify-between gap-4", className)}>
      <div>
        {kicker && (
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
            {kicker}
          </div>
        )}
        <h2 className="font-display text-[22px] font-medium leading-tight md:text-[26px]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ---------- stat card ---------- */
export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  spark,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  spark?: number[];
  accent?: boolean;
}) {
  return (
    <div className="panel panel-hover relative overflow-hidden p-4.5 md:p-5">
      <div className="flex items-start justify-between">
        <div className={cx("label")}>{label}</div>
        <div className={cx("rounded-lg p-2 hairline", accent ? "bg-gold/10 text-gold" : "bg-panel2 text-mute")}>
          <Icon size={15} />
        </div>
      </div>
      <div className="mt-2 font-mono text-[26px] font-medium tracking-tight md:text-[30px]">{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-faint">{sub}</div>}
      {spark && spark.length > 1 && <Sparkline data={spark} className="absolute bottom-3 right-4" />}
    </div>
  );
}

/* ---------- sparkline ---------- */
export function Sparkline({
  data,
  className,
  w = 84,
  h = 26,
}: {
  data: number[];
  className?: string;
  w?: number;
  h?: number;
}) {
  const max = Math.max(...data, 1);
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 3) - 1.5}`)
    .join(" ");
  return (
    <svg width={w} height={h} className={className} aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke="#d9ab5e"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

/* ---------- score ring ---------- */
export function ScoreRing({
  score,
  size = 44,
  stroke = 3.4,
  label = true,
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  const color = score >= 95 ? "#9cc5a1" : score >= 80 ? "#e9c46a" : "#e0765a";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="ring-track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          className="ring-anim"
        />
      </svg>
      {label && (
        <span className="absolute font-mono" style={{ fontSize: Math.max(9, size * 0.26), color }}>
          {score}
        </span>
      )}
    </div>
  );
}

/* ---------- chips & badges ---------- */
export function Chip({
  children,
  tone = "mute",
  className,
}: {
  children: React.ReactNode;
  tone?: "mute" | "gold" | "sage" | "warn" | "rust";
  className?: string;
}) {
  const tones: Record<string, string> = {
    mute: "border-line bg-panel2 text-mute",
    gold: "border-gold/40 bg-gold/10 text-gold",
    sage: "border-sage/40 bg-sage/10 text-sage",
    warn: "border-warn/40 bg-warn/10 text-warn",
    rust: "border-rust/40 bg-rust/10 text-rust",
  };
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em]", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: "sage" | "warn" | "rust" | "mute" | "gold" }> = {
    ready: { label: "Ready to Post", tone: "sage" },
    review: { label: "Needs Review", tone: "warn" },
    improving: { label: "Auto-Improving", tone: "rust" },
    approved: { label: "Approved", tone: "sage" },
    draft: { label: "Draft", tone: "mute" },
    generating: { label: "Generating", tone: "gold" },
    analyzed: { label: "DNA Analyzed", tone: "gold" },
    success: { label: "Success", tone: "sage" },
    failed: { label: "Failed", tone: "rust" },
  };
  const m = map[status] ?? { label: status, tone: "mute" as const };
  return (
    <Chip tone={m.tone}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {m.label}
    </Chip>
  );
}

/* ---------- empty state ---------- */
export function EmptyState({
  icon: Icon,
  title,
  sub,
  action,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="rounded-2xl bg-panel2 p-4 text-gold hairline">
        <Icon size={22} />
      </div>
      <div className="font-display text-xl">{title}</div>
      <p className="max-w-sm text-[13px] leading-relaxed text-mute">{sub}</p>
      {action}
    </div>
  );
}

/* ---------- icon key map for platform/preset strings ---------- */
import {
  BadgePercent,
  Briefcase,
  Camera,
  Crown,
  DoorOpen,
  Globe,
  HardHat,
  KeyRound,
  Layers,
  MapPin,
  MessageCircle,
  PlaySquare,
  Rocket,
  Share2,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Instagram: Camera,
  Facebook: Share2,
  Youtube: PlaySquare,
  Linkedin: Briefcase,
  MessageCircle,
  Globe,
  Crown,
  Rocket,
  Layers,
  BadgePercent,
  KeyRound,
  TrendingUp,
  DoorOpen,
  Sparkles,
  HardHat,
  MapPin,
};

export function DynIcon({ name, size = 15, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICONS[name] ?? Globe;
  return <Icon size={size} className={className} />;
}

/* ---------- skeleton loader ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-panel2/80", className)} />;
}

