"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Building2,
  Clapperboard,
  FolderOpen,
  LayoutDashboard,
  LayoutTemplate,
  Moon,
  Palette,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import { cx } from "@/lib/utils";

type ThemeMode = "dark" | "light";

const NAV = [
  {
    group: "Studio",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/properties", label: "Properties", icon: Building2 },
      { href: "/campaigns", label: "Campaigns", icon: Clapperboard },
    ],
  },
  {
    group: "Library",
    items: [
      { href: "/assets", label: "Ad Library", icon: FolderOpen },
      { href: "/templates", label: "Ad Templates", icon: LayoutTemplate },
      { href: "/brand", label: "Brand Kit & QC", icon: Palette },
    ],
  },
  {
    group: "Operations",
    items: [{ href: "/admin", label: "Admin Console", icon: ShieldCheck }],
  },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const applyTheme = (value: string | undefined) => {
      if (value !== "light" && value !== "dark") return;
      document.documentElement.dataset.theme = value;
      setTheme(value);
    };
    applyTheme(document.documentElement.dataset.theme);

    const syncTheme = (event: StorageEvent) => {
      if (event.key === "arena-theme") applyTheme(event.newValue ?? undefined);
    };
    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
    try {
      window.localStorage.setItem("arena-theme", nextTheme);
    } catch (error) {
      console.warn("Theme preference could not be saved.", error);
    }
  };

  return (
    <div className="relative z-10 flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-coal/70 backdrop-blur-xl md:flex">
        <Link href="/" className="flex items-center gap-3 border-b border-line px-5 py-5">
          <Image src="/images/brand-logo.png" alt="M & A" width={36} height={36} className="h-9 w-9 object-contain" />
          <div>
            <div className="font-display text-[17px] font-medium tracking-wide">M &amp; A</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-faint">
              AI Creative Studio
            </div>
          </div>
        </Link>

        <div className="flex-1 overflow-y-auto px-3 py-4 nice-scroll">
          {NAV.map((section) => (
            <div key={section.group} className="mb-5">
              <div className="px-2 pb-2 font-mono text-[9.5px] uppercase tracking-[0.3em] text-faint">
                {section.group}
              </div>
              {section.items.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cx(
                      "mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition-all",
                      active
                        ? "bg-panel2 text-gold shadow-[inset_0_0_0_1px_rgba(217,171,94,.25)]"
                        : "text-mute hover:bg-panel hover:text-cream"
                    )}
                  >
                    <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <div className="border-t border-line p-3">
          <Link
            href="/properties/new"
            className="btn-gold flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold"
          >
            <Plus size={15} /> New Property
          </Link>
          <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-panel px-3 py-2.5 hairline">
            <Image src="/images/brand-logo.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
            <div className="min-w-0">
                <div className="truncate text-[12px] text-cream">M &amp; A</div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-faint">
                Studio workspace
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-line bg-ink/75 px-4 py-3 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-2 md:hidden">
              <Image src="/images/brand-logo.png" alt="M & A" width={32} height={32} className="h-8 w-8 object-contain" />
              <span className="font-display text-lg">M &amp; A</span>
          </div>
          <div className="hidden items-center gap-2 rounded-xl bg-panel px-3 py-2 hairline md:flex md:w-[340px]">
            <Search size={14} className="text-faint" />
            <input
              placeholder="Search properties, campaigns, ads…"
              className="w-full bg-transparent text-[13px] text-cream outline-none placeholder:text-faint"
            />
            <kbd className="rounded border border-line px-1.5 font-mono text-[9px] text-faint">⌘K</kbd>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="btn-ghost flex h-9 w-9 items-center justify-center rounded-xl text-mute hover:text-cream"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <span className="hidden items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-mute sm:flex">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-sage" />
              Creative engine online
            </span>
            <Link
              href="/campaigns/new"
              className="btn-ghost flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-medium text-gold"
            >
              <Sparkles size={14} /> <span className="hidden sm:inline">Quick Campaign</span>
            </Link>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pb-20 pt-6 md:px-8 md:pt-8">{children}</main>

        {/* mobile nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-line bg-coal/90 py-2 backdrop-blur-xl md:hidden">
          {[...NAV[0].items, ...NAV[1].items.slice(0, 2)].map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={cx("p-2", active ? "text-gold" : "text-faint")}>
                <Icon size={19} />
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
