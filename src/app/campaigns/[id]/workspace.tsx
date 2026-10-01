"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import { toJpeg, toPng } from "html-to-image";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Copy,
  Download,
  Expand,
  FileText,
  Gauge,
  Hash,
  LayoutGrid,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  ShieldCheck,
  Wand2,
  X,
} from "lucide-react";
import type { AssetPayload, Direction } from "@/lib/creative/engine";
import { KIND_LABELS, PLATFORMS, platformById, type BrandSettings } from "@/lib/creative/presets";
import { cx, ratioOf } from "@/lib/utils";
import { createRoot } from "react-dom/client";
import { AdCreative, AssetVisual } from "@/components/ad-creative";
import { PipelineOverlay } from "@/components/pipeline";
import { QualityPanel } from "@/components/quality";
import { Storyboard } from "@/components/storyboard";
import { Chip, DynIcon, SectionHead, StatusPill } from "@/components/ui";

type AssetLite = {
  id: string;
  kind: string;
  platform: string;
  aspect: string;
  title: string;
  payload: AssetPayload;
  score: number;
  checks: { label: string; pass: boolean }[];
  status: string;
  approved: boolean;
};

type ImageExportFormat = "png" | "jpeg";

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "creative";
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const bstr = atob(parts[1] || "");
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

async function ensureBase64DataUrl(url: string): Promise<string> {
  if (!url || url.startsWith("data:")) return url;

  const targetUrl = url.startsWith("/") ? `${window.location.origin}${url}` : url;

  // 1. Try direct fetch
  try {
    const res = await fetch(targetUrl, { mode: "cors" });
    if (res.ok) {
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch {}

  // 2. Try server-side proxy fetch (bypasses CORS restrictions & prevents canvas tainting)
  try {
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch {}

  // 3. Image element fallback
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 800;
        canvas.height = img.naturalHeight || img.height || 600;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        resolve(url);
      }
    };
    img.onerror = () => resolve(url);
    img.src = targetUrl;
  });
}

function getTargetDimensions(aspect: string): { width: number; height: number } {
  const norm = (aspect || "1:1").trim();
  if (norm === "9:16") return { width: 1080, height: 1920 };
  if (norm === "4:5") return { width: 1080, height: 1350 };
  if (norm === "16:9") return { width: 1920, height: 1080 };

  const [wRatio, hRatio] = norm.split(":").map(Number);
  const width = 1080;
  const height = Math.round((width * (hRatio || 1)) / (wRatio || 1));
  return { width, height };
}

function renderCanvasFallback(asset: AssetLite, format: ImageExportFormat): Promise<Blob> {
  return new Promise(async (resolve) => {
    const { width, height } = getTargetDimensions(asset.aspect);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(new Blob([], { type: format === "jpeg" ? "image/jpeg" : "image/png" }));
      return;
    }

    // 1. Dark base
    ctx.fillStyle = "#12100c";
    ctx.fillRect(0, 0, width, height);

    // 2. Draw property photo background
    const p = asset.payload;
    if (p.image) {
      try {
        const base64Url = await ensureBase64DataUrl(p.image);
        if (base64Url) {
          await new Promise<void>((resImg) => {
            const img = new Image();
            img.onload = () => {
              try {
                const imgW = img.naturalWidth || img.width || 800;
                const imgH = img.naturalHeight || img.height || 600;
                const scale = Math.max(width / imgW, height / imgH);
                const x = (width - imgW * scale) / 2;
                const y = (height - imgH * scale) / 2;
                ctx.drawImage(img, x, y, imgW * scale, imgH * scale);
              } catch {}
              resImg();
            };
            img.onerror = () => resImg();
            img.src = base64Url;
          });
        }
      } catch {}
    }

    // 3. Dual gradient scrims for high contrast and readability
    const topGradient = ctx.createLinearGradient(0, 0, 0, height * 0.45);
    topGradient.addColorStop(0, "rgba(8, 17, 14, 0.72)");
    topGradient.addColorStop(0.5, "rgba(8, 17, 14, 0.25)");
    topGradient.addColorStop(1, "rgba(8, 17, 14, 0)");
    ctx.fillStyle = topGradient;
    ctx.fillRect(0, 0, width, height * 0.45);

    const btmGradient = ctx.createLinearGradient(0, height * 0.38, 0, height);
    btmGradient.addColorStop(0, "rgba(4, 10, 7, 0)");
    btmGradient.addColorStop(0.5, "rgba(4, 10, 7, 0.65)");
    btmGradient.addColorStop(1, "rgba(4, 10, 7, 0.94)");
    ctx.fillStyle = btmGradient;
    ctx.fillRect(0, height * 0.38, width, height * 0.62);

    // 4. Overlays & Typography
    const margin = 54;
    const contentW = width - margin * 2;

    let topY = 70;
    if (p.kicker) {
      ctx.fillStyle = "#d9ab5e";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(p.kicker.toUpperCase(), margin, topY);
      topY += 42;
    }

    if (p.headline) {
      ctx.fillStyle = "#fffdf5";
      ctx.font = "500 52px serif";
      const words = p.headline.split(" ");
      let line = "";
      for (const w of words) {
        const test = line + (line ? " " : "") + w;
        if (ctx.measureText(test).width > contentW) {
          ctx.fillText(line, margin, topY);
          line = w;
          topY += 58;
        } else {
          line = test;
        }
      }
      if (line) {
        ctx.fillText(line, margin, topY);
        topY += 50;
      }
    }

    if (p.subline) {
      ctx.fillStyle = "rgba(244, 238, 225, 0.92)";
      ctx.font = "24px sans-serif";
      ctx.fillText(p.subline, margin, topY);
    }

    let btmY = height - 60;

    if (p.cta) {
      const ctaText = p.cta.toUpperCase() + "  →";
      ctx.font = "bold 22px sans-serif";
      const ctaW = ctx.measureText(ctaText).width + 48;
      const ctaH = 50;
      const ctaX = width - margin - ctaW;
      const ctaY = btmY - 38;

      ctx.fillStyle = "#d9ab5e";
      ctx.beginPath();
      ctx.roundRect(ctaX, ctaY, ctaW, ctaH, 25);
      ctx.fill();

      ctx.fillStyle = "#171208";
      ctx.fillText(ctaText, ctaX + 24, ctaY + 33);
    }

    if (p.priceLine) {
      ctx.fillStyle = "#fffdf5";
      ctx.font = "bold 38px serif";
      ctx.fillText(p.priceLine, margin, btmY);
      btmY -= 54;
    }

    if (p.locationLabel) {
      ctx.fillStyle = "rgba(244, 238, 225, 0.92)";
      ctx.font = "22px sans-serif";
      ctx.fillText("📍  " + p.locationLabel, margin, btmY);
      btmY -= 45;
    }

    const bullets = (p.bullets ?? []).slice(0, 3);
    if (bullets.length > 0 && btmY > topY + 80) {
      ctx.font = "18px sans-serif";
      let bulletX = margin;
      for (const bullet of bullets) {
        const bText = "• " + bullet;
        const bW = ctx.measureText(bText).width + 20;
        if (bulletX + bW < width - margin) {
          ctx.fillStyle = "rgba(244, 238, 225, 0.85)";
          ctx.fillText(bText, bulletX, btmY);
          bulletX += bW;
        }
      }
    }

    const mime = format === "jpeg" ? "image/jpeg" : "image/png";
    try {
      const dataUrl = canvas.toDataURL(mime, 0.94);
      resolve(dataUrlToBlob(dataUrl));
    } catch {
      resolve(new Blob([], { type: mime }));
    }
  });
}

async function renderAssetDOMToBlob(
  asset: AssetLite,
  brand: BrandSettings,
  format: ImageExportFormat
): Promise<Blob> {
  const { width: targetWidth, height: targetHeight } = getTargetDimensions(asset.aspect);

  // Dedicated offscreen container scaled at 100% target resolution
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = `${targetWidth}px`;
  container.style.height = `${targetHeight}px`;
  container.style.overflow = "hidden";
  container.style.zIndex = "-9999";
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    await new Promise<void>((resolve) => {
      root.render(
        <div style={{ width: `${targetWidth}px`, height: `${targetHeight}px`, position: "relative" }}>
          <AdCreative
            asset={asset}
            brand={brand}
            showScore={false}
            showGuides={false}
            className="w-full h-full"
          />
        </div>
      );
      setTimeout(resolve, 140);
    });

    const frame = container.querySelector<HTMLElement>(".adframe");
    if (!frame) throw new Error("Offscreen DOM frame missing");

    frame.style.width = `${targetWidth}px`;
    frame.style.height = `${targetHeight}px`;

    const imgs = Array.from(frame.querySelectorAll<HTMLImageElement>("img"));
    await Promise.all(
      imgs.map(async (img) => {
        if (img.src && !img.src.startsWith("data:")) {
          try {
            const base64 = await ensureBase64DataUrl(img.src);
            if (base64 && base64.startsWith("data:")) {
              img.src = base64;
              if ("decode" in img) {
                await img.decode().catch(() => {});
              }
            }
          } catch {}
        }
      })
    );

    await new Promise((r) => setTimeout(r, 100));

    const options = {
      width: targetWidth,
      height: targetHeight,
      canvasWidth: targetWidth,
      canvasHeight: targetHeight,
      cacheBust: false,
      skipFonts: true,
      filter: (node: Node) => {
        if (node instanceof HTMLElement && node.classList.contains("safe-guide")) return false;
        return true;
      },
    };

    frame.classList.add("ad-render-export");
    const dataUrl = format === "png"
      ? await toPng(frame, options)
      : await toJpeg(frame, { ...options, quality: 0.96 });

    const blob = dataUrlToBlob(dataUrl);
    if (blob.size >= 15000) return blob;

    console.warn("Offscreen DOM snapshot payload too small, executing canvas fallback");
    return await renderCanvasFallback(asset, format);
  } catch (err) {
    console.warn("DOM export pipeline executing canvas fallback:", err);
    return await renderCanvasFallback(asset, format);
  } finally {
    setTimeout(() => {
      try {
        root.unmount();
        container.remove();
      } catch {}
    }, 150);
  }
}

async function renderAssetFile(assetId: string, format: ImageExportFormat): Promise<Blob> {
  throw new Error("Use renderAssetDOMToBlob directly for complete preview rendering.");
}

async function persistAssetFile(assetId: string, format: ImageExportFormat, blob: Blob) {
  const body = new FormData();
  body.set("format", format);
  body.set("file", blob, `${assetId}.${format}`);
  const response = await fetch(`/api/assets/${assetId}/export`, { method: "POST", body });
  if (response.status === 501) return false;
  if (!response.ok) throw new Error("Could not save the rendered creative to local storage.");
  return true;
}

async function persistAssetFiles(exports: { assetId: string; format: ImageExportFormat; blob: Blob }[]) {
  if (!exports.length) return false;
  const body = new FormData();
  body.set("items", JSON.stringify(exports.map(({ assetId, format }) => ({ assetId, format }))));
  for (const { assetId, format, blob } of exports) body.append("files", blob, `${assetId}.${format}`);
  const response = await fetch("/api/assets/exports", { method: "POST", body });
  if (response.status === 501) return false;
  if (!response.ok) throw new Error("Could not save campaign images to local storage.");
  return true;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- preview modal ---------- */
function PreviewModal({
  assets,
  initialId,
  brand,
  onClose,
}: {
  assets: AssetLite[];
  initialId: string;
  brand: BrandSettings;
  onClose: () => void;
}) {
  const previewAssets = assets.filter((a) => a.kind !== "copy");
  const [currentId, setCurrentId] = useState(initialId);
  const current = previewAssets.find((a) => a.id === currentId) ?? previewAssets[0];
  const currentIdx = previewAssets.findIndex((a) => a.id === currentId);
  const backdropRef = useRef<HTMLDivElement>(null);

  /* zoom / pan state */
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const lastPointer = useRef({ x: 0, y: 0 });
  const pinchDist = useRef<number | null>(null);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const clampZoom = (v: number) => Math.min(5, Math.max(1, v));

  const prev = useCallback(() => {
    const idx = Math.max(0, currentIdx - 1);
    setCurrentId(previewAssets[idx].id);
    resetView();
  }, [currentIdx, previewAssets, resetView]);

  const next = useCallback(() => {
    const idx = Math.min(previewAssets.length - 1, currentIdx + 1);
    setCurrentId(previewAssets[idx].id);
    resetView();
  }, [currentIdx, previewAssets, resetView]);

  /* keyboard */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && !e.ctrlKey && !e.metaKey) prev();
      if (e.key === "ArrowRight" && !e.ctrlKey && !e.metaKey) next();
      if (e.key === "0" || e.key === "=" ) { e.preventDefault(); resetView(); }
      if (e.key === "+" || e.key === "=") { e.preventDefault(); setZoom((z) => clampZoom(z + 0.25)); }
      if (e.key === "-") { e.preventDefault(); setZoom((z) => clampZoom(z - 0.25)); }
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose, prev, next, resetView]);

  /* scroll-wheel zoom */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setZoom((z) => clampZoom(z + delta * z));
  }, []);

  /* mouse drag pan */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    dragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    lastPan.current = pan;
    e.preventDefault();
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    setPan({ x: lastPan.current.x + dx, y: lastPan.current.y + dy });
  }, []);

  const handleMouseUp = useCallback(() => { dragging.current = false; }, []);

  /* pinch-to-zoom */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDist.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1 && zoom > 1) {
      dragging.current = true;
      lastPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastPan.current = pan;
    }
  }, [zoom, pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && pinchDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchDist.current;
      pinchDist.current = dist;
      setZoom((z) => clampZoom(z * ratio));
    } else if (e.touches.length === 1 && dragging.current) {
      const dx = e.touches[0].clientX - lastPointer.current.x;
      const dy = e.touches[0].clientY - lastPointer.current.y;
      lastPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    dragging.current = false;
    pinchDist.current = null;
  }, []);

  if (!current) return null;

  const canPrev = currentIdx > 0;
  const canNext = currentIdx < previewAssets.length - 1;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex flex-col bg-ink/95 backdrop-blur-md"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      {/* ---- top bar ---- */}
      <div className="relative z-10 flex shrink-0 items-center justify-between gap-4 border-b border-line/60 bg-coal/80 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <DynIcon name={platformById(current.platform).icon} size={14} className="text-gold" />
          <span className="max-w-[260px] truncate text-[13px] font-medium">{current.title}</span>
          <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-faint">
            {KIND_LABELS[current.kind] ?? current.kind}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-faint">{current.aspect}</span>
          {current.approved && (
            <span className="flex items-center gap-1 rounded-full bg-sage/15 px-2 py-0.5 text-[10px] text-sage">
              <BadgeCheck size={11} /> Approved
            </span>
          )}
          <ScoreBadge score={current.score} />
        </div>

        <div className="flex items-center gap-2">
          {/* zoom controls */}
          <div className="flex items-center gap-1 rounded-lg border border-line bg-panel px-1 py-1">
            <button
              onClick={() => setZoom((z) => clampZoom(z - 0.25))}
              className="flex h-6 w-6 items-center justify-center rounded text-mute hover:text-gold"
              aria-label="Zoom out"
            >
              <span className="text-[14px] font-bold leading-none">−</span>
            </button>
            <button
              onClick={resetView}
              className="min-w-[48px] rounded px-1.5 py-0.5 font-mono text-[10px] text-mute hover:text-gold"
              title="Reset zoom (press 0)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => clampZoom(z + 0.25))}
              className="flex h-6 w-6 items-center justify-center rounded text-mute hover:text-gold"
              aria-label="Zoom in"
            >
              <span className="text-[14px] font-bold leading-none">+</span>
            </button>
          </div>

          {/* close */}
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-panel text-mute transition-all hover:border-gold/50 hover:text-gold"
            aria-label="Close preview"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ---- canvas area ---- */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: zoom > 1 ? (dragging.current ? "grabbing" : "grab") : "default" }}
      >
        {/* prev */}
        <button
          onClick={prev}
          disabled={!canPrev}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-panel/90 text-mute backdrop-blur transition-all hover:border-gold/50 hover:text-gold disabled:opacity-20"
          aria-label="Previous asset"
        >
          <ChevronLeft size={18} />
        </button>

        {/* next */}
        <button
          onClick={next}
          disabled={!canNext}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-panel/90 text-mute backdrop-blur transition-all hover:border-gold/50 hover:text-gold disabled:opacity-20"
          aria-label="Next asset"
        >
          <ChevronRight size={18} />
        </button>

        {/* zoomable creative — width is constrained so full ad always fits in viewport */}
        {(() => {
          const ratio = ratioOf(current.aspect); // e.g. 9:16 → 0.5625
          // width must satisfy: width/ratio ≤ availableHeight → width ≤ availableHeight × ratio
          const fitWidth = `calc((100vh - 120px) * ${ratio.toFixed(6)})`;
          return (
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
                transition: dragging.current ? "none" : "transform 0.12s ease-out",
                width: `min(88vw, 860px, ${fitWidth})`,
              }}
            >
              <AssetVisual
                asset={current}
                brand={brand}
                showScore={false}
                showGuides={false}
                className="w-full rounded-xl shadow-[0_40px_120px_-40px_rgba(0,0,0,.9)]"
              />
            </div>
          );
        })()}
      </div>

      {/* ---- bottom: pagination dots ---- */}
      {previewAssets.length > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-1.5 border-t border-line/60 bg-coal/80 py-3 backdrop-blur">
          {previewAssets.map((a, i) => (
            <button
              key={a.id}
              onClick={() => { setCurrentId(a.id); resetView(); }}
              className={cx(
                "h-1.5 rounded-full transition-all",
                a.id === currentId ? "w-5 bg-gold" : "w-1.5 bg-line hover:bg-mute"
              )}
              aria-label={`Go to asset ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CampaignWorkspace({
  fresh,
  brand,
  campaign,
  property,
  images,
  actions,
  assets,
}: {
  fresh: boolean;
  brand: BrandSettings;
  campaign: {
    id: string;
    name: string;
    preset: string;
    presetLabel: string;
    platforms: string[];
    status: string;
    options: Direction[];
    direction: Direction | null;
    model: string;
  };
  property: { id: string; name: string; location: string; propertyType: string; price: string };
  images: string[];
  actions: { id: string; kind: string; model: string; status: string; createdAt: string }[];
  assets: AssetLite[];
}) {
  const router = useRouter();
  const [revealed, setRevealed] = useState(!fresh);
  const [platFilter, setPlatFilter] = useState<string>("all");
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [selectedDir, setSelectedDir] = useState(0);
  const [genBusy, setGenBusy] = useState(false);
  const [packageBusy, setPackageBusy] = useState(false);
  const [exporting, setExporting] = useState("");
  const [exportError, setExportError] = useState("");
  const [copied, setCopied] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const avg = assets.length ? Math.round(assets.reduce((s, a) => s + a.score, 0) / assets.length) : 0;
  const readyCount = assets.filter((a) => a.status === "ready" || a.approved).length;
  const improving = assets.filter((a) => a.status === "improving").length;

  const visualAssets = assets.filter((a) => a.kind !== "copy");
  const reels = visualAssets.filter((a) => a.kind === "reel");
  const stills = visualAssets.filter((a) => a.kind !== "reel");
  const copyPack = assets.find((a) => a.kind === "copy");

  const filtered = platFilter === "all" ? stills : stills.filter((a) => a.platform === platFilter);

  const topAsset = useMemo(() => [...assets].sort((a, b) => b.score - a.score)[0], [assets]);
  const [selectedId, setSelectedId] = useState<string>(topAsset?.id ?? "");
  const selected = assets.find((a) => a.id === selectedId) ?? topAsset;

  const markBusy = (id: string, on: boolean) =>
    setBusy((s) => {
      const n = new Set(s);
      on ? n.add(id) : n.delete(id);
      return n;
    });

  const patchAsset = async (id: string, action: string) => {
    markBusy(id, true);
    await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    markBusy(id, false);
    router.refresh();
  };

  const generateDraft = async () => {
    setGenBusy(true);
    const res = await fetch(`/api/campaigns/${campaign.id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directionId: campaign.options[selectedDir]?.id }),
    });
    if (res.ok) router.push(`/campaigns/${campaign.id}?fresh=1`);
    setGenBusy(false);
  };

  const copyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(""), 1600);
  };

  const exportAsset = async (asset: AssetLite, format: ImageExportFormat) => {
    setExporting(`${asset.id}:${format}`);
    setExportError("");
    try {
      const blob = await renderAssetDOMToBlob(asset, brand, format);
      persistAssetFile(asset.id, format, blob).catch(() => false);
      downloadBlob(blob, `${safeFileName(asset.title)}-${asset.id.slice(0, 8)}.${format}`);
    } catch (error) {
      console.error("Single asset export failed:", error);
      setExportError(error instanceof Error ? error.message : "Creative export failed.");
    } finally {
      setExporting("");
    }
  };

  const downloadPackage = async () => {
    setPackageBusy(true);
    setExportError("");
    const previousFilter = platFilter;
    try {
      if (previousFilter !== "all") {
        setPlatFilter("all");
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const zip = new JSZip();
      const imageFiles = new Map<string, string>();
      const pendingExports: { assetId: string; format: ImageExportFormat; blob: Blob }[] = [];

      for (const [index, asset] of stills.entries()) {
        setExporting(`${index + 1}/${stills.length}`);
        let blob: Blob | null = null;
        try {
          blob = await renderAssetDOMToBlob(asset, brand, "png");
        } catch (err) {
          console.warn(`Could not render asset frame ${asset.id}, using Canvas fallback:`, err);
          blob = await renderCanvasFallback(asset, "png");
        }

        if (blob) {
          const fileName = `images/${safeFileName(asset.title)}-${asset.id.slice(0, 8)}.png`;
          zip.file(fileName, blob);
          imageFiles.set(asset.id, fileName);
          pendingExports.push({ assetId: asset.id, format: "png", blob });
        }
      }

      persistAssetFiles(pendingExports).catch(() => false);

      const storyboardFiles = reels.map((asset) => {
        const fileName = `storyboards/${safeFileName(asset.title)}-${asset.id.slice(0, 8)}.json`;
        zip.file(fileName, JSON.stringify({
          title: asset.title,
          platform: platformById(asset.platform).label,
          duration: asset.payload.durationBadge ?? null,
          music: asset.payload.music ?? null,
          shots: asset.payload.shots ?? [],
          note: "Storyboard only. No rendered video footage is available for this asset.",
        }, null, 2));
        return fileName;
      });

      const manifest = {
        product: "M & A — AI Real Estate Creative Studio",
        campaign: campaign.name,
        preset: campaign.presetLabel,
        property,
        brand: { name: brand.name, domain: brand.domain },
        platforms: campaign.platforms.map((platform) => platformById(platform).label),
        generatedAt: new Date().toISOString(),
        deliverables: assets.map((asset) => ({
          title: asset.title,
          kind: asset.kind,
          platform: asset.platform,
          aspect: asset.aspect,
          qcScore: asset.score,
          status: asset.approved ? "approved" : asset.status,
          image: asset.payload.image ?? null,
          imageFile: imageFiles.get(asset.id) ?? null,
          storyboardFile: storyboardFiles[reels.findIndex((reel) => reel.id === asset.id)] ?? null,
          copy: {
            kicker: asset.payload.kicker ?? null,
            headline: asset.payload.headline ?? null,
            cta: asset.payload.cta ?? null,
            priceLine: asset.payload.priceLine ?? null,
          },
          captions: asset.payload.captions ?? undefined,
          hashtags: asset.payload.hashtags ?? undefined,
          storyboard: asset.payload.shots ?? undefined,
        })),
      };
      zip.file("manifest.json", JSON.stringify(manifest, null, 2));

      const packageBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(packageBlob, `${safeFileName(property.name)}-campaign-package.zip`);
    } catch (error) {
      console.error("Campaign package export error:", error);
      setExportError(error instanceof Error ? error.message : "Campaign package export failed.");
    } finally {
      if (previousFilter !== "all") setPlatFilter(previousFilter);
      setPackageBusy(false);
      setExporting("");
    }
  };

  const deliverables: { label: string; count: number; present: boolean }[] = [
    { label: "Hero image", count: stills.filter((a) => a.kind === "hero").length, present: stills.some((a) => a.kind === "hero") },
    { label: "Social images", count: stills.filter((a) => ["feature", "location", "lifestyle"].includes(a.kind)).length, present: stills.some((a) => ["feature", "location", "lifestyle"].includes(a.kind)) },
    { label: "Story frames", count: stills.filter((a) => a.kind === "story").length, present: stills.some((a) => a.kind === "story") },
    { label: "Reel storyboard", count: reels.length, present: reels.length > 0 },
    { label: "Offer frames", count: stills.filter((a) => a.kind === "offer").length, present: stills.some((a) => a.kind === "offer") },
    { label: "Captions", count: copyPack?.payload.captions?.length ?? 0, present: Boolean(copyPack) },
    { label: "Hashtag set", count: copyPack?.payload.hashtags?.length ?? 0, present: Boolean(copyPack?.payload.hashtags?.length) },
    { label: "Platform variants", count: new Set(assets.map((a) => a.platform)).size, present: assets.length > 0 },
  ];

  /* ---------------- pipeline intro ---------------- */
  if (fresh && !revealed && assets.length > 0) {
    return (
      <div className="pt-8">
        <PipelineOverlay
          campaignName={campaign.name}
          assetCount={assets.length}
          platforms={campaign.platforms}
          onDone={() => setRevealed(true)}
        />
      </div>
    );
  }

  /* ---------------- draft: needs generation ---------------- */
  if (assets.length === 0) {
    return (
      <div className="mx-auto max-w-[1040px]">
        <Link href="/campaigns" className="mb-5 inline-flex items-center gap-2 text-[12.5px] text-faint hover:text-gold">
          <ArrowLeft size={14} /> Campaigns
        </Link>
        <div className="anim-up panel overflow-hidden">
          <div className="border-b border-line px-7 py-6">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill status="draft" />
              <Chip tone="gold">{campaign.presetLabel}</Chip>
            </div>
            <h1 className="font-display mt-3 text-[30px] font-medium leading-tight">{campaign.name}</h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-mute">
              <MapPin size={13} /> {property.name} · {property.location}
            </p>
          </div>
          <div className="px-7 py-6">
            <div className="label mb-3">Creative directions — pick one to generate</div>
            <div className="grid gap-3 sm:grid-cols-3">
              {campaign.options.map((d, i) => (
                <button key={d.id} onClick={() => setSelectedDir(i)} className={cx("sel-card rounded-xl p-4 text-left", selectedDir === i && "sel-on")}>
                  <div className="mb-2 h-16 w-full rounded-lg" style={{ background: `linear-gradient(135deg, ${d.hex[0]}, ${d.hex[2]} 140%)` }} />
                  <div className="font-display text-[15px]">{d.name}</div>
                  <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-faint">{d.tagline}</div>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end border-t border-line pt-5">
              <button onClick={generateDraft} disabled={genBusy} className="btn-gold flex items-center gap-2 rounded-xl px-6 py-3 text-[13.5px] font-semibold disabled:opacity-50">
                {genBusy ? <Loader2 size={15} className="spin-slow" /> : <Wand2 size={15} />}
                Generate full campaign
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- revealed workspace ---------------- */
  return (
    <>
      {previewId && (
        <PreviewModal
          assets={assets}
          initialId={previewId}
          brand={brand}
          onClose={() => setPreviewId(null)}
        />
      )}
      <div className="mx-auto max-w-[1360px]">
      <Link href="/campaigns" className="mb-5 inline-flex items-center gap-2 text-[12.5px] text-faint hover:text-gold">
        <ArrowLeft size={14} /> Campaigns
      </Link>

      {/* header */}
      <div className="anim-up panel mb-6 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-5 px-7 py-6">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <StatusPill status={campaign.status} />
              <Chip tone="gold">{campaign.presetLabel}</Chip>
              {campaign.direction && <Chip tone="mute">{campaign.direction.name}</Chip>}
            </div>
            <h1 className="font-display mt-3 text-[30px] font-medium leading-tight md:text-[36px]">{campaign.name}</h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-mute">
              <MapPin size={13} /> {property.name} · {property.location} · {property.price}
            </p>
            <div className="mt-3 flex gap-1.5">
              {campaign.platforms.map((pl) => (
                <span key={pl} title={platformById(pl).label} className="rounded-lg border border-line bg-panel2 p-2 text-mute">
                  <DynIcon name={platformById(pl).icon} size={13.5} />
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[9.5px] text-faint">
              <span className="inline-flex items-center gap-1.5"><Cpu size={12} className="text-gold" /> Model: {campaign.model}</span>
              {actions[0] && (
                <span>Last action: <time dateTime={actions[0].createdAt}>{new Date(actions[0].createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time></span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={downloadPackage} disabled={packageBusy} className="btn-gold flex items-center gap-2 rounded-xl px-5 py-3 text-[13px] font-semibold disabled:opacity-60">
              {packageBusy ? <Loader2 size={15} className="spin-slow" /> : <Package size={15} />}
              {packageBusy ? `Exporting ${exporting || "package"}` : "Download ZIP Package"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-line border-t border-line sm:grid-cols-4">
          {[
            { icon: LayoutGrid, label: "Deliverables", value: String(assets.length) },
            { icon: Gauge, label: "Avg QC score", value: String(avg) },
            { icon: BadgeCheck, label: "Ready to post", value: String(readyCount) },
            { icon: ShieldCheck, label: "Approved", value: String(assets.filter((a) => a.approved).length) },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 px-5 py-4">
              <s.icon size={16} className="text-gold" />
              <div>
                <div className="font-mono text-[18px]">{s.value}</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {improving > 0 && (
        <div className="anim-up mb-6 flex items-center gap-3 rounded-xl border border-rust/35 bg-rust/10 px-4 py-3 text-[12.5px] text-rust">
          <RefreshCw size={14} /> {improving} asset{improving > 1 ? "s are" : " is"} below your review threshold — use Regenerate to re-compose with a fresh variant.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.72fr_1fr]">
        {/* ------------- left: assets ------------- */}
        <div className="min-w-0 space-y-8">
          {/* reels */}
          {reels.length > 0 && (
            <section className="anim-up anim-d1">
              <SectionHead kicker="Motion" title="Reel — a story, not a moving image" />
              <div className="space-y-5">
                {reels.map((r) => (
                  <div key={r.id} className={cx(platFilter !== "all" && platFilter !== r.platform && "opacity-40")}>
                    <Storyboard
                      shots={r.payload.shots ?? []}
                      music={r.payload.music}
                      durationBadge={r.payload.durationBadge}
                      images={images}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
                      <Chip tone="gold">{platformById(r.platform).label}</Chip>
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                        Hook: “{r.payload.hook}”
                      </span>
                      <span className="ml-auto">
                        <ScoreBadge score={r.score} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* stills */}
          <section className="anim-up anim-d2">
            <SectionHead
              kicker="Visual system"
              title={`${stills.length} ad frames`}
              action={
                <div className="flex flex-wrap gap-1.5">
                  {["all", ...new Set(stills.map((a) => a.platform))].map((pl) => (
                    <button
                      key={pl}
                      onClick={() => setPlatFilter(pl)}
                      className={cx(
                        "rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-all",
                        platFilter === pl ? "border-gold/60 bg-gold/10 text-gold" : "border-line text-faint hover:text-mute"
                      )}
                    >
                      {pl === "all" ? "All" : platformById(pl).short}
                    </button>
                  ))}
                </div>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((a) => (
                <div key={a.id} className={cx("panel panel-hover overflow-hidden", selectedId === a.id && "border-gold/50")}>
                  <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <DynIcon name={platformById(a.platform).icon} size={13} className="text-gold" />
                      <span className="text-[12px] font-medium">{KIND_LABELS[a.kind] ?? a.kind}</span>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-faint">{a.aspect}</span>
                      {a.payload.imageSource === "ai-generated" && (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-widest text-gold">AI Photo</span>
                      )}
                    </div>
                    <ScoreBadge score={a.score} />
                  </div>
                  <button onClick={() => setSelectedId(a.id)} data-export-frame={a.id} className="block w-full text-left">
                    <AssetVisual asset={a} brand={brand} />
                  </button>
                  <div className="flex items-center gap-1.5 border-t border-line px-3 py-2.5">
                    {/* preview */}
                    <button
                      onClick={() => setPreviewId(a.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-mute transition-all hover:border-gold/50 hover:text-gold"
                      title="Open full-size preview"
                    >
                      <Expand size={13} /> Preview
                    </button>
                    <button
                      onClick={() => patchAsset(a.id, a.approved ? "unapprove" : "approve")}
                      disabled={busy.has(a.id)}
                      className={cx(
                        "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] transition-all",
                        a.approved ? "bg-sage/15 text-sage" : "border border-line text-mute hover:border-sage/50 hover:text-sage"
                      )}
                    >
                      <BadgeCheck size={13} /> {a.approved ? "Approved" : "Approve"}
                    </button>
                    <button
                      onClick={() => patchAsset(a.id, "regenerate")}
                      disabled={busy.has(a.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-mute transition-all hover:border-gold/50 hover:text-gold"
                    >
                      {busy.has(a.id) ? <Loader2 size={13} className="spin-slow" /> : <RefreshCw size={13} />} Regenerate
                    </button>
                    <div className="ml-auto flex items-center gap-1">
                      {(["png", "jpeg"] as const).map((format) => (
                        <button
                          key={format}
                          onClick={() => exportAsset(a, format)}
                          disabled={Boolean(exporting) || packageBusy}
                          title={`Render and download ${format === "jpeg" ? "JPEG" : "PNG"}`}
                          className="flex items-center gap-1 rounded-lg border border-line px-2 py-1.5 text-[10px] text-mute transition-all hover:border-gold/50 hover:text-gold disabled:opacity-50"
                        >
                          {exporting === `${a.id}:${format}` ? <Loader2 size={12} className="spin-slow" /> : <Download size={12} />}
                          {format === "jpeg" ? "JPEG" : "PNG"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(a.payload.imageGenPrompt || a.payload.imagePrompt) && (
                    <details className="border-t border-line px-3 py-2.5">
                      <summary className="cursor-pointer text-[10.5px] text-mute">
                        {a.payload.imageSource === "ai-generated" ? "AI image generation prompt" : "AI photography direction"}
                      </summary>
                      <p className="mt-2 text-[11px] leading-relaxed text-faint">{a.payload.imageGenPrompt ?? a.payload.imagePrompt}</p>
                      {a.payload.imageQualityScore !== undefined && (
                        <p className="mt-1 font-mono text-[9px] text-gold">Image quality score: {a.payload.imageQualityScore}</p>
                      )}
                    </details>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* copy pack */}
          {copyPack && (
            <section className="anim-up anim-d3">
              <SectionHead kicker="Words" title="Captions, hashtags & CTA" />
              <div className="grid gap-4 sm:grid-cols-2">
                {(copyPack.payload.captions ?? []).map((c) => (
                  <div key={c.platform} className="panel p-4.5 p-5">
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">{c.label}</span>
                      <button onClick={() => copyText(c.platform, c.text)} className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-[10.5px] text-mute hover:border-gold/50 hover:text-gold">
                        {copied === c.platform ? <Check size={11.5} className="text-sage" /> : <Copy size={11.5} />} Copy
                      </button>
                    </div>
                    <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-cream/85">{c.text}</p>
                  </div>
                ))}
                <div className="panel p-5">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-gold"><Hash size={12} /> Hashtags</span>
                    <button onClick={() => copyText("tags", (copyPack.payload.hashtags ?? []).join(" "))} className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-[10.5px] text-mute hover:border-gold/50 hover:text-gold">
                      {copied === "tags" ? <Check size={11.5} className="text-sage" /> : <Copy size={11.5} />} Copy all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(copyPack.payload.hashtags ?? []).map((t) => (
                      <span key={t} className="rounded-full border border-line bg-panel2 px-2.5 py-1 font-mono text-[10.5px] text-mute">{t}</span>
                    ))}
                  </div>
                  <div className="mt-4 border-t border-line pt-3.5">
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-gold"><FileText size={12} /> Primary CTA</span>
                    <p className="mt-2 font-display text-[18px]">“{copyPack.payload.cta}”</p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* ------------- right rail ------------- */}
        <div className="min-w-0 space-y-5">
          {selected && (
            <div className="anim-up anim-d2">
              <QualityPanel
                score={selected.score}
                checks={selected.checks}
                status={selected.approved ? "approved" : selected.status}
                thresholds={brand.thresholds}
              />
              <div className="mt-2 px-2 text-center font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
                Showing QC for: {selected.title}
              </div>
            </div>
          )}

          <div className="anim-up anim-d3 panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-5 py-4 font-mono text-[10px] uppercase tracking-[0.26em] text-mute">
              <Package size={13} className="text-gold" /> Ready-to-post package
            </div>
            <div className="divide-y divide-line/60">
              {deliverables.map((d, i) => (
                <div key={d.label} className="flex items-center justify-between px-5 py-2.5">
                  <span className="flex items-center gap-3 text-[12.5px]">
                    <span className="font-mono text-[10px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                    {d.label}
                  </span>
                  {d.present ? (
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-sage">
                      <Check size={11.5} strokeWidth={3} /> {d.count} ×
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-faint">—</span>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-line p-4">
              <button onClick={downloadPackage} disabled={packageBusy} className="btn-gold flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-semibold disabled:opacity-60">
                {packageBusy ? <Loader2 size={14} className="spin-slow" /> : <Download size={14} />}
                {packageBusy ? `Rendering ${exporting || "package"}` : "Download Campaign ZIP"}
              </button>
              <p className="mt-2 text-center font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
                PNG frames · manifest · reel storyboards
              </p>
              {exportError && <p role="alert" className="mt-2 text-center text-[11px] text-rust">{exportError}</p>}
            </div>
          </div>

          <div className="anim-up anim-d4 panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-5 py-4 font-mono text-[10px] uppercase tracking-[0.26em] text-mute">
              <Cpu size={13} className="text-gold" /> Action history
            </div>
            {actions.length ? (
              <div className="divide-y divide-line/60">
                {actions.map((action) => (
                  <div key={action.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-[11.5px] capitalize text-cream/85">{action.kind.replaceAll("-", " ")}</div>
                      <div className="mt-0.5 truncate font-mono text-[9px] text-faint">{action.model} · {action.status}</div>
                    </div>
                    <time dateTime={action.createdAt} className="shrink-0 whitespace-nowrap font-mono text-[9px] text-mute">
                      {new Date(action.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                  </div>
                ))}
              </div>
            ) : <p className="px-4 py-4 text-[11px] text-faint">No campaign actions recorded yet.</p>}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 95 ? "text-sage border-sage/40" : score >= 80 ? "text-warn border-warn/40" : "text-rust border-rust/40";
  return (
    <span className={cx("rounded-full border px-2 py-0.5 font-mono text-[10px]", tone)}>QC {score}</span>
  );
}
