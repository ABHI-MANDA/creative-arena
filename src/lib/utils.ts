export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

export function timeAgo(input: Date | string | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  const s = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function aspectCss(aspect: string): string {
  const [w, h] = aspect.split(":").map(Number);
  if (!w || !h) return "4 / 5";
  return `${w} / ${h}`;
}

export function ratioOf(aspect: string): number {
  const [w, h] = aspect.split(":").map(Number);
  return !w || !h ? 0.8 : w / h;
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "A"
  );
}
