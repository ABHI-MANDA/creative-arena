import * as fabric from "fabric";

// Register custom metadata property for Fabric v7 serialization
(fabric.FabricObject as unknown as { customProperties?: string[] }).customProperties = ["meta"];

import type { AssetPayload } from "@/lib/creative/engine";
import type { BrandSettings } from "@/lib/creative/presets";

export type FontOption = {
  name: string;
  family: string;
  category: "Modern" | "Luxury" | "Corporate" | "Minimal" | "Elegant" | "Bold";
};

export const FONT_LIBRARY: FontOption[] = [
  { name: "Inter", family: "Inter, sans-serif", category: "Modern" },
  { name: "Roboto", family: "Roboto, sans-serif", category: "Modern" },
  { name: "Poppins", family: "Poppins, sans-serif", category: "Modern" },
  { name: "Montserrat", family: "Montserrat, sans-serif", category: "Bold" },
  { name: "Open Sans", family: "'Open Sans', sans-serif", category: "Minimal" },
  { name: "Lato", family: "Lato, sans-serif", category: "Corporate" },
  { name: "Oswald", family: "Oswald, sans-serif", category: "Bold" },
  { name: "Playfair Display", family: "'Playfair Display', serif", category: "Luxury" },
  { name: "Bebas Neue", family: "'Bebas Neue', sans-serif", category: "Elegant" },
];

export type ObjectMeta = {
  id: string;
  name: string;
  editable: boolean;
  locked: boolean;
  deletable: boolean;
  visible: boolean;
  category: "text" | "image" | "shape" | "brand" | "background";
  aiGenerated: boolean;
  userModified?: boolean;
};

export function getCanvasDimensions(aspect: string): { width: number; height: number } {
  const norm = (aspect || "1:1").trim();
  if (norm === "9:16") return { width: 1080, height: 1920 };
  if (norm === "4:5") return { width: 1080, height: 1350 };
  if (norm === "16:9") return { width: 1920, height: 1080 };

  const [wRatio, hRatio] = norm.split(":").map(Number);
  const width = 1080;
  const height = Math.round((width * (hRatio || 1)) / (wRatio || 1));
  return { width, height };
}

function calcTextHeight(text: string, fontSize: number, boxWidth: number): number {
  if (!text) return 0;
  const charsPerLine = Math.max(1, Math.floor(boxWidth / (fontSize * 0.52)));
  const lines = text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return lines * fontSize * 1.2;
}

/**
 * Adds editable Fabric objects on top of the locked base image.
 * Positions are calculated from cqw units: 1 cqw = W/100 px where W is canvas width.
 * Objects are transparent-background so they sit invisibly over the base until selected.
 * On export the canvas renders both the locked base + these editable objects.
 */
export function populateEditableOverlays(
  canvas: fabric.Canvas,
  payload: AssetPayload,
  brand: BrandSettings,
  aspect: string,
  kind: string = "hero",
  platform: string = "instagram"
) {
  const { width: W, height: H } = getCanvasDimensions(aspect);
  const cqw = W / 100; // 1 container-query width unit in pixels

  const meta = (
    id: string,
    name: string,
    category: ObjectMeta["category"] = "text"
  ): ObjectMeta => ({
    id,
    name,
    editable: true,
    locked: false,
    deletable: true,
    visible: true,
    category,
    aiGenerated: true,
  });

  const addText = (
    text: string,
    opts: Partial<fabric.TextboxProps> & { metaId: string; metaName: string }
  ) => {
    const { metaId, metaName, ...rest } = opts;
    const tb = new fabric.Textbox(text, {
      ...rest,
      // Transparent bg so the locked base shows through; edit handles appear on click
      backgroundColor: "transparent",
      padding: 4,
    });
    (tb as unknown as { meta: ObjectMeta }).meta = meta(metaId, metaName);
    canvas.add(tb);
    return tb;
  };

  const isWide = kind !== "hero" && (
    payload.layout === "wide" ||
    ["linkedin", "portal"].includes(platform) ||
    aspect === "16:9"
  );

  // ─────────────────────────────────────────────────────────────
  // HERO / POSTER LAYOUT  (PosterBody in ad-creative.tsx)
  // ─────────────────────────────────────────────────────────────
  if (kind === "hero") {
    const pad = 4.8 * cqw;
    const innerW = W - 2 * pad;
    let topY = pad + 2 * cqw;

    // Kicker  — ad-poster-kicker:  font-size: 2.05cqw, letter-spacing: 0.22em
    if (payload.kicker) {
      const fs = 2.05 * cqw;
      addText(payload.kicker.toUpperCase(), {
        metaId: "text-kicker",
        metaName: "Kicker / Tag",
        left: W / 2,
        top: topY,
        originX: "center",
        width: innerW,
        textAlign: "center",
        fontSize: fs,
        fontFamily: "monospace",
        fontWeight: "bold",
        fill: "#f1d49a",
        charSpacing: 220,
      });
      topY += calcTextHeight(payload.kicker, fs, innerW) + 1.4 * cqw;
    }

    // Headline — ad-poster-title: font-size: 8.2cqw, uppercase, Playfair
    if (payload.headline) {
      const fs = 8.2 * cqw;
      addText(payload.headline.toUpperCase(), {
        metaId: "text-headline",
        metaName: "Headline",
        left: W / 2,
        top: topY,
        originX: "center",
        width: innerW * 0.96,
        textAlign: "center",
        fontSize: fs,
        fontFamily: "'Playfair Display', serif",
        fontWeight: "normal",
        fill: "#fffdf5",
        lineHeight: 1.0,
      });
      topY += calcTextHeight(payload.headline, fs, innerW * 0.96) + 2 * cqw;
    }

    // Subline — ad-poster-type: font-size: 3.05cqw, bold
    if (payload.subline) {
      const fs = 3.05 * cqw;
      addText(payload.subline, {
        metaId: "text-subline",
        metaName: "Subline / Property Type",
        left: W / 2,
        top: topY,
        originX: "center",
        width: innerW * 0.9,
        textAlign: "center",
        fontSize: fs,
        fontFamily: "Inter, sans-serif",
        fontWeight: "600",
        fill: "rgba(255,253,245,0.96)",
      });
      topY += calcTextHeight(payload.subline, fs, innerW * 0.9) + 1.2 * cqw;
    }

    // Fine/Tagline — ad-poster-tagline: 2.15cqw
    if (payload.fine) {
      const fs = 2.15 * cqw;
      addText(payload.fine, {
        metaId: "text-fine",
        metaName: "Tagline",
        left: W / 2,
        top: topY,
        originX: "center",
        width: innerW * 0.84,
        textAlign: "center",
        fontSize: fs,
        fontFamily: "Inter, sans-serif",
        fill: "rgba(255,253,245,0.9)",
      });
    }

    // Benefits pills — ad-poster-benefits: font-size: 1.95cqw; bottom area
    const bullets = (payload.bullets ?? []).slice(0, 3);
    if (bullets.length > 0) {
      // The bottom card is ~230px above bottom; benefits are above the card
      const benefitsY = H - 295;
      const chipH = 1.95 * cqw * 2.4;
      const totalW = bullets.reduce((s, b) => s + (b.length * 1.95 * cqw * 0.6 + 3.4 * cqw), 0)
        + (bullets.length - 1) * 1.2 * cqw;
      let bx = Math.max(pad, (W - totalW) / 2);

      bullets.forEach((b, idx) => {
        const cWidth = b.length * 1.95 * cqw * 0.6 + 3.4 * cqw;
        // Pill background (editable shape)
        const chipBg = new fabric.Rect({
          left: bx,
          top: benefitsY,
          width: cWidth,
          height: chipH,
          rx: chipH / 2,
          ry: chipH / 2,
          fill: "rgba(8,18,13,0.56)",
          stroke: "rgba(255,255,255,0.34)",
          strokeWidth: 1,
          backgroundColor: "transparent",
        });
        (chipBg as unknown as { meta: ObjectMeta }).meta = meta(
          `chip-bg-${idx}`,
          `Benefit Chip ${idx + 1}`,
          "shape"
        );
        canvas.add(chipBg);

        addText(b, {
          metaId: `text-chip-${idx}`,
          metaName: `Benefit ${idx + 1}`,
          left: bx + cWidth / 2,
          top: benefitsY + chipH / 2 - (1.95 * cqw) / 2,
          originX: "center",
          width: cWidth,
          textAlign: "center",
          fontSize: 1.95 * cqw,
          fontFamily: "Inter, sans-serif",
          fill: "rgba(255,253,245,0.96)",
        });
        bx += cWidth + 1.2 * cqw;
      });
    }

    // Bottom Details Card
    const cardM = pad;
    const cardW = W - 2 * cardM;
    const cardH = 2.2 * cqw * 2 + 5.5 * cqw + 2.3 * cqw + 3.8 * cqw + 2 * pad; // approx
    const cardTop = H - cardH - cardM;

    // Card background
    const cardBg = new fabric.Rect({
      left: cardM,
      top: cardTop,
      width: cardW,
      height: cardH,
      rx: 1.8 * cqw,
      ry: 1.8 * cqw,
      fill: "rgba(7,20,14,0.84)",
      stroke: "rgba(233,204,147,0.66)",
      strokeWidth: 1,
      backgroundColor: "transparent",
    });
    (cardBg as unknown as { meta: ObjectMeta }).meta = meta("card-bg", "Details Card", "shape");
    canvas.add(cardBg);

    // Location — 2.3cqw, centered inside card
    if (payload.locationLabel) {
      addText(`📍  ${payload.locationLabel}`, {
        metaId: "text-location",
        metaName: "Location",
        left: cardM + cardW / 2,
        top: cardTop + 2.2 * cqw,
        originX: "center",
        width: cardW - 2 * pad,
        textAlign: "center",
        fontSize: 2.3 * cqw,
        fontFamily: "Inter, sans-serif",
        fill: "rgba(255,253,245,0.96)",
      });
    }

    // Price — ad-poster-price: 3.8cqw, Playfair
    if (payload.priceLine) {
      addText(payload.priceLine, {
        metaId: "text-price",
        metaName: "Price",
        left: cardM + 2.6 * cqw,
        top: cardTop + 2.3 * cqw + 4.5 * cqw,
        width: cardW * 0.48,
        fontSize: 3.8 * cqw,
        fontFamily: "'Playfair Display', serif",
        fontWeight: "500",
        fill: "#fffdf5",
      });
    }

    // CTA pill — white background pill, dark text
    if (payload.cta) {
      const ctaFs = 2.6 * cqw;
      const ctaW = payload.cta.length * ctaFs * 0.62 + 6.8 * cqw;
      const ctaH = ctaFs + 3.1 * cqw;
      const ctaLeft = cardM + cardW - ctaW - 2 * cqw;
      const ctaTop = cardTop + 2.3 * cqw + 3.5 * cqw;

      const ctaBg = new fabric.Rect({
        left: ctaLeft,
        top: ctaTop,
        width: ctaW,
        height: ctaH,
        rx: ctaH / 2,
        ry: ctaH / 2,
        fill: "rgba(255,254,248,0.9)",
        stroke: "rgba(255,255,255,0.6)",
        strokeWidth: 1,
        backgroundColor: "transparent",
      });
      (ctaBg as unknown as { meta: ObjectMeta }).meta = meta("cta-bg", "CTA Button", "shape");
      canvas.add(ctaBg);

      addText(`${payload.cta.toUpperCase()}  ↗`, {
        metaId: "text-cta",
        metaName: "CTA Text",
        left: ctaLeft + ctaW / 2,
        top: ctaTop + ctaH / 2 - ctaFs / 2,
        originX: "center",
        width: ctaW,
        textAlign: "center",
        fontSize: ctaFs,
        fontFamily: "Inter, sans-serif",
        fontWeight: "bold",
        fill: "#17251b",
      });
    }

    // Brand footer
    if (brand?.domain) {
      addText(brand.domain.toLowerCase(), {
        metaId: "text-brand",
        metaName: "Brand Domain",
        category: "brand",
        left: pad,
        top: H - 2 * cqw - 1.5 * cqw,
        width: W * 0.5,
        fontSize: 2 * cqw,
        fontFamily: "Inter, sans-serif",
        fill: "rgba(244,238,225,0.62)",
      } as Parameters<typeof addText>[1]);

      addText("THE RESIDENCES", {
        metaId: "text-residences",
        metaName: "Residences Tag",
        left: W - pad,
        top: H - 2 * cqw - 1.5 * cqw,
        originX: "right",
        width: W * 0.5,
        textAlign: "right",
        fontSize: 2 * cqw,
        fontFamily: "Inter, sans-serif",
        fontWeight: "bold",
        fill: "rgba(244,238,225,0.62)",
        charSpacing: 180,
      });
    }

    return;
  }

  // ─────────────────────────────────────────────────────────────
  // WIDE SPLIT LAYOUT (linkedin / portal / 16:9)
  // ─────────────────────────────────────────────────────────────
  if (isWide) {
    const panelW = Math.round(W * 0.46);
    const lm = 2.6 * cqw;
    const innerW = panelW - 2 * lm;
    let topY = 1.4 * cqw;

    if (payload.kicker) {
      const fs = 1.5 * cqw;
      addText(payload.kicker.toUpperCase(), {
        metaId: "text-kicker", metaName: "Kicker",
        left: lm, top: topY, width: innerW,
        fontSize: fs, fontFamily: "monospace", fontWeight: "bold",
        fill: "#d9ab5e", charSpacing: 320,
      });
      topY += calcTextHeight(payload.kicker, fs, innerW) + 1 * cqw;
    }
    if (payload.headline) {
      const fs = 4.7 * cqw;
      addText(payload.headline, {
        metaId: "text-headline", metaName: "Headline",
        left: lm, top: topY, width: innerW,
        fontSize: fs, fontFamily: "'Playfair Display', serif",
        fill: "#fffdf5", lineHeight: 1.06,
      });
      topY += calcTextHeight(payload.headline, fs, innerW) + 1 * cqw;
    }
    if (payload.subline) {
      const fs = 2.05 * cqw;
      addText(payload.subline, {
        metaId: "text-subline", metaName: "Subline",
        left: lm, top: topY, width: innerW,
        fontSize: fs, fontFamily: "Inter, sans-serif",
        fill: "rgba(244,238,225,0.85)",
      });
      topY += calcTextHeight(payload.subline, fs, innerW) + 1 * cqw;
    }
    (payload.bullets ?? []).slice(0, 3).forEach((b, i) => {
      const fs = 1.75 * cqw;
      addText(`•  ${b}`, {
        metaId: `text-bullet-${i}`, metaName: `Bullet ${i + 1}`,
        left: lm, top: topY, width: innerW,
        fontSize: fs, fontFamily: "Inter, sans-serif",
        fill: "rgba(244,238,225,0.9)",
      });
      topY += calcTextHeight(`•  ${b}`, fs, innerW) + 0.7 * cqw;
    });
    if (payload.priceLine) {
      const fs = 3.1 * cqw;
      addText(payload.priceLine, {
        metaId: "text-price", metaName: "Price",
        left: lm, top: H - 5 * cqw, width: innerW * 0.7,
        fontSize: fs, fontFamily: "'Playfair Display', serif",
        fill: "#ecd9ac",
      });
    }
    if (payload.cta) {
      const fs = 1.7 * cqw;
      const ctaW = Math.min(panelW * 0.7, payload.cta.length * fs * 0.65 + 4 * cqw);
      const ctaBg = new fabric.Rect({
        left: lm, top: H - 3.5 * cqw - fs - 2 * cqw,
        width: ctaW, height: fs + 2.2 * cqw,
        rx: (fs + 2.2 * cqw) / 2, ry: (fs + 2.2 * cqw) / 2,
        fill: "#d9ab5e", backgroundColor: "transparent",
      });
      (ctaBg as unknown as { meta: ObjectMeta }).meta = meta("cta-bg", "CTA Button", "shape");
      canvas.add(ctaBg);
      addText(`${payload.cta.toUpperCase()}  →`, {
        metaId: "text-cta", metaName: "CTA Text",
        left: lm + ctaW / 2, top: H - 3.5 * cqw - fs - 2 * cqw + 1.1 * cqw,
        originX: "center", width: ctaW, textAlign: "center",
        fontSize: fs, fontFamily: "Inter, sans-serif",
        fontWeight: "bold", fill: "#171208",
      });
    }
    if (brand?.domain) {
      addText(brand.domain.toLowerCase(), {
        metaId: "text-brand", metaName: "Brand Domain",
        left: W - 1.6 * cqw, top: H - 1.4 * cqw - 1.4 * cqw,
        originX: "right", width: W * 0.4,
        textAlign: "right", fontSize: 1.4 * cqw,
        fontFamily: "Inter, sans-serif",
        fill: "rgba(244,238,225,0.6)",
      });
    }
    return;
  }

  // ─────────────────────────────────────────────────────────────
  // STANDARD OVERLAY LAYOUT (feature / location / story / offer / lifestyle / reel)
  // ─────────────────────────────────────────────────────────────
  const pad = 4.6 * cqw;
  const innerW = W - 2 * pad;
  let topY = pad + 1.5 * cqw;

  // Kicker
  if (payload.kicker) {
    const fs = kind === "offer" ? 2 * cqw : 2.15 * cqw;
    addText(kind === "offer" ? payload.kicker : payload.kicker.toUpperCase(), {
      metaId: "text-kicker", metaName: "Kicker",
      left: pad, top: topY, width: innerW,
      fontSize: fs, fontFamily: kind === "offer" ? "monospace" : "monospace",
      fontWeight: "bold",
      fill: kind === "offer" ? "#171208" : "#d9ab5e",
      charSpacing: kind === "offer" ? 240 : 340,
    });
    topY += calcTextHeight(payload.kicker, fs, innerW) + 1.6 * cqw;
  }

  // Headline / Hook
  const headText = payload.headline || payload.hook;
  if (headText) {
    const fs = kind === "offer" ? 6.4 * cqw : 8.6 * cqw;
    addText(headText, {
      metaId: "text-headline", metaName: "Headline",
      left: pad, top: topY, width: innerW,
      fontSize: fs,
      fontFamily: (kind === "lifestyle" || kind === "reel") ? "'Playfair Display', serif" : "'Playfair Display', serif",
      fontWeight: "normal",
      fill: "#fffdf5",
      lineHeight: 1.04,
    });
    topY += calcTextHeight(headText, fs, innerW) + 1.6 * cqw;
  }

  // Subline
  if (payload.subline && (kind === "hero" || kind === "story" || kind === "lifestyle")) {
    const fs = 3.1 * cqw;
    addText(payload.subline, {
      metaId: "text-subline", metaName: "Subline",
      left: pad, top: topY, width: innerW * 0.8,
      fontSize: fs, fontFamily: "Inter, sans-serif",
      fill: "rgba(244,238,225,0.86)",
    });
    topY += calcTextHeight(payload.subline, fs, innerW * 0.8) + 1.4 * cqw;
  }

  // Feature chips
  if (kind === "feature") {
    (payload.bullets ?? []).slice(0, 4).forEach((b, idx) => {
      const chipW = (innerW - 1.4 * cqw) / 2;
      const colIdx = idx % 2;
      const rowIdx = Math.floor(idx / 2);
      const cLeft = pad + colIdx * (chipW + 1.4 * cqw);
      const cTop = topY + rowIdx * (2.5 * cqw * 2 + 1.4 * cqw);
      const chipBg = new fabric.Rect({
        left: cLeft, top: cTop,
        width: chipW, height: 2.5 * cqw * 2,
        rx: 1 * cqw, ry: 1 * cqw,
        fill: "rgba(11,10,8,0.34)",
        stroke: "rgba(244,238,225,.22)", strokeWidth: 1,
        backgroundColor: "transparent",
      });
      (chipBg as unknown as { meta: ObjectMeta }).meta = meta(`chip-bg-${idx}`, `Feature Chip ${idx + 1}`, "shape");
      canvas.add(chipBg);
      addText(`●  ${b}`, {
        metaId: `text-chip-${idx}`, metaName: `Feature ${idx + 1}`,
        left: cLeft + 1.2 * cqw, top: cTop + 1.3 * cqw,
        width: chipW - 1.8 * cqw, fontSize: 2.5 * cqw,
        fontFamily: "Inter, sans-serif", fill: "#fffdf5",
      });
    });
  }

  // Location rows
  if (kind === "location") {
    (payload.rows ?? []).slice(0, 4).forEach((r, i) => {
      const fs = 2.9 * cqw;
      addText(
        `${r.label}${r.mins !== undefined ? `   ${r.mins} MIN` : ""}`,
        {
          metaId: `text-row-${i}`, metaName: `Location Row ${i + 1}`,
          left: pad, top: topY, width: innerW,
          fontSize: fs, fontFamily: "Inter, sans-serif",
          fill: "rgba(244,238,225,0.92)",
        }
      );
      topY += fs * 1.15 + 2.3 * cqw;
    });
  }

  // Offer price
  if (kind === "offer" && payload.priceLine) {
    const fs = 5.4 * cqw;
    addText(payload.priceLine, {
      metaId: "text-price", metaName: "Price",
      left: pad, top: topY, width: innerW,
      fontSize: fs, fontFamily: "'Playfair Display', serif",
      fontWeight: "500", fill: "#ecd9ac",
    });
    topY += fs * 1.2 + 1.6 * cqw;
  }

  // Bottom section: location label, non-offer price, CTA
  let btmY = H - pad - 1.6 * cqw;

  if (brand?.domain) {
    addText(brand.domain.toLowerCase(), {
      metaId: "text-brand", metaName: "Brand Domain",
      left: pad, top: btmY, width: innerW * 0.6,
      fontSize: 2 * cqw, fontFamily: "Inter, sans-serif",
      fill: "rgba(244,238,225,0.62)",
    });
    btmY -= 2 * cqw * 1.4 + 1.8 * cqw;
  }

  if (payload.cta && kind !== "reel") {
    const fs = 2.6 * cqw;
    const ctaH = fs + 3 * cqw;
    const ctaW = payload.cta.length * fs * 0.64 + 6.8 * cqw;

    const ctaBg = new fabric.Rect({
      left: pad, top: btmY - ctaH + fs * 0.5,
      width: ctaW, height: ctaH,
      rx: ctaH / 2, ry: ctaH / 2,
      fill: "rgba(236,201,103,0.9)",
      backgroundColor: "transparent",
    });
    (ctaBg as unknown as { meta: ObjectMeta }).meta = meta("cta-bg", "CTA Button", "shape");
    canvas.add(ctaBg);
    addText(`${payload.cta.toUpperCase()}  →`, {
      metaId: "text-cta", metaName: "CTA Text",
      left: pad + ctaW / 2, top: btmY - ctaH + fs * 0.5 + ctaH / 2 - fs / 2,
      originX: "center", width: ctaW, textAlign: "center",
      fontSize: fs, fontFamily: "Inter, sans-serif",
      fontWeight: "bold", fill: "#171208",
    });

    if ((kind === "hero" || kind === "story") && payload.priceLine) {
      addText(payload.priceLine, {
        metaId: "text-price", metaName: "Price",
        left: pad + ctaW + 1.8 * cqw,
        top: btmY - ctaH + fs * 0.5 + ctaH / 2 - fs / 2,
        width: innerW - ctaW - 1.8 * cqw,
        fontSize: fs, fontFamily: "'Playfair Display', serif",
        fill: "#ecd9ac",
      });
    }
    btmY -= ctaH + 0.6 * cqw;
  }

  if (payload.locationLabel) {
    const fs = 2 * cqw;
    addText(`📍  ${payload.locationLabel}`, {
      metaId: "text-location", metaName: "Location",
      left: pad, top: btmY - fs * 1.4, width: innerW,
      fontSize: fs, fontFamily: "Inter, sans-serif",
      fill: "rgba(244,238,225,0.92)",
    });
  }
}

function populatePosterObjects(
  canvas: fabric.Canvas,
  payload: AssetPayload,
  brand: BrandSettings,
  width: number,
  height: number
) {
  // 1. Full Ambient Scrim
  const scrim = new fabric.Rect({
    left: 0,
    top: 0,
    width,
    height,
    fill: new fabric.Gradient({
      type: "linear",
      coords: { x1: 0, y1: 0, x2: 0, y2: height },
      colorStops: [
        { offset: 0, color: "rgba(8, 17, 14, 0.45)" },
        { offset: 0.35, color: "rgba(8, 17, 14, 0.15)" },
        { offset: 0.65, color: "rgba(6, 13, 10, 0.3)" },
        { offset: 1, color: "rgba(4, 10, 7, 0.92)" },
      ],
    }),
    selectable: false,
    evented: false,
  });
  (scrim as unknown as { meta: ObjectMeta }).meta = {
    id: "scrim-poster",
    name: "Poster Scrim",
    editable: false,
    locked: true,
    deletable: true,
    visible: true,
    category: "shape",
    aiGenerated: true,
  };
  canvas.add(scrim);

  let currentTop = 50;

  // 2. Kicker
  if (payload.kicker) {
    const kicker = new fabric.Textbox(payload.kicker.toUpperCase(), {
      left: width / 2,
      top: currentTop,
      originX: "center",
      width: width - 100,
      textAlign: "center",
      fontSize: 22,
      fontFamily: "Inter, sans-serif",
      fontWeight: "bold",
      fill: "#f1d49a",
      charSpacing: 220,
    });
    (kicker as unknown as { meta: ObjectMeta }).meta = {
      id: "text-kicker",
      name: "Poster Kicker",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "text",
      aiGenerated: true,
    };
    canvas.add(kicker);
    currentTop += calcTextHeight(payload.kicker, 22, width - 100) + 12;
  }

  // 3. Headline
  if (payload.headline) {
    const headline = new fabric.Textbox(payload.headline.toUpperCase(), {
      left: width / 2,
      top: currentTop,
      originX: "center",
      width: width - 80,
      textAlign: "center",
      fontSize: 56,
      fontFamily: "'Playfair Display', serif",
      fontWeight: "normal",
      fill: "#fffdf5",
      lineHeight: 1.05,
    });
    (headline as unknown as { meta: ObjectMeta }).meta = {
      id: "text-headline",
      name: "Headline",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "text",
      aiGenerated: true,
    };
    canvas.add(headline);
    currentTop += calcTextHeight(payload.headline, 56, width - 80) + 16;
  }

  // 4. Subline
  if (payload.subline) {
    const subline = new fabric.Textbox(payload.subline, {
      left: width / 2,
      top: currentTop,
      originX: "center",
      width: width - 100,
      textAlign: "center",
      fontSize: 26,
      fontFamily: "Inter, sans-serif",
      fontWeight: "bold",
      fill: "rgba(255, 253, 245, 0.96)",
    });
    (subline as unknown as { meta: ObjectMeta }).meta = {
      id: "text-subline",
      name: "Subline",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "text",
      aiGenerated: true,
    };
    canvas.add(subline);
    currentTop += calcTextHeight(payload.subline, 26, width - 100) + 12;
  }

  // 5. Fine Print / Tagline
  if (payload.fine) {
    const fine = new fabric.Textbox(payload.fine, {
      left: width / 2,
      top: currentTop,
      originX: "center",
      width: width - 120,
      textAlign: "center",
      fontSize: 20,
      fontFamily: "Inter, sans-serif",
      fill: "rgba(255, 253, 245, 0.9)",
    });
    (fine as unknown as { meta: ObjectMeta }).meta = {
      id: "text-fine",
      name: "Tagline",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "text",
      aiGenerated: true,
    };
    canvas.add(fine);
  }

  // 6. Benefits Pill Chips
  const bullets = (payload.bullets ?? []).slice(0, 3);
  if (bullets.length > 0) {
    const chipY = height - 285;
    const maxWidth = width - 80;
    const gap = 12;
    // Calculate estimated width for each chip
    const chipWidths = bullets.map((b) => Math.min(maxWidth, Math.round(b.length * 9.5 + 34)));
    let totalChipsW = chipWidths.reduce((sum, w) => sum + w, 0) + (bullets.length - 1) * gap;

    // Proportionally clamp so benefits chips never exceed maxWidth
    if (totalChipsW > maxWidth) {
      const scale = maxWidth / totalChipsW;
      for (let i = 0; i < chipWidths.length; i++) {
        chipWidths[i] = Math.round(chipWidths[i] * scale);
      }
      totalChipsW = maxWidth;
    }

    let startX = Math.max(40, Math.round((width - totalChipsW) / 2));

    bullets.forEach((b, idx) => {
      const cWidth = chipWidths[idx];
      const chipBg = new fabric.Rect({
        left: startX,
        top: chipY,
        width: cWidth,
        height: 38,
        rx: 19,
        ry: 19,
        fill: "rgba(8, 18, 13, 0.56)",
        stroke: "rgba(255, 255, 255, 0.34)",
        strokeWidth: 1,
      });
      (chipBg as unknown as { meta: ObjectMeta }).meta = {
        id: `chip-bg-${idx}`,
        name: `Benefit Chip Frame ${idx + 1}`,
        editable: true,
        locked: false,
        deletable: true,
        visible: true,
        category: "shape",
        aiGenerated: true,
      };
      canvas.add(chipBg);

      const chipText = new fabric.Textbox(b, {
        left: startX + cWidth / 2,
        top: chipY + 9,
        originX: "center",
        width: cWidth - 8,
        textAlign: "center",
        fontSize: Math.min(16, Math.max(11, Math.round(cWidth / (b.length * 0.72)))),
        fontFamily: "Inter, sans-serif",
        fill: "rgba(255, 253, 245, 0.96)",
      });
      (chipText as unknown as { meta: ObjectMeta }).meta = {
        id: `text-chip-${idx}`,
        name: `Benefit Chip ${idx + 1}`,
        editable: true,
        locked: false,
        deletable: true,
        visible: true,
        category: "text",
        aiGenerated: true,
      };
      canvas.add(chipText);

      startX += cWidth + gap;
    });
  }

  // 7. Bottom Details Card Container
  const cardMargin = 45;
  const cardWidth = width - 90;
  const cardHeight = 175;
  const cardTop = height - 230;

  const cardBg = new fabric.Rect({
    left: cardMargin,
    top: cardTop,
    width: cardWidth,
    height: cardHeight,
    rx: 20,
    ry: 20,
    fill: "rgba(7, 20, 14, 0.84)",
    stroke: "rgba(233, 204, 147, 0.55)",
    strokeWidth: 1,
  });
  (cardBg as unknown as { meta: ObjectMeta }).meta = {
    id: "card-details-bg",
    name: "Details Card Frame",
    editable: true,
    locked: false,
    deletable: true,
    visible: true,
    category: "shape",
    aiGenerated: true,
  };
  canvas.add(cardBg);

  // 8. Location Label inside Card
  if (payload.locationLabel) {
    const location = new fabric.Textbox(`📍  ${payload.locationLabel}`, {
      left: cardMargin + cardWidth / 2,
      top: cardTop + 20,
      originX: "center",
      width: cardWidth - 40,
      textAlign: "center",
      fontSize: 20,
      fontFamily: "Inter, sans-serif",
      fill: "rgba(255, 253, 245, 0.96)",
    });
    (location as unknown as { meta: ObjectMeta }).meta = {
      id: "text-location",
      name: "Location Label",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "text",
      aiGenerated: true,
    };
    canvas.add(location);
  }

  // 9. Price & CTA Row inside Card
  const rowY = cardTop + 78;

  if (payload.priceLine) {
    const price = new fabric.Textbox(payload.priceLine, {
      left: cardMargin + 30,
      top: rowY + 8,
      width: cardWidth * 0.45,
      fontSize: 34,
      fontFamily: "'Playfair Display', serif",
      fontWeight: "bold",
      fill: "#fffdf5",
    });
    (price as unknown as { meta: ObjectMeta }).meta = {
      id: "text-price",
      name: "Price Tag",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "text",
      aiGenerated: true,
    };
    canvas.add(price);
  }

  if (payload.cta) {
    const ctaW = Math.min(300, cardWidth * 0.48);
    const ctaH = 54;
    const ctaLeft = cardMargin + cardWidth - ctaW - 25;
    const ctaTop = rowY;

    const ctaBg = new fabric.Rect({
      left: ctaLeft,
      top: ctaTop,
      width: ctaW,
      height: ctaH,
      rx: 27,
      ry: 27,
      fill: "#fffef8",
      stroke: "rgba(255, 255, 255, 0.6)",
      strokeWidth: 1,
    });
    (ctaBg as unknown as { meta: ObjectMeta }).meta = {
      id: "cta-bg",
      name: "CTA Button Frame",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "shape",
      aiGenerated: true,
    };
    canvas.add(ctaBg);

    const ctaText = new fabric.Textbox(`${payload.cta.toUpperCase()}  ↗`, {
      left: ctaLeft + ctaW / 2,
      top: ctaTop + 14,
      originX: "center",
      width: ctaW - 10,
      textAlign: "center",
      fontSize: 18,
      fontFamily: "Inter, sans-serif",
      fontWeight: "bold",
      fill: "#17251b",
    });
    (ctaText as unknown as { meta: ObjectMeta }).meta = {
      id: "text-cta",
      name: "CTA Text",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "text",
      aiGenerated: true,
    };
    canvas.add(ctaText);
  }

  // 10. Footer
  if (brand?.domain) {
    const brandText = new fabric.Textbox(brand.domain.toLowerCase(), {
      left: 50,
      top: height - 42,
      width: 250,
      fontSize: 15,
      fontFamily: "Inter, sans-serif",
      fill: "rgba(244, 238, 225, 0.65)",
    });
    (brandText as unknown as { meta: ObjectMeta }).meta = {
      id: "text-brand",
      name: "Brand Domain",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "brand",
      aiGenerated: true,
    };
    canvas.add(brandText);

    const resText = new fabric.Textbox("THE RESIDENCES", {
      left: width - 230,
      top: height - 42,
      width: 180,
      textAlign: "right",
      fontSize: 14,
      fontFamily: "Inter, sans-serif",
      fontWeight: "bold",
      fill: "rgba(244, 238, 225, 0.65)",
      charSpacing: 180,
    });
    (resText as unknown as { meta: ObjectMeta }).meta = {
      id: "text-residences",
      name: "Residences Tag",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "text",
      aiGenerated: true,
    };
    canvas.add(resText);
  }
}

export function populateDefaultFabricObjects(
  canvas: fabric.Canvas,
  payload: AssetPayload,
  brand: BrandSettings,
  aspect: string,
  kind: string = "hero",
  platform: string = "instagram"
) {
  const { width, height } = getCanvasDimensions(aspect);

  const isWide = payload.layout === "wide" || ["linkedin", "portal"].includes(platform) || aspect === "16:9";

  if (isWide) {
    const panelWidth = Math.round(width * 0.46);
    const leftMargin = 50;
    const contentWidth = panelWidth - leftMargin - 30;

    // 1. Left Dark Panel Card
    const panelCard = new fabric.Rect({
      left: 0,
      top: 0,
      width: panelWidth,
      height: height,
      fill: "#14110c",
      stroke: "rgba(217, 171, 94, 0.25)",
      strokeWidth: 1,
      selectable: false,
      evented: false,
    });
    (panelCard as unknown as { meta: ObjectMeta }).meta = {
      id: "wide-panel-card",
      name: "Left Card Panel",
      editable: false,
      locked: true,
      deletable: false,
      visible: true,
      category: "shape",
      aiGenerated: true,
    };
    canvas.add(panelCard);

    let currentTop = 60;

    // 2. Kicker
    if (payload.kicker) {
      const kicker = new fabric.Textbox(payload.kicker.toUpperCase(), {
        left: leftMargin,
        top: currentTop,
        width: contentWidth,
        fontSize: 20,
        fontFamily: "Inter, sans-serif",
        fontWeight: "bold",
        fill: "#d9ab5e",
        charSpacing: 160,
      });
      (kicker as unknown as { meta: ObjectMeta }).meta = {
        id: "text-kicker",
        name: "Kicker / Tag",
        editable: true,
        locked: false,
        deletable: true,
        visible: true,
        category: "text",
        aiGenerated: true,
      };
      canvas.add(kicker);
      currentTop += calcTextHeight(payload.kicker, 20, contentWidth) + 12;
    }

    // 3. Headline
    if (payload.headline) {
      const headline = new fabric.Textbox(payload.headline, {
        left: leftMargin,
        top: currentTop,
        width: contentWidth,
        fontSize: 42,
        fontFamily: "'Playfair Display', serif",
        fontWeight: "normal",
        fill: "#fffdf5",
        lineHeight: 1.15,
      });
      (headline as unknown as { meta: ObjectMeta }).meta = {
        id: "text-headline",
        name: "Headline",
        editable: true,
        locked: false,
        deletable: true,
        visible: true,
        category: "text",
        aiGenerated: true,
      };
      canvas.add(headline);
      currentTop += calcTextHeight(payload.headline, 42, contentWidth) + 15;
    }

    // 4. Subline
    if (payload.subline) {
      const subline = new fabric.Textbox(payload.subline, {
        left: leftMargin,
        top: currentTop,
        width: contentWidth,
        fontSize: 22,
        fontFamily: "Inter, sans-serif",
        fontWeight: "normal",
        fill: "rgba(244, 238, 225, 0.9)",
      });
      (subline as unknown as { meta: ObjectMeta }).meta = {
        id: "text-subline",
        name: "Subline",
        editable: true,
        locked: false,
        deletable: true,
        visible: true,
        category: "text",
        aiGenerated: true,
      };
      canvas.add(subline);
      currentTop += calcTextHeight(payload.subline, 22, contentWidth) + 15;
    }

    // 5. Bullets
    const bullets = (payload.bullets ?? []).slice(0, 3);
    if (bullets.length > 0) {
      bullets.forEach((b, idx) => {
        const bText = new fabric.Textbox(`•  ${b}`, {
          left: leftMargin,
          top: currentTop,
          width: contentWidth,
          fontSize: 18,
          fontFamily: "Inter, sans-serif",
          fontWeight: "bold",
          fill: "rgba(244, 238, 225, 0.9)",
        });
        (bText as unknown as { meta: ObjectMeta }).meta = {
          id: `text-bullet-${idx}`,
          name: `USP Bullet ${idx + 1}`,
          editable: true,
          locked: false,
          deletable: true,
          visible: true,
          category: "text",
          aiGenerated: true,
        };
        canvas.add(bText);
        currentTop += calcTextHeight(`•  ${b}`, 18, contentWidth) + 8;
      });
    }

    // 6. Location Rows
    const rows = (payload.rows ?? []).slice(0, 4);
    if (bullets.length === 0 && rows.length > 0) {
      rows.forEach((r, idx) => {
        const rText = new fabric.Textbox(`${r.label}   —   ${r.mins !== undefined ? `${r.mins} MIN` : ""}`, {
          left: leftMargin,
          top: currentTop,
          width: contentWidth,
          fontSize: 18,
          fontFamily: "Inter, sans-serif",
          fill: "rgba(244, 238, 225, 0.92)",
        });
        (rText as unknown as { meta: ObjectMeta }).meta = {
          id: `text-row-${idx}`,
          name: `Location Row ${idx + 1}`,
          editable: true,
          locked: false,
          deletable: true,
          visible: true,
          category: "text",
          aiGenerated: true,
        };
        canvas.add(rText);
        currentTop += 32;
      });
    }

    // 7. CTA Button Frame & Text
    if (payload.cta) {
      const ctaBg = new fabric.Rect({
        left: leftMargin,
        top: height - 120,
        width: 240,
        height: 52,
        rx: 26,
        ry: 26,
        fill: "#d9ab5e",
      });
      (ctaBg as unknown as { meta: ObjectMeta }).meta = {
        id: "cta-bg",
        name: "CTA Button Frame",
        editable: true,
        locked: false,
        deletable: true,
        visible: true,
        category: "shape",
        aiGenerated: true,
      };
      canvas.add(ctaBg);

      const ctaText = new fabric.Textbox(`${payload.cta.toUpperCase()}  →`, {
        left: leftMargin + 120,
        top: height - 104,
        originX: "center",
        width: 220,
        textAlign: "center",
        fontSize: 18,
        fontFamily: "Inter, sans-serif",
        fontWeight: "bold",
        fill: "#171208",
      });
      (ctaText as unknown as { meta: ObjectMeta }).meta = {
        id: "text-cta",
        name: "CTA Text",
        editable: true,
        locked: false,
        deletable: true,
        visible: true,
        category: "text",
        aiGenerated: true,
      };
      canvas.add(ctaText);
    }

    // 8. Price Tag
    if (payload.priceLine) {
      const price = new fabric.Textbox(payload.priceLine, {
        left: leftMargin + 260,
        top: height - 112,
        width: contentWidth - 260,
        fontSize: 28,
        fontFamily: "'Playfair Display', serif",
        fontWeight: "bold",
        fill: "#ecd9ac",
      });
      (price as unknown as { meta: ObjectMeta }).meta = {
        id: "text-price",
        name: "Price Tag",
        editable: true,
        locked: false,
        deletable: true,
        visible: true,
        category: "text",
        aiGenerated: true,
      };
      canvas.add(price);
    }

    // 9. Brand Footer
    if (brand?.domain) {
      const brandText = new fabric.Textbox(brand.domain.toLowerCase(), {
        left: width - 280,
        top: height - 45,
        width: 230,
        fontSize: 16,
        fontFamily: "Inter, sans-serif",
        fontWeight: "normal",
        fill: "rgba(244, 238, 225, 0.65)",
        charSpacing: 100,
      });
      (brandText as unknown as { meta: ObjectMeta }).meta = {
        id: "text-brand",
        name: "Brand Domain",
        editable: true,
        locked: false,
        deletable: true,
        visible: true,
        category: "brand",
        aiGenerated: true,
      };
      canvas.add(brandText);
    }

    return;
  }

  if (kind === "hero") {
    populatePosterObjects(canvas, payload, brand, width, height);
    return;
  }

  // ---------------- STANDARD OVERLAY LAYOUT ----------------
  const contentWidth = width - 120;
  const leftMargin = 60;

  // 1. Top Gradient Scrim
  const topScrim = new fabric.Rect({
    left: 0,
    top: 0,
    width,
    height: height * 0.45,
    fill: new fabric.Gradient({
      type: "linear",
      coords: { x1: 0, y1: 0, x2: 0, y2: height * 0.45 },
      colorStops: [
        { offset: 0, color: "rgba(8, 17, 14, 0.75)" },
        { offset: 0.5, color: "rgba(8, 17, 14, 0.3)" },
        { offset: 1, color: "rgba(8, 17, 14, 0)" },
      ],
    }),
    selectable: false,
    evented: false,
  });
  (topScrim as unknown as { meta: ObjectMeta }).meta = {
    id: "scrim-top",
    name: "Top Gradient Scrim",
    editable: false,
    locked: true,
    deletable: true,
    visible: true,
    category: "shape",
    aiGenerated: true,
  };
  canvas.add(topScrim);

  // 2. Bottom Gradient Scrim
  const bottomScrim = new fabric.Rect({
    left: 0,
    top: height * 0.35,
    width,
    height: height * 0.65,
    fill: new fabric.Gradient({
      type: "linear",
      coords: { x1: 0, y1: 0, x2: 0, y2: height * 0.65 },
      colorStops: [
        { offset: 0, color: "rgba(4, 10, 7, 0)" },
        { offset: 0.4, color: "rgba(4, 10, 7, 0.6)" },
        { offset: 1, color: "rgba(4, 10, 7, 0.95)" },
      ],
    }),
    selectable: false,
    evented: false,
  });
  (bottomScrim as unknown as { meta: ObjectMeta }).meta = {
    id: "scrim-bottom",
    name: "Bottom Gradient Scrim",
    editable: false,
    locked: true,
    deletable: true,
    visible: true,
    category: "shape",
    aiGenerated: true,
  };
  canvas.add(bottomScrim);

  let currentTop = 60;

  // 3. Kicker
  if (payload.kicker) {
    if (kind === "offer") {
      const tagBg = new fabric.Rect({
        left: leftMargin,
        top: currentTop,
        width: Math.min(contentWidth, payload.kicker.length * 15 + 40),
        height: 40,
        rx: 8,
        ry: 8,
        fill: "#d9ab5e",
      });
      (tagBg as unknown as { meta: ObjectMeta }).meta = {
        id: "kicker-bg",
        name: "Offer Tag Frame",
        editable: true,
        locked: false,
        deletable: true,
        visible: true,
        category: "shape",
        aiGenerated: true,
      };
      canvas.add(tagBg);

      const kicker = new fabric.Textbox(payload.kicker.toUpperCase(), {
        left: leftMargin + 16,
        top: currentTop + 9,
        fontSize: 18,
        fontFamily: "Inter, sans-serif",
        fontWeight: "bold",
        fill: "#171208",
      });
      (kicker as unknown as { meta: ObjectMeta }).meta = {
        id: "text-kicker",
        name: "Kicker / Tag",
        editable: true,
        locked: false,
        deletable: true,
        visible: true,
        category: "text",
        aiGenerated: true,
      };
      canvas.add(kicker);
      currentTop += 52;
    } else {
      const kicker = new fabric.Textbox(payload.kicker.toUpperCase(), {
        left: leftMargin,
        top: currentTop,
        width: contentWidth,
        fontSize: 22,
        fontFamily: "Inter, sans-serif",
        fontWeight: "bold",
        fill: "#d9ab5e",
        charSpacing: 180,
      });
      (kicker as unknown as { meta: ObjectMeta }).meta = {
        id: "text-kicker",
        name: "Kicker / Tag",
        editable: true,
        locked: false,
        deletable: true,
        visible: true,
        category: "text",
        aiGenerated: true,
      };
      canvas.add(kicker);
      currentTop += calcTextHeight(payload.kicker, 22, contentWidth) + 12;
    }
  }

  // 4. Headline / Hook
  const headStr = payload.headline || payload.hook;
  if (headStr) {
    const headSize = kind === "offer" ? 60 : 50;
    const headline = new fabric.Textbox(headStr, {
      left: leftMargin,
      top: currentTop,
      width: contentWidth,
      fontSize: headSize,
      fontFamily: kind === "lifestyle" || kind === "reel" ? "Inter, sans-serif" : "'Playfair Display', serif",
      fontWeight: "normal",
      fill: "#fffdf5",
      lineHeight: 1.15,
    });
    (headline as unknown as { meta: ObjectMeta }).meta = {
      id: "text-headline",
      name: "Headline",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "text",
      aiGenerated: true,
    };
    canvas.add(headline);
    currentTop += calcTextHeight(headStr, headSize, contentWidth) + 15;
  }

  // 5. Subline
  if (payload.subline) {
    const subline = new fabric.Textbox(payload.subline, {
      left: leftMargin,
      top: currentTop,
      width: contentWidth,
      fontSize: 24,
      fontFamily: "Inter, sans-serif",
      fontWeight: "normal",
      fill: "rgba(244, 238, 225, 0.92)",
    });
    (subline as unknown as { meta: ObjectMeta }).meta = {
      id: "text-subline",
      name: "Subline",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "text",
      aiGenerated: true,
    };
    canvas.add(subline);
    currentTop += calcTextHeight(payload.subline, 24, contentWidth) + 18;
  }

  // 6. Feature Chips (for kind === "feature")
  const bullets = (payload.bullets ?? []).slice(0, 4);
  if (kind === "feature" && bullets.length > 0) {
    const chipW = Math.round((contentWidth - 20) / 2);
    bullets.forEach((b, idx) => {
      const rowIdx = Math.floor(idx / 2);
      const colIdx = idx % 2;
      const cLeft = leftMargin + colIdx * (chipW + 20);
      const cTop = currentTop + rowIdx * 54;

      const chipBg = new fabric.Rect({
        left: cLeft,
        top: cTop,
        width: chipW,
        height: 46,
        rx: 10,
        ry: 10,
        fill: "rgba(11, 10, 8, 0.45)",
        stroke: "rgba(244, 238, 225, 0.22)",
        strokeWidth: 1,
      });
      (chipBg as unknown as { meta: ObjectMeta }).meta = {
        id: `chip-bg-${idx}`,
        name: `Feature Chip Frame ${idx + 1}`,
        editable: true,
        locked: false,
        deletable: true,
        visible: true,
        category: "shape",
        aiGenerated: true,
      };
      canvas.add(chipBg);

      const chipText = new fabric.Textbox(`•  ${b}`, {
        left: cLeft + 14,
        top: cTop + 11,
        width: chipW - 28,
        fontSize: 18,
        fontFamily: "Inter, sans-serif",
        fill: "#fffdf5",
      });
      (chipText as unknown as { meta: ObjectMeta }).meta = {
        id: `text-chip-${idx}`,
        name: `Feature Chip ${idx + 1}`,
        editable: true,
        locked: false,
        deletable: true,
        visible: true,
        category: "text",
        aiGenerated: true,
      };
      canvas.add(chipText);
    });
    currentTop += Math.ceil(bullets.length / 2) * 54 + 20;
  }

  // 7. Location Rows (for kind === "location")
  const rows = (payload.rows ?? []).slice(0, 4);
  if (kind === "location" && rows.length > 0) {
    rows.forEach((r, idx) => {
      const rText = new fabric.Textbox(`${r.label}   —   ${r.mins !== undefined ? `${r.mins} MIN` : ""}`, {
        left: leftMargin,
        top: currentTop,
        width: contentWidth,
        fontSize: 22,
        fontFamily: "Inter, sans-serif",
        fill: "rgba(244, 238, 225, 0.92)",
      });
      (rText as unknown as { meta: ObjectMeta }).meta = {
        id: `text-row-${idx}`,
        name: `Location Row ${idx + 1}`,
        editable: true,
        locked: false,
        deletable: true,
        visible: true,
        category: "text",
        aiGenerated: true,
      };
      canvas.add(rText);
      currentTop += 38;
    });
    currentTop += 15;
  }

  // 8. Offer Big Price
  if (kind === "offer" && payload.priceLine) {
    const priceText = new fabric.Textbox(payload.priceLine, {
      left: leftMargin,
      top: currentTop,
      width: contentWidth,
      fontSize: 48,
      fontFamily: "'Playfair Display', serif",
      fontWeight: "bold",
      fill: "#ecd9ac",
    });
    (priceText as unknown as { meta: ObjectMeta }).meta = {
      id: "text-price-offer",
      name: "Offer Price Line",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "text",
      aiGenerated: true,
    };
    canvas.add(priceText);
    currentTop += 65;
  }

  // 9. Location Label
  if (payload.locationLabel) {
    const location = new fabric.Textbox(`📍 ${payload.locationLabel}`, {
      left: leftMargin,
      top: height - 215,
      width: contentWidth,
      fontSize: 22,
      fontFamily: "Inter, sans-serif",
      fontWeight: "normal",
      fill: "rgba(244, 238, 225, 0.92)",
    });
    (location as unknown as { meta: ObjectMeta }).meta = {
      id: "text-location",
      name: "Location Label",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "text",
      aiGenerated: true,
    };
    canvas.add(location);
  }

  // 10. Non-Offer Price Tag
  const hasPriceTag = Boolean(payload.priceLine && kind !== "offer");
  if (hasPriceTag) {
    const price = new fabric.Textbox(payload.priceLine!, {
      left: leftMargin,
      top: height - 155,
      width: contentWidth * 0.5,
      fontSize: 38,
      fontFamily: "'Playfair Display', serif",
      fontWeight: "bold",
      fill: "#ecd9ac",
    });
    (price as unknown as { meta: ObjectMeta }).meta = {
      id: "text-price",
      name: "Price Tag",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "text",
      aiGenerated: true,
    };
    canvas.add(price);
  }

  // 11. CTA Button Pill & Text
  if (payload.cta) {
    const ctaWidth = 270;
    const ctaHeight = 56;
    const ctaLeft = hasPriceTag ? width - 330 : leftMargin;
    const ctaTop = height - 158;

    const ctaBg = new fabric.Rect({
      left: ctaLeft,
      top: ctaTop,
      width: ctaWidth,
      height: ctaHeight,
      rx: 28,
      ry: 28,
      fill: "#d9ab5e",
    });
    (ctaBg as unknown as { meta: ObjectMeta }).meta = {
      id: "cta-bg",
      name: "CTA Button Frame",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "shape",
      aiGenerated: true,
    };
    canvas.add(ctaBg);

    const ctaText = new fabric.Textbox(`${payload.cta.toUpperCase()}  →`, {
      left: ctaLeft + ctaWidth / 2,
      top: ctaTop + 15,
      originX: "center",
      width: ctaWidth - 20,
      textAlign: "center",
      fontSize: 20,
      fontFamily: "Inter, sans-serif",
      fontWeight: "bold",
      fill: "#171208",
    });
    (ctaText as unknown as { meta: ObjectMeta }).meta = {
      id: "text-cta",
      name: "CTA Text",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "text",
      aiGenerated: true,
    };
    canvas.add(ctaText);
  }

  // 12. Brand Domain Footer
  if (brand?.domain) {
    const brandText = new fabric.Textbox(brand.domain.toLowerCase(), {
      left: leftMargin,
      top: height - 55,
      width: contentWidth,
      fontSize: 16,
      fontFamily: "Inter, sans-serif",
      fontWeight: "normal",
      fill: "rgba(244, 238, 225, 0.65)",
      charSpacing: 100,
    });
    (brandText as unknown as { meta: ObjectMeta }).meta = {
      id: "text-brand",
      name: "Brand Domain",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "brand",
      aiGenerated: true,
    };
    canvas.add(brandText);
  }
}

