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
  // LUXURY REAL-ESTATE POSTER LAYOUT (PosterBody in ad-creative.tsx)
  // ─────────────────────────────────────────────────────────────
  if (!isWide) {
    populatePosterObjects(canvas, payload, brand, W, H);
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
      addText(payload.cta.toUpperCase(), {
        metaId: "text-cta", metaName: "CTA Text",
        left: lm + ctaW / 2, top: H - 3.5 * cqw - fs - 2 * cqw + 1.1 * cqw,
        originX: "center", width: ctaW, textAlign: "center",
        fontSize: fs, fontFamily: "Inter, sans-serif",
        fontWeight: "bold", fill: "#171208",
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
    addText(payload.cta.toUpperCase(), {
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

function parseBhk(propertyType?: string, subline?: string): string {
  const combined = `${propertyType ?? ""} ${subline ?? ""}`;
  const match = combined.match(/\b(\d+(?:\s*[,/&]\s*\d+)*\s*BHK)\b/i);
  if (match) {
    return match[1].replace(/\s*\/\s*/g, " & ").toUpperCase();
  }
  return "3 & 4 BHK";
}

function parseDeveloperAndProject(
  kicker?: string,
  headline?: string,
  brandName?: string
): { developer: string; project: string } {
  if (kicker && kicker !== "SIGNATURE RESIDENCES") {
    return {
      developer: kicker.toUpperCase(),
      project: (headline || "").toUpperCase(),
    };
  }
  const parts = (headline || "").trim().split(/\s+/);
  if (parts.length >= 2) {
    return {
      developer: parts[0].toUpperCase(),
      project: parts.slice(1).join(" ").toUpperCase(),
    };
  }
  return {
    developer: (brandName || "EXCLUSIVE").toUpperCase(),
    project: (headline || "").toUpperCase(),
  };
}

function populatePosterObjects(
  canvas: fabric.Canvas,
  payload: AssetPayload,
  brand: BrandSettings,
  width: number,
  height: number
) {
  const cqw = width / 100;
  const { developer, project } = parseDeveloperAndProject(payload.kicker, payload.headline, brand.name);
  const bhk = parseBhk(payload.subline, payload.kicker);
  const locationTag = payload.locationLabel
    ? `LUXURY RESIDENCES IN ${payload.locationLabel.toUpperCase()}`
    : payload.subline
    ? payload.subline.toUpperCase()
    : "LUXURY RESIDENCES";
  const bullets = (payload.bullets ?? []).slice(0, 3);
  const amenitiesLine = bullets.length >= 2
    ? `${bullets[0]} | ${bullets[1]}`.toUpperCase()
    : bullets.length === 1
    ? bullets[0].toUpperCase()
    : "80% OPEN SPACES | 20 WORLD CLASS AMENITIES";
  const tagline = payload.fine ? payload.fine.toUpperCase() : "WHERE LUXURY MEETS NATURE";
  const price = payload.priceLine || "₹3.2 CR*";
  const contactText = payload.cta && !payload.cta.toLowerCase().includes("1234567890") && !/\d{8,}/.test(payload.cta)
    ? payload.cta.toUpperCase()
    : "BOOK NOW";

  // 1. Ambient Top Scrim for crisp text contrast against sky/foliage
  const scrim = new fabric.Rect({
    left: 0,
    top: 0,
    width,
    height: height * 0.46,
    fill: new fabric.Gradient({
      type: "linear",
      coords: { x1: 0, y1: 0, x2: 0, y2: height * 0.46 },
      colorStops: [
        { offset: 0, color: "rgba(6, 10, 8, 0.72)" },
        { offset: 0.5, color: "rgba(6, 10, 8, 0.35)" },
        { offset: 1, color: "rgba(6, 10, 8, 0)" },
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

  let currentTop = Math.max(28, 3.8 * cqw);

  // 2. Developer / Brand Name
  const devFs = Math.max(12, Math.round(3.2 * cqw));
  const devText = new fabric.Textbox(developer, {
    left: width / 2,
    top: currentTop,
    originX: "center",
    width: width * 0.9,
    textAlign: "center",
    fontSize: devFs,
    fontFamily: "Inter, sans-serif",
    fontWeight: "bold",
    fill: "#ffffff",
    charSpacing: 180,
  });
  (devText as unknown as { meta: ObjectMeta }).meta = {
    id: "text-developer",
    name: "Developer Name",
    editable: true,
    locked: false,
    deletable: true,
    visible: true,
    category: "text",
    aiGenerated: true,
  };
  canvas.add(devText);
  currentTop += devFs * 1.2 + 0.8 * cqw;

  // 3. Project Name
  const projFs = Math.max(22, Math.round(6.4 * cqw));
  const projText = new fabric.Textbox(project, {
    left: width / 2,
    top: currentTop,
    originX: "center",
    width: width * 0.92,
    textAlign: "center",
    fontSize: projFs,
    fontFamily: "Inter, sans-serif",
    fontWeight: "800",
    fill: "#ffffff",
    charSpacing: 60,
    lineHeight: 1.02,
  });
  (projText as unknown as { meta: ObjectMeta }).meta = {
    id: "text-project",
    name: "Project Headline",
    editable: true,
    locked: false,
    deletable: true,
    visible: true,
    category: "text",
    aiGenerated: true,
  };
  canvas.add(projText);
  currentTop += calcTextHeight(project, projFs, width * 0.92) + 1.2 * cqw;

  // 4. Tagline & Divider
  const tagFs = Math.max(10, Math.round(2.3 * cqw));
  const tagText = new fabric.Textbox(tagline, {
    left: width / 2,
    top: currentTop,
    originX: "center",
    width: width * 0.88,
    textAlign: "center",
    fontSize: tagFs,
    fontFamily: "Inter, sans-serif",
    fontWeight: "600",
    fill: "rgba(255, 255, 255, 0.95)",
    charSpacing: 160,
  });
  (tagText as unknown as { meta: ObjectMeta }).meta = {
    id: "text-tagline",
    name: "Tagline",
    editable: true,
    locked: false,
    deletable: true,
    visible: true,
    category: "text",
    aiGenerated: true,
  };
  canvas.add(tagText);
  currentTop += tagFs * 1.2 + 0.4 * cqw;

  // Subtle Divider line
  const divLineW = 18 * cqw;
  const divLine = new fabric.Rect({
    left: width / 2 - divLineW / 2,
    top: currentTop,
    width: divLineW,
    height: 1,
    fill: "rgba(255, 255, 255, 0.4)",
    selectable: false,
  });
  (divLine as unknown as { meta: ObjectMeta }).meta = {
    id: "divider-line",
    name: "Tagline Divider",
    editable: true,
    locked: false,
    deletable: true,
    visible: true,
    category: "shape",
    aiGenerated: true,
  };
  canvas.add(divLine);
  currentTop += 1.6 * cqw;

  // 5. BHK Highlight
  const bhkFs = Math.max(26, Math.round(7.6 * cqw));
  const bhkText = new fabric.Textbox(bhk, {
    left: width / 2,
    top: currentTop,
    originX: "center",
    width: width * 0.88,
    textAlign: "center",
    fontSize: bhkFs,
    fontFamily: "Inter, sans-serif",
    fontWeight: "900",
    fill: "#ffffff",
    lineHeight: 1.0,
  });
  (bhkText as unknown as { meta: ObjectMeta }).meta = {
    id: "text-bhk",
    name: "Configuration (BHK)",
    editable: true,
    locked: false,
    deletable: true,
    visible: true,
    category: "text",
    aiGenerated: true,
  };
  canvas.add(bhkText);
  currentTop += bhkFs * 1.05 + 1.1 * cqw;

  // 6. Typology & Location Subtitle
  const locFs = Math.max(9, Math.round(2.2 * cqw));
  const locText = new fabric.Textbox(locationTag, {
    left: width / 2,
    top: currentTop,
    originX: "center",
    width: width * 0.88,
    textAlign: "center",
    fontSize: locFs,
    fontFamily: "Inter, sans-serif",
    fontWeight: "600",
    fill: "rgba(255, 255, 255, 0.95)",
    charSpacing: 220,
  });
  (locText as unknown as { meta: ObjectMeta }).meta = {
    id: "text-location-sub",
    name: "Typology & Location",
    editable: true,
    locked: false,
    deletable: true,
    visible: true,
    category: "text",
    aiGenerated: true,
  };
  canvas.add(locText);
  currentTop += locFs * 1.2 + 1.1 * cqw;

  // 7. Key Amenities / Open Spaces Line
  const amenFs = Math.max(9, Math.round(1.95 * cqw));
  const amenText = new fabric.Textbox(amenitiesLine, {
    left: width / 2,
    top: currentTop,
    originX: "center",
    width: width * 0.92,
    textAlign: "center",
    fontSize: amenFs,
    fontFamily: "Inter, sans-serif",
    fontWeight: "500",
    fill: "rgba(255, 255, 255, 0.90)",
    charSpacing: 120,
  });
  (amenText as unknown as { meta: ObjectMeta }).meta = {
    id: "text-amenities-line",
    name: "Key Amenities Line",
    editable: true,
    locked: false,
    deletable: true,
    visible: true,
    category: "text",
    aiGenerated: true,
  };
  canvas.add(amenText);
  currentTop += amenFs * 1.2 + 1.8 * cqw;

  // 8. Starting Price Block
  const priceLabelFs = Math.max(8, Math.round(1.8 * cqw));
  const startLabel = new fabric.Textbox("——  STARTING FROM  ——", {
    left: width / 2,
    top: currentTop,
    originX: "center",
    width: width * 0.8,
    textAlign: "center",
    fontSize: priceLabelFs,
    fontFamily: "Inter, sans-serif",
    fontWeight: "600",
    fill: "rgba(255, 255, 255, 0.85)",
    charSpacing: 200,
  });
  (startLabel as unknown as { meta: ObjectMeta }).meta = {
    id: "text-starting-label",
    name: "Starting Label",
    editable: true,
    locked: false,
    deletable: true,
    visible: true,
    category: "text",
    aiGenerated: true,
  };
  canvas.add(startLabel);
  currentTop += priceLabelFs * 1.2 + 0.5 * cqw;

  const priceFs = Math.max(20, Math.round(5.6 * cqw));
  const priceText = new fabric.Textbox(price, {
    left: width / 2,
    top: currentTop,
    originX: "center",
    width: width * 0.8,
    textAlign: "center",
    fontSize: priceFs,
    fontFamily: "Inter, sans-serif",
    fontWeight: "900",
    fill: "#ffffff",
    lineHeight: 1.0,
  });
  (priceText as unknown as { meta: ObjectMeta }).meta = {
    id: "text-price",
    name: "Starting Price",
    editable: true,
    locked: false,
    deletable: true,
    visible: true,
    category: "text",
    aiGenerated: true,
  };
  canvas.add(priceText);

  // 9. Bottom Zone: Solid Crisp White Footer Contact Bar across entire width
  const callBarH = Math.max(46, Math.round(6.2 * cqw));
  const callBarTop = height - callBarH;

  const callBarBg = new fabric.Rect({
    left: 0,
    top: callBarTop,
    width,
    height: callBarH,
    fill: "#ffffff",
    selectable: false,
  });
  (callBarBg as unknown as { meta: ObjectMeta }).meta = {
    id: "call-bar-bg",
    name: "Bottom Call Bar Frame",
    editable: true,
    locked: false,
    deletable: true,
    visible: true,
    category: "shape",
    aiGenerated: true,
  };
  canvas.add(callBarBg);

  const callFs = Math.max(12, Math.round(2.7 * cqw));
  const callTextObj = new fabric.Textbox(contactText, {
    left: width / 2,
    top: callBarTop + (callBarH - callFs) / 2,
    originX: "center",
    width: width - 20,
    textAlign: "center",
    fontSize: callFs,
    fontFamily: "Inter, sans-serif",
    fontWeight: "bold",
    fill: "#0c120e",
    charSpacing: 60,
  });
  (callTextObj as unknown as { meta: ObjectMeta }).meta = {
    id: "text-contact-call",
    name: "Contact Call Bar Text",
    editable: true,
    locked: false,
    deletable: true,
    visible: true,
    category: "text",
    aiGenerated: true,
  };
  canvas.add(callTextObj);
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

      const ctaText = new fabric.Textbox(payload.cta.toUpperCase(), {
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

    return;
  }

  // All poster ads use the luxury real-estate layout matching reference design
  populatePosterObjects(canvas, payload, brand, width, height);
  return;
}
