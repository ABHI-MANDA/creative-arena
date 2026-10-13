"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Clapperboard,
  CornerDownLeft,
  FileImage,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { cx } from "@/lib/utils";

type SearchResultItem = {
  id?: string;
  name?: string;
  title?: string;
  label?: string;
  description?: string;
  location?: string;
  propertyType?: string;
  price?: string;
  cover?: string;
  propertyName?: string;
  presetLabel?: string;
  status?: string;
  kind?: string;
  platform?: string;
  aspect?: string;
  score?: number;
  url?: string;
  href?: string;
  category?: string;
};

type SearchResponse = {
  query: string;
  properties: SearchResultItem[];
  campaigns: SearchResultItem[];
  assets: SearchResultItem[];
  actions: SearchResultItem[];
};

export function SearchPalette() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((open) => !open);
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      fetchResults(query);
    } else {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Debounced search query
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      fetchResults(query);
    }, 180);
    return () => clearTimeout(timer);
  }, [query, isOpen]);

  const fetchResults = async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = (await res.json()) as SearchResponse;
        setResults(data);
        setSelectedIndex(0);
      }
    } catch (err) {
      console.warn("Search fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // Flatten all visible items for index-based keyboard navigation
  const allItems: Array<{ item: SearchResultItem; type: "property" | "campaign" | "asset" | "action" }> = [];
  if (results) {
    results.actions.forEach((item) => allItems.push({ item, type: "action" }));
    results.properties.forEach((item) => allItems.push({ item, type: "property" }));
    results.campaigns.forEach((item) => allItems.push({ item, type: "campaign" }));
    results.assets.forEach((item) => allItems.push({ item, type: "asset" }));
  }

  const navigateTo = (targetUrl: string) => {
    setIsOpen(false);
    startTransition(() => {
      router.push(targetUrl);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((idx) => (idx + 1) % Math.max(1, allItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((idx) => (idx - 1 + allItems.length) % Math.max(1, allItems.length));
    } else if (e.key === "Enter" && allItems[selectedIndex]) {
      e.preventDefault();
      const target = allItems[selectedIndex].item;
      const targetUrl = target.url || target.href;
      if (targetUrl) navigateTo(targetUrl);
    }
  };

  return (
    <>
      {/* Trigger Button inside top navigation */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="hidden items-center justify-between gap-2 rounded-xl bg-panel px-3 py-2 text-left hairline transition-colors hover:bg-panel2 md:flex md:w-[340px]"
        aria-label="Search studio"
      >
        <span className="flex items-center gap-2 text-faint">
          <Search size={14} className="text-gold/80" />
          <span className="text-[13px] text-faint">Search properties, campaigns, ads…</span>
        </span>
        <kbd className="rounded border border-line bg-ink/60 px-1.5 py-0.5 font-mono text-[9.5px] text-faint">
          ⌘K
        </kbd>
      </button>

      {/* Mobile Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn-ghost flex h-9 w-9 items-center justify-center rounded-xl text-mute hover:text-cream md:hidden"
        aria-label="Open search"
      >
        <Search size={16} />
      </button>

      {/* Command Palette Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-ink/80 p-4 pt-16 backdrop-blur-md animate-in fade-in duration-150 sm:pt-24"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative w-full max-w-[640px] overflow-hidden rounded-2xl border border-line/90 bg-coal shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Input Header */}
            <div className="flex items-center gap-3 border-b border-line/80 px-4 py-3.5 bg-panel/70">
              <Search size={18} className="text-gold shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search properties, campaigns, ads, or actions…"
                className="w-full bg-transparent text-[14.5px] text-cream outline-none placeholder:text-faint"
                aria-label="Search studio input"
              />
              {loading && <Loader2 size={16} className="spin-slow text-gold shrink-0" />}
              {query && !loading && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="rounded-lg p-1 text-faint hover:text-cream hover:bg-line/40"
                  aria-label="Clear query"
                >
                  <X size={15} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-line/80 px-2 py-1 font-mono text-[10px] text-faint hover:text-cream"
              >
                ESC
              </button>
            </div>

            {/* Results Body */}
            <div className="max-h-[62vh] overflow-y-auto p-2.5 nice-scroll">
              {allItems.length === 0 && !loading && (
                <div className="py-12 text-center text-faint">
                  <p className="text-[14px]">No results found for &ldquo;{query}&rdquo;</p>
                  <p className="mt-1 text-[12px] text-mute">
                    Try searching for project names, location keywords, or format types (e.g. &ldquo;Villa&rdquo;, &ldquo;Reels&rdquo;, &ldquo;Instagram&rdquo;)
                  </p>
                </div>
              )}

              {/* Actions Section */}
              {results && results.actions.length > 0 && (
                <div className="mb-3">
                  <div className="px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.25em] text-gold font-semibold">
                    Studio Actions &amp; Navigation
                  </div>
                  <div className="space-y-1">
                    {results.actions.map((action) => {
                      const overallIndex = allItems.findIndex((x) => x.item === action);
                      const isSelected = overallIndex === selectedIndex;
                      return (
                        <div
                          key={action.label}
                          onClick={() => action.href && navigateTo(action.href)}
                          onMouseEnter={() => setSelectedIndex(overallIndex)}
                          className={cx(
                            "flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors",
                            isSelected
                              ? "bg-panel2 text-cream shadow-[inset_0_0_0_1px_rgba(217,171,94,.3)]"
                              : "hover:bg-panel text-mute"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Sparkles size={15} className={isSelected ? "text-gold" : "text-faint"} />
                            <div className="min-w-0">
                              <span className="font-medium text-[13.5px] text-cream">{action.label}</span>
                              {action.description && (
                                <p className="truncate text-[11.5px] text-faint">{action.description}</p>
                              )}
                            </div>
                          </div>
                          {isSelected && <CornerDownLeft size={13} className="text-gold shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Properties Section */}
              {results && results.properties.length > 0 && (
                <div className="mb-3">
                  <div className="px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.25em] text-gold font-semibold">
                    Properties
                  </div>
                  <div className="space-y-1">
                    {results.properties.map((property) => {
                      const overallIndex = allItems.findIndex((x) => x.item === property);
                      const isSelected = overallIndex === selectedIndex;
                      return (
                        <div
                          key={property.id}
                          onClick={() => property.url && navigateTo(property.url)}
                          onMouseEnter={() => setSelectedIndex(overallIndex)}
                          className={cx(
                            "flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors",
                            isSelected
                              ? "bg-panel2 text-cream shadow-[inset_0_0_0_1px_rgba(217,171,94,.3)]"
                              : "hover:bg-panel text-mute"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {property.cover ? (
                              <img
                                src={property.cover}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded-lg object-cover border border-line"
                              />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel2 text-gold">
                                <Building2 size={16} />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-[13.5px] text-cream truncate">
                                  {property.name}
                                </span>
                                {property.propertyType && (
                                  <span className="rounded bg-line/50 px-1.5 py-0.5 font-mono text-[9px] text-faint">
                                    {property.propertyType}
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-[11.5px] text-faint">
                                {property.location} {property.price ? `· ${property.price}` : ""}
                              </p>
                            </div>
                          </div>
                          {isSelected && <CornerDownLeft size={13} className="text-gold shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Campaigns Section */}
              {results && results.campaigns.length > 0 && (
                <div className="mb-3">
                  <div className="px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.25em] text-gold font-semibold">
                    Campaigns
                  </div>
                  <div className="space-y-1">
                    {results.campaigns.map((campaign) => {
                      const overallIndex = allItems.findIndex((x) => x.item === campaign);
                      const isSelected = overallIndex === selectedIndex;
                      return (
                        <div
                          key={campaign.id}
                          onClick={() => campaign.url && navigateTo(campaign.url)}
                          onMouseEnter={() => setSelectedIndex(overallIndex)}
                          className={cx(
                            "flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors",
                            isSelected
                              ? "bg-panel2 text-cream shadow-[inset_0_0_0_1px_rgba(217,171,94,.3)]"
                              : "hover:bg-panel text-mute"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel2 text-gold">
                              <Clapperboard size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-[13.5px] text-cream truncate">
                                  {campaign.name}
                                </span>
                                {campaign.presetLabel && (
                                  <span className="rounded bg-gold/15 px-1.5 py-0.5 font-mono text-[9px] text-gold font-medium">
                                    {campaign.presetLabel}
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-[11.5px] text-faint">
                                {campaign.propertyName || "Project campaign"} · Status: {campaign.status}
                              </p>
                            </div>
                          </div>
                          {isSelected && <CornerDownLeft size={13} className="text-gold shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Assets Section */}
              {results && results.assets.length > 0 && (
                <div className="mb-2">
                  <div className="px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.25em] text-gold font-semibold">
                    Ad Creatives &amp; Formats
                  </div>
                  <div className="space-y-1">
                    {results.assets.map((asset) => {
                      const overallIndex = allItems.findIndex((x) => x.item === asset);
                      const isSelected = overallIndex === selectedIndex;
                      return (
                        <div
                          key={asset.id}
                          onClick={() => asset.url && navigateTo(asset.url)}
                          onMouseEnter={() => setSelectedIndex(overallIndex)}
                          className={cx(
                            "flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors",
                            isSelected
                              ? "bg-panel2 text-cream shadow-[inset_0_0_0_1px_rgba(217,171,94,.3)]"
                              : "hover:bg-panel text-mute"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel2 text-faint">
                              <FileImage size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-[13.5px] text-cream truncate">
                                  {asset.title}
                                </span>
                                {asset.aspect && (
                                  <span className="rounded bg-line/60 px-1.5 py-0.5 font-mono text-[9px] text-gold">
                                    {asset.aspect}
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-[11.5px] text-faint">
                                Format: {asset.kind} · Platform: {asset.platform} {asset.score ? `· QC ${asset.score}` : ""}
                              </p>
                            </div>
                          </div>
                          {isSelected && <CornerDownLeft size={13} className="text-gold shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Bar */}
            <div className="flex items-center justify-between border-t border-line/70 px-4 py-2.5 bg-panel/50 text-[11px] text-faint">
              <span className="flex items-center gap-2">
                <span>Navigate:</span>
                <kbd className="rounded border border-line bg-ink/50 px-1.5 font-mono text-[10px]">↑</kbd>
                <kbd className="rounded border border-line bg-ink/50 px-1.5 font-mono text-[10px]">↓</kbd>
                <span className="ml-1">Select:</span>
                <kbd className="rounded border border-line bg-ink/50 px-1.5 font-mono text-[10px]">↵</kbd>
              </span>
              <span>Fast in-memory index · 0 DB egress</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

