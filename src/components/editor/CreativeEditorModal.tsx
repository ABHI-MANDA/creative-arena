"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as fabric from "fabric";

// Register custom metadata property for Fabric v7 serialization
(fabric.FabricObject as unknown as { customProperties?: string[] }).customProperties = ["meta"];
import {
  ArrowLeft,
  Bold,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Italic,
  Layers,
  Layout,
  Loader2,
  Lock,
  LockOpen,
  Maximize2,
  Move,
  Palette,
  Plus,
  Redo,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  Square,
  Type,
  Trash2,
  Underline,
  Undo,
  Upload,
  X,
  Zap,
} from "lucide-react";
import type { AssetPayload } from "@/lib/creative/engine";
import type { BrandSettings } from "@/lib/creative/presets";
import {
  FONT_LIBRARY,
  getCanvasDimensions,
  populateDefaultFabricObjects,
  type ObjectMeta,
} from "@/lib/editor/fabric-adapter";
import { cx } from "@/lib/utils";

export type AdAssetLike = {
  id: string;
  kind: string;
  platform: string;
  aspect: string;
  title?: string;
  payload: AssetPayload;
  score?: number;
  status?: string;
  approved?: boolean;
};

type Props = {
  asset: AdAssetLike;
  brand: BrandSettings;
  onClose: () => void;
  onSaveSuccess: (updatedPayload: AssetPayload) => void;
};

function safeClear(canvas: fabric.Canvas | null) {
  if (!canvas) return;
  try {
    const ctx = (canvas as unknown as { contextContainer?: CanvasRenderingContext2D | null }).contextContainer;
    if (ctx && typeof ctx.clearRect === "function") {
      canvas.clear();
    } else {
      const objs = canvas.getObjects ? canvas.getObjects() : [];
      if (objs && objs.length > 0) {
        canvas.remove(...objs);
      }
    }
  } catch (err) {
    console.warn("safeClear prevented error:", err);
  }
}

function formatColorValue(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    if ("colorStops" in val || ("type" in val && ((val as { type: string }).type === "linear" || (val as { type: string }).type === "radial"))) {
      return "Gradient";
    }
    return "Custom Fill";
  }
  return "";
}

function toHexColor(val: unknown, fallback: string = "#d9ab5e"): string {
  if (typeof val === "string") {
    if (/^#[0-9a-f]{6}$/i.test(val)) return val;
    if (/^#[0-9a-f]{3}$/i.test(val)) {
      return `#${val[1]}${val[1]}${val[2]}${val[2]}${val[3]}${val[3]}`;
    }
  }
  return fallback;
}

export function CreativeEditorModal({ asset, brand, onClose, onSaveSuccess }: Props) {
  const assetRef = useRef(asset);
  assetRef.current = asset;
  const brandRef = useRef(brand);
  brandRef.current = brand;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { width: targetWidth, height: targetHeight } = getCanvasDimensions(asset.aspect);

  /* Editor Mode */
  const [activeTab, setActiveTab] = useState<"text" | "shapes" | "images" | "brand" | "layers">("layers");
  const [previewMode, setPreviewMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>("");
  /* Responsive Auto-Fitting Canvas Measurement */
  const [containerSize, setContainerSize] = useState({ width: 900, height: 600 });

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const fitScale = useMemo(() => {
    const padX = 64;
    const padY = 64;
    const availW = Math.max(200, containerSize.width - padX);
    const availH = Math.max(200, containerSize.height - padY);
    return Math.min(availW / targetWidth, availH / targetHeight, 1);
  }, [containerSize, targetWidth, targetHeight]);

  const effectiveScale = fitScale * zoom;
  const effectiveScaleRef = useRef(effectiveScale);
  effectiveScaleRef.current = effectiveScale;

  /* Selection state */
  const [selectedObject, setSelectedObject] = useState<fabric.FabricObject | null>(null);
  const [layersList, setLayersList] = useState<fabric.FabricObject[]>([]);

  /* History Stack */
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isUndoRedoRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /* Form / Properties State */
  const [textProps, setTextProps] = useState({
    text: "",
    fontFamily: "Inter, sans-serif",
    fontSize: 32,
    fontWeight: "normal",
    fontStyle: "normal",
    underline: false,
    fill: "#ffffff",
    textAlign: "left",
    charSpacing: 0,
    lineHeight: 1.2,
    opacity: 1,
  });

  const [shapeProps, setShapeProps] = useState({
    fill: "#d9ab5e",
    stroke: "#ffffff",
    strokeWidth: 0,
    rx: 0,
    ry: 0,
    opacity: 1,
  });

  const pushHistory = useCallback(() => {
    if (isUndoRedoRef.current || !fabricCanvasRef.current) return;
    try {
      const jsonStr = JSON.stringify(fabricCanvasRef.current.toJSON());
      const idx = historyIndexRef.current;
      const history = historyRef.current.slice(0, idx + 1);
      history.push(jsonStr);
      if (history.length > 30) history.shift();
      historyRef.current = history;
      historyIndexRef.current = history.length - 1;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(false);
    } catch {}
  }, []);

  const updateLayersList = useCallback(() => {
    if (!fabricCanvasRef.current) return;
    const objs = fabricCanvasRef.current.getObjects().slice().reverse();
    setLayersList(objs);
  }, []);

  const constrainObjectToCanvas = useCallback((obj: fabric.FabricObject) => {
    const meta = (obj as unknown as { meta?: ObjectMeta }).meta;
    if (meta?.category === "background" || meta?.id === "bg-image") return;

    obj.setCoords();
    let bounds = obj.getBoundingRect();
    const fitScale = Math.min(
      1,
      targetWidth / Math.max(bounds.width, 1),
      targetHeight / Math.max(bounds.height, 1)
    );

    if (fitScale < 1) {
      obj.set({
        scaleX: (obj.scaleX || 1) * fitScale,
        scaleY: (obj.scaleY || 1) * fitScale,
      });
      obj.setCoords();
      bounds = obj.getBoundingRect();
    }

    const dx = bounds.left < 0
      ? -bounds.left
      : bounds.left + bounds.width > targetWidth
        ? targetWidth - bounds.left - bounds.width
        : 0;
    const dy = bounds.top < 0
      ? -bounds.top
      : bounds.top + bounds.height > targetHeight
        ? targetHeight - bounds.top - bounds.height
        : 0;

    if (dx || dy) {
      obj.set({
        left: (obj.left || 0) + dx,
        top: (obj.top || 0) + dy,
      });
      obj.setCoords();
    }
  }, [targetHeight, targetWidth]);

  const constrainCanvasObjects = useCallback((canvas: fabric.Canvas) => {
    canvas.getObjects().forEach(constrainObjectToCanvas);
  }, [constrainObjectToCanvas]);

  /* Helper to ensure cross-origin and local images load into Fabric cleanly */
  const loadFabricImage = useCallback(async (url: string): Promise<fabric.FabricImage> => {
    if (!url) throw new Error("Missing image URL");

    let target = url;
    if (url.startsWith("/")) {
      target = `${window.location.origin}${url}`;
    } else if (url.startsWith("http://") || url.startsWith("https://")) {
      target = url;
    }

    return new Promise((resolve, reject) => {
      const imgEl = new Image();
      imgEl.crossOrigin = "anonymous";
      imgEl.onload = () => resolve(new fabric.FabricImage(imgEl));
      imgEl.onerror = () => {
        if (url.startsWith("http://") || url.startsWith("https://")) {
          const proxyEl = new Image();
          proxyEl.crossOrigin = "anonymous";
          proxyEl.onload = () => resolve(new fabric.FabricImage(proxyEl));
          proxyEl.onerror = () => {
            const rawEl = new Image();
            rawEl.onload = () => resolve(new fabric.FabricImage(rawEl));
            rawEl.onerror = reject;
            rawEl.src = url;
          };
          proxyEl.src = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        } else {
          const rawEl = new Image();
          rawEl.onload = () => resolve(new fabric.FabricImage(rawEl));
          rawEl.onerror = reject;
          rawEl.src = target;
        }
      };
      imgEl.src = target;
    });
  }, []);

  /* ---------------- Initialize Canvas ---------------- */
  useEffect(() => {
    if (!canvasRef.current) return;
    let isCancelled = false;

    const initialScale = effectiveScaleRef.current;
    const initialW = Math.max(10, Math.round(targetWidth * initialScale));
    const initialH = Math.max(10, Math.round(targetHeight * initialScale));

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: initialW,
      height: initialH,
      backgroundColor: "#12100c",
      preserveObjectStacking: true,
      selection: true,
    });
    canvas.setZoom(initialScale);

    fabricCanvasRef.current = canvas;

    /* Selection Listeners */
    const handleSelection = () => {
      const active = canvas.getActiveObject();
      setSelectedObject(active ?? null);

      if (active && (active instanceof fabric.Textbox || active instanceof fabric.IText || active instanceof fabric.Text)) {
        const fillVal = typeof active.fill === "string" ? active.fill : formatColorValue(active.fill);
        setTextProps({
          text: (active as fabric.Textbox).text || "",
          fontFamily: (active as fabric.Textbox).fontFamily || "Inter, sans-serif",
          fontSize: (active as fabric.Textbox).fontSize || 32,
          fontWeight: String(active.fontWeight || "normal"),
          fontStyle: (active as fabric.Textbox).fontStyle || "normal",
          underline: Boolean((active as fabric.Textbox).underline),
          fill: fillVal || "#ffffff",
          textAlign: (active as fabric.Textbox).textAlign || "left",
          charSpacing: (active as fabric.Textbox).charSpacing || 0,
          lineHeight: (active as fabric.Textbox).lineHeight || 1.2,
          opacity: active.opacity ?? 1,
        });
      } else if (active && (active instanceof fabric.Rect || active instanceof fabric.Circle)) {
        const fillVal = typeof active.fill === "string" ? active.fill : formatColorValue(active.fill);
        setShapeProps({
          fill: fillVal || "#d9ab5e",
          stroke: typeof active.stroke === "string" ? active.stroke : "",
          strokeWidth: active.strokeWidth || 0,
          rx: (active as fabric.Rect).rx || 0,
          ry: (active as fabric.Rect).ry || 0,
          opacity: active.opacity ?? 1,
        });
      }
    };

    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", () => {
      setSelectedObject(null);
    });

    /* Keep every editable layer inside the exported image while it is transformed. */
    const constrainTarget = (e: { target?: fabric.FabricObject }) => {
      if (!e.target) return;
      constrainObjectToCanvas(e.target);
      canvas.requestRenderAll();
    };
    canvas.on("object:moving", constrainTarget);
    canvas.on("object:scaling", constrainTarget);
    canvas.on("object:rotating", constrainTarget);
    canvas.on("text:changed", constrainTarget);

    canvas.on("object:modified", () => {
      const active = canvas.getActiveObject();
      if (active) constrainObjectToCanvas(active);
      pushHistory();
      updateLayersList();
    });

    canvas.on("object:added", () => {
      if (!isUndoRedoRef.current) {
        pushHistory();
        updateLayersList();
      }
    });

    canvas.on("object:removed", () => {
      if (!isUndoRedoRef.current) {
        pushHistory();
        updateLayersList();
      }
    });

    /* Load initial design */
    const initDesign = async () => {
      try {
        /* ═══════════════════════════════════════════════════════════════
         * PATH A — Saved draft: fetch & restore from DB
         * ───────────────────────────────────────────────────────────────
         * If the user already customized and saved a draft for this asset,
         * restore their exact saved work!
         * ═══════════════════════════════════════════════════════════════*/
        try {
          const res = await fetch(`/api/assets/${asset.id}`);
          if (isCancelled || !fabricCanvasRef.current) return;
          if (res.ok) {
            const data = await res.json();
            const dj = data?.payload?.designJson;
            if (dj) {
              const designData = typeof dj === "string" ? JSON.parse(dj) : dj;
              safeClear(canvas);
              if (isCancelled || !fabricCanvasRef.current) return;
              await canvas.loadFromJSON(designData);
              if (isCancelled || !fabricCanvasRef.current) return;
              constrainCanvasObjects(canvas);
              const curScale = effectiveScaleRef.current;
              canvas.setDimensions({
                width: Math.max(10, Math.round(targetWidth * curScale)),
                height: Math.max(10, Math.round(targetHeight * curScale)),
              });
              canvas.setZoom(curScale);
              canvas.renderAll();
              historyRef.current = [JSON.stringify(canvas.toJSON())];
              historyIndexRef.current = 0;
              setCanUndo(false);
              setCanRedo(false);
              updateLayersList();
              return;
            }
          }
        } catch {
          // no saved draft — proceed to fresh build
        }
        if (isCancelled || !fabricCanvasRef.current) return;

        /* ═══════════════════════════════════════════════════════════════
         * PATH B — Fresh build from payload
         * ───────────────────────────────────────────────────────────────
         * Reconstruct every layer as a live, fully editable Fabric object:
         * 1. Clean background photo at Layer 0 (selectable, moveable)
         * 2. All text, headline, kicker, subline, price, CTA, shapes
         *    from populateDefaultFabricObjects.
         * Every element can be clicked, double-clicked to edit, dragged,
         * recolored, and formatted!
         * ═══════════════════════════════════════════════════════════════*/
        safeClear(canvas);

        const currentAsset = assetRef.current;
        const currentBrand = brandRef.current;

        // 1. Populate all editable textboxes, shapes, cards, and CTA buttons
        populateDefaultFabricObjects(
          canvas,
          currentAsset.payload,
          currentBrand,
          currentAsset.aspect,
          currentAsset.kind,
          currentAsset.platform
        );
        constrainCanvasObjects(canvas);

        // 2. Load clean background property photo at layer 0 (behind scrim and text)
        const bgUrl = currentAsset.payload.image;
        if (bgUrl) {
          try {
            const bgImg = await loadFabricImage(bgUrl);
            if (isCancelled || !fabricCanvasRef.current) return;
            const imgW = bgImg.width || 800;
            const imgH = bgImg.height || 600;

            const isWide =
              currentAsset.payload.layout === "wide" ||
              ["linkedin", "portal"].includes(currentAsset.platform) ||
              currentAsset.aspect === "16:9";

            if (isWide) {
              const panelW = Math.round(targetWidth * 0.46);
              const imgWAvail = targetWidth - panelW;
              const scale = Math.max(imgWAvail / imgW, targetHeight / imgH);
              bgImg.set({
                originX: "center",
                originY: "center",
                left: panelW + imgWAvail / 2,
                top: targetHeight / 2,
                scaleX: scale,
                scaleY: scale,
                selectable: true,
                evented: true,
              });
            } else {
              const scale = Math.max(targetWidth / imgW, targetHeight / imgH);
              bgImg.set({
                originX: "center",
                originY: "center",
                left: targetWidth / 2,
                top: targetHeight / 2,
                scaleX: scale,
                scaleY: scale,
                selectable: true,
                evented: true,
              });
            }

            (bgImg as unknown as { meta: ObjectMeta }).meta = {
              id: "bg-image",
              name: "🖼 Background Photo",
              editable: true,
              locked: false,
              deletable: false,
              visible: true,
              category: "background",
              aiGenerated: true,
            };

            canvas.insertAt(0, bgImg);
          } catch (e) {
            console.warn("Could not load background photo:", e);
          }
        }

        if (isCancelled || !fabricCanvasRef.current) return;
        constrainCanvasObjects(canvas);
        const curScale = effectiveScaleRef.current;
        canvas.setDimensions({
          width: Math.max(10, Math.round(targetWidth * curScale)),
          height: Math.max(10, Math.round(targetHeight * curScale)),
        });
        canvas.setZoom(curScale);
        canvas.renderAll();
        historyRef.current = [JSON.stringify(canvas.toJSON())];
        historyIndexRef.current = 0;
        setCanUndo(false);
        setCanRedo(false);
        updateLayersList();
      } catch (err) {
        console.error("Error building fabric design:", err);
      }
    };

    initDesign();

    return () => {
      isCancelled = true;
      try {
        canvas.dispose();
      } catch {}
      fabricCanvasRef.current = null;
    };
  }, [asset.id, targetWidth, targetHeight, loadFabricImage, pushHistory, updateLayersList, constrainCanvasObjects, constrainObjectToCanvas]);

  /* Synchronize canvas dimensions and zoom when effectiveScale changes */
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const scaledW = Math.max(10, Math.round(targetWidth * effectiveScale));
    const scaledH = Math.max(10, Math.round(targetHeight * effectiveScale));

    canvas.setDimensions({
      width: scaledW,
      height: scaledH,
    });
    canvas.setZoom(effectiveScale);
    canvas.renderAll();
  }, [effectiveScale, targetWidth, targetHeight]);


  /* Keyboard Shortcuts */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        const active = canvas.getActiveObject();
        const isEditing = Boolean((active as unknown as { isEditing?: boolean })?.isEditing);
        if (active && !isEditing) {
          e.preventDefault();
          canvas.remove(active);
          canvas.discardActiveObject();
          canvas.renderAll();
        }
      } else if (e.key === "Escape") {
        canvas.discardActiveObject();
        canvas.renderAll();
      } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const active = canvas.getActiveObject();
        const isEditing = Boolean((active as unknown as { isEditing?: boolean })?.isEditing);
        if (active && !isEditing) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          if (e.key === "ArrowUp") active.top = (active.top || 0) - step;
          if (e.key === "ArrowDown") active.top = (active.top || 0) + step;
          if (e.key === "ArrowLeft") active.left = (active.left || 0) - step;
          if (e.key === "ArrowRight") active.left = (active.left || 0) + step;
          constrainObjectToCanvas(active);
          active.setCoords();
          canvas.renderAll();
          pushHistory();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pushHistory, constrainObjectToCanvas]);

  /* ---------------- Undo / Redo ---------------- */
  const handleUndo = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || historyIndexRef.current <= 0) return;

    isUndoRedoRef.current = true;
    historyIndexRef.current -= 1;
    const jsonStr = historyRef.current[historyIndexRef.current];
    if (jsonStr) {
      await canvas.loadFromJSON(JSON.parse(jsonStr));
      canvas.renderAll();
      updateLayersList();
    }
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    isUndoRedoRef.current = false;
  };

  const handleRedo = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || historyIndexRef.current >= historyRef.current.length - 1) return;

    isUndoRedoRef.current = true;
    historyIndexRef.current += 1;
    const jsonStr = historyRef.current[historyIndexRef.current];
    if (jsonStr) {
      await canvas.loadFromJSON(JSON.parse(jsonStr));
      canvas.renderAll();
      updateLayersList();
    }
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    isUndoRedoRef.current = false;
  };

  /* ---------------- Text Adding & Modification ---------------- */
  const addTextbox = (text: string, options: Partial<fabric.TextboxProps> = {}) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const textbox = new fabric.Textbox(text, {
      left: targetWidth / 2 - 200,
      top: targetHeight / 2 - 30,
      width: 400,
      fontSize: 36,
      fontFamily: "Inter, sans-serif",
      fill: "#ffffff",
      textAlign: "center",
      ...options,
    });

    (textbox as unknown as { meta: ObjectMeta }).meta = {
      id: `text-${Date.now()}`,
      name: text.slice(0, 18) || "Custom Text",
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "text",
      aiGenerated: false,
      userModified: true,
    };

    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    canvas.renderAll();
  };

  const updateSelectedText = (key: string, value: unknown) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const active = canvas.getActiveObject();
    if (active && active instanceof fabric.Textbox) {
      active.set(key as keyof fabric.TextboxProps, value);
      constrainObjectToCanvas(active);
      canvas.renderAll();
      setTextProps((prev) => ({ ...prev, [key]: value }));
      pushHistory();
    }
  };

  /* ---------------- Shape Adding & Modification ---------------- */
  const addShape = (type: "rect" | "rounded" | "circle" | "line") => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    let shape: fabric.FabricObject;

    if (type === "rect") {
      shape = new fabric.Rect({
        left: targetWidth / 2 - 100,
        top: targetHeight / 2 - 50,
        width: 200,
        height: 100,
        fill: "#d9ab5e",
        strokeWidth: 0,
      });
    } else if (type === "rounded") {
      shape = new fabric.Rect({
        left: targetWidth / 2 - 120,
        top: targetHeight / 2 - 30,
        width: 240,
        height: 60,
        rx: 30,
        ry: 30,
        fill: "#d9ab5e",
        strokeWidth: 0,
      });
    } else if (type === "circle") {
      shape = new fabric.Circle({
        left: targetWidth / 2 - 75,
        top: targetHeight / 2 - 75,
        radius: 75,
        fill: "#d9ab5e",
        strokeWidth: 0,
      });
    } else {
      shape = new fabric.Line([50, 50, 300, 50], {
        left: targetWidth / 2 - 125,
        top: targetHeight / 2,
        stroke: "#d9ab5e",
        strokeWidth: 4,
      });
    }

    (shape as unknown as { meta: ObjectMeta }).meta = {
      id: `shape-${Date.now()}`,
      name: `${type.toUpperCase()} Shape`,
      editable: true,
      locked: false,
      deletable: true,
      visible: true,
      category: "shape",
      aiGenerated: false,
    };

    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.renderAll();
  };

  const updateSelectedShape = (key: string, value: unknown) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const active = canvas.getActiveObject();
    if (active) {
      (active as unknown as { set: (k: string, v: unknown) => void }).set(key, value);
      canvas.renderAll();
      const safeVal = (key === "fill" || key === "stroke") ? (typeof value === "string" ? value : formatColorValue(value)) : value;
      setShapeProps((prev) => ({ ...prev, [key]: safeVal }));
      pushHistory();
    }
  };

  /* ---------------- Image Handling ---------------- */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const imgEl = new Image();
      imgEl.onload = () => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const fabImg = new fabric.FabricImage(imgEl);
        const maxDim = Math.min(targetWidth, targetHeight) * 0.4;
        const scale = Math.min(maxDim / fabImg.width!, maxDim / fabImg.height!);

        fabImg.set({
          left: targetWidth / 2 - (fabImg.width! * scale) / 2,
          top: targetHeight / 2 - (fabImg.height! * scale) / 2,
          scaleX: scale,
          scaleY: scale,
        });

        (fabImg as unknown as { meta: ObjectMeta }).meta = {
          id: `img-${Date.now()}`,
          name: file.name.slice(0, 18) || "Uploaded Image",
          editable: true,
          locked: false,
          deletable: true,
          visible: true,
          category: "image",
          aiGenerated: false,
        };

        canvas.add(fabImg);
        canvas.setActiveObject(fabImg);
        canvas.renderAll();
      };
      imgEl.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  /* ---------------- Object Alignment ---------------- */
  const alignObject = (position: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const active = canvas.getActiveObject();
    if (!active) return;

    const bounds = active.getBoundingRect();
    const left = position === "left"
      ? 40
      : position === "center"
        ? (targetWidth - bounds.width) / 2
        : position === "right"
          ? targetWidth - bounds.width - 40
          : bounds.left;
    const top = position === "top"
      ? 40
      : position === "middle"
        ? (targetHeight - bounds.height) / 2
        : position === "bottom"
          ? targetHeight - bounds.height - 40
          : bounds.top;
    active.set({
      left: (active.left || 0) + left - bounds.left,
      top: (active.top || 0) + top - bounds.top,
    });
    constrainObjectToCanvas(active);
    active.setCoords();
    canvas.renderAll();
    pushHistory();
  };

  /* ---------------- Layer Controls ---------------- */
  const toggleLock = (obj: fabric.FabricObject) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const isLocked = Boolean(obj.lockMovementX);
    obj.set({
      lockMovementX: !isLocked,
      lockMovementY: !isLocked,
      lockRotation: !isLocked,
      lockScalingX: !isLocked,
      lockScalingY: !isLocked,
    });
    canvas.renderAll();
    updateLayersList();
  };

  const toggleVisibility = (obj: fabric.FabricObject) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    obj.set("visible", !obj.visible);
    canvas.renderAll();
    updateLayersList();
  };

  const deleteObject = (obj?: fabric.FabricObject) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const target = obj || canvas.getActiveObject();
    if (target) {
      canvas.remove(target);
      canvas.discardActiveObject();
      canvas.renderAll();
      pushHistory();
    }
  };

  const bringForward = () => {
    const canvas = fabricCanvasRef.current;
    const active = canvas?.getActiveObject();
    if (canvas && active) {
      canvas.bringObjectForward(active);
      canvas.renderAll();
      updateLayersList();
    }
  };

  const sendBackward = () => {
    const canvas = fabricCanvasRef.current;
    const active = canvas?.getActiveObject();
    if (canvas && active) {
      canvas.sendObjectBackwards(active);
      canvas.renderAll();
      updateLayersList();
    }
  };

  /* ---------------- Reset to Original ---------------- */
  const resetToOriginal = async () => {
    if (!window.confirm("Are you sure you want to reset all modifications to the original design?")) return;
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    safeClear(canvas);

    const currentAsset = assetRef.current;
    const currentBrand = brandRef.current;

    populateDefaultFabricObjects(
      canvas,
      currentAsset.payload,
      currentBrand,
      currentAsset.aspect,
      currentAsset.kind,
      currentAsset.platform
    );

    if (currentAsset.payload.image) {
      try {
        const bgImage = await loadFabricImage(currentAsset.payload.image);
        const imgW = bgImage.width || 800;
        const imgH = bgImage.height || 600;

        const isWide =
          currentAsset.payload.layout === "wide" ||
          ["linkedin", "portal"].includes(currentAsset.platform) ||
          currentAsset.aspect === "16:9";

        if (isWide) {
          const panelW = Math.round(targetWidth * 0.46);
          const imgWAvail = targetWidth - panelW;
          const scale = Math.max(imgWAvail / imgW, targetHeight / imgH);
          bgImage.set({
            originX: "center",
            originY: "center",
            left: panelW + imgWAvail / 2,
            top: targetHeight / 2,
            scaleX: scale,
            scaleY: scale,
            selectable: true,
            evented: true,
          });
        } else {
          const scale = Math.max(targetWidth / imgW, targetHeight / imgH);
          bgImage.set({
            originX: "center",
            originY: "center",
            left: targetWidth / 2,
            top: targetHeight / 2,
            scaleX: scale,
            scaleY: scale,
            selectable: true,
            evented: true,
          });
        }

        (bgImage as unknown as { meta: ObjectMeta }).meta = {
          id: "bg-image",
          name: "🖼 Background Photo",
          editable: true,
          locked: false,
          deletable: false,
          visible: true,
          category: "background",
          aiGenerated: true,
        };

        canvas.insertAt(0, bgImage);
      } catch {}
    }

    constrainCanvasObjects(canvas);
    const curScale = effectiveScaleRef.current;
    canvas.setDimensions({
      width: Math.max(10, Math.round(targetWidth * curScale)),
      height: Math.max(10, Math.round(targetHeight * curScale)),
    });
    canvas.setZoom(curScale);
    canvas.renderAll();
    historyRef.current = [JSON.stringify(canvas.toJSON())];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
    updateLayersList();
  };

  /* ---------------- Save & Export Handlers ---------------- */
  const handleSaveDraft = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    setIsSaving(true);
    setSaveMessage("Saving design draft...");

    try {
      // Always send designJson as a string, not a plain object.
      // If it's stored as a raw object in the DB payload it gets passed back
      // as a React prop and causes "Objects are not valid as React child" errors.
      const designJson = JSON.stringify(canvas.toJSON());

      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_design",
          designJson,
        }),
      });

      if (!res.ok) throw new Error("Could not save design to database");

      const data = await res.json();
      setSaveMessage("Saved successfully!");
      if (data.payload) onSaveSuccess(data.payload);
      setTimeout(() => setSaveMessage(""), 2000);
    } catch (err) {
      console.error(err);
      setSaveMessage("Failed to save design");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportFinal = async (format: "png" | "jpeg") => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    setIsExporting(true);
    try {
      /* Deselect active object for clean export render */
      canvas.discardActiveObject();

      const prevZoom = canvas.getZoom();
      const prevW = canvas.getWidth();
      const prevH = canvas.getHeight();

      // Temporarily restore full 1:1 resolution for clean rasterization
      canvas.setZoom(1);
      canvas.setDimensions({ width: targetWidth, height: targetHeight });
      canvas.renderAll();

      const mime = format === "jpeg" ? "image/jpeg" : "image/png";
      const dataUrl = canvas.toDataURL({
        format: format === "jpeg" ? "jpeg" : "png",
        quality: 0.96,
        multiplier: 1,
      });

      // Immediately restore editor viewport dimensions and zoom
      canvas.setZoom(prevZoom);
      canvas.setDimensions({ width: prevW, height: prevH });
      canvas.renderAll();

      /* Convert to Blob */
      const parts = dataUrl.split(",");
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      const blob = new Blob([u8arr], { type: mime });

      /* Trigger browser download */
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${asset.title ? asset.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() : "creative"}-custom.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      /* Persist final design JSON as a string (not a raw object) */
      const designJson = JSON.stringify(canvas.toJSON());
      await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_design",
          designJson,
        }),
      });

      onClose();
    } catch (err) {
      console.error("Export error:", err);
      alert("Could not export final creative image.");
    } finally {
      setIsExporting(false);
    }
  };

  const activeMeta = selectedObject ? ((selectedObject as unknown as { meta?: ObjectMeta }).meta ?? null) : null;
  const isTextbox = selectedObject instanceof fabric.Textbox;
  const isShape = selectedObject instanceof fabric.Rect || selectedObject instanceof fabric.Circle;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0a08] text-cream select-none overflow-hidden">
      {/* ---------------- TOP BAR ---------------- */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-coal/90 px-5 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-mute hover:border-gold/50 hover:text-gold"
            title="Exit Editor"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-[13.5px] font-medium leading-none">{asset.title || "Custom Creative Editor"}</h2>
            <p className="mt-1 font-mono text-[9.5px] uppercase tracking-widest text-faint">
              Fabric.js Creative Studio · {asset.aspect} · {targetWidth}x{targetHeight}
            </p>
          </div>
        </div>

        {/* Center: Undo / Redo & Zoom Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-line bg-panel p-1">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="flex h-7 w-7 items-center justify-center rounded text-mute hover:text-gold disabled:opacity-30"
              title="Undo (Ctrl+Z)"
            >
              <Undo size={14} />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="flex h-7 w-7 items-center justify-center rounded text-mute hover:text-gold disabled:opacity-30"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo size={14} />
            </button>
          </div>

          <div className="h-4 w-px bg-line" />

          {/* Zoom controls */}
          <div className="flex items-center gap-1 rounded-lg border border-line bg-panel px-2 py-1 font-mono text-[11px] text-mute">
            <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))} className="hover:text-gold">-</button>
            <button onClick={() => setZoom(1)} className="px-1 hover:text-gold" title="Reset Zoom">
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))} className="hover:text-gold">+</button>
          </div>

          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={cx(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11.5px] font-medium transition-all",
              previewMode ? "border-gold bg-gold/15 text-gold" : "border-line text-mute hover:text-gold"
            )}
          >
            <Eye size={13} /> {previewMode ? "Back to Editor" : "Preview"}
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {saveMessage && <span className="font-mono text-[11px] text-gold">{saveMessage}</span>}
          <button
            onClick={resetToOriginal}
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[11.5px] text-mute hover:border-rust/50 hover:text-rust"
            title="Reset changes to initial generated asset"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3.5 py-1.5 text-[12px] font-medium text-cream hover:border-gold/50 hover:text-gold disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={13} className="spin-slow" /> : <Save size={13} />}
            Save Draft
          </button>
          <button
            onClick={() => handleExportFinal("png")}
            disabled={isExporting}
            className="btn-gold flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[12px] font-semibold disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={13} className="spin-slow" /> : <Download size={13} />}
            Confirm & Export
          </button>
        </div>
      </header>

      {/* ---------------- MAIN EDITOR BODY ---------------- */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* ---------------- LEFT NAVIGATION SIDEBAR ---------------- */}
        {!previewMode && (
          <aside className="flex w-16 shrink-0 flex-col items-center gap-4 border-r border-line bg-coal/80 py-5">
            {[
              { id: "text", label: "Text", icon: Type },
              { id: "shapes", label: "Shapes", icon: Square },
              { id: "images", label: "Images", icon: ImageIcon },
              { id: "brand", label: "Brand", icon: Palette },
              { id: "layers", label: "Layers", icon: Layers },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cx(
                  "flex flex-col items-center gap-1 rounded-xl p-2.5 transition-all",
                  activeTab === tab.id
                    ? "bg-gold/15 text-gold border border-gold/40"
                    : "text-faint hover:text-mute hover:bg-panel"
                )}
              >
                <tab.icon size={18} />
                <span className="font-mono text-[9px] uppercase tracking-wider">{tab.label}</span>
              </button>
            ))}
          </aside>
        )}

        {/* ---------------- LEFT SUB-PANEL ---------------- */}
        {!previewMode && (
          <aside className="w-72 shrink-0 border-r border-line bg-panel/70 p-5 overflow-y-auto">
            {activeTab === "text" && (
              <div className="space-y-5">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Typography Presets</h3>
                <p className="text-[11px] leading-relaxed text-faint">
                  To change existing copy, select its text on the canvas or choose it in Layers. These presets add new text.
                </p>
                <div className="space-y-2.5">
                  <button
                    onClick={() => addTextbox("HEADER TEXT", { fontSize: 52, fontWeight: "bold", fontFamily: "'Playfair Display', serif" })}
                    className="w-full rounded-xl border border-line bg-coal p-3.5 text-left transition-all hover:border-gold/50"
                  >
                    <div className="font-serif text-[20px] font-bold text-cream">Add Headline</div>
                    <div className="font-mono text-[9px] text-faint">Playfair Display · 52px</div>
                  </button>

                  <button
                    onClick={() => addTextbox("Subheading text line", { fontSize: 30, fontFamily: "Inter, sans-serif" })}
                    className="w-full rounded-xl border border-line bg-coal p-3.5 text-left transition-all hover:border-gold/50"
                  >
                    <div className="font-sans text-[15px] font-medium text-cream">Add Subheading</div>
                    <div className="font-mono text-[9px] text-faint">Inter · 30px</div>
                  </button>

                  <button
                    onClick={() => addTextbox("Body paragraph text for property specifications.", { fontSize: 22, fontFamily: "Inter, sans-serif" })}
                    className="w-full rounded-xl border border-line bg-coal p-3.5 text-left transition-all hover:border-gold/50"
                  >
                    <div className="font-sans text-[12px] text-mute">Add Body Text</div>
                    <div className="font-mono text-[9px] text-faint">Inter · 22px</div>
                  </button>
                </div>
              </div>
            )}

            {activeTab === "shapes" && (
              <div className="space-y-5">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Add Vector Shapes</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => addShape("rect")}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-line bg-coal p-4 hover:border-gold/50"
                  >
                    <Square size={24} className="text-gold" />
                    <span className="text-[11px]">Rectangle</span>
                  </button>
                  <button
                    onClick={() => addShape("rounded")}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-line bg-coal p-4 hover:border-gold/50"
                  >
                    <div className="h-6 w-10 rounded-full border-2 border-gold" />
                    <span className="text-[11px]">Pill Button</span>
                  </button>
                  <button
                    onClick={() => addShape("circle")}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-line bg-coal p-4 hover:border-gold/50"
                  >
                    <div className="h-6 w-6 rounded-full bg-gold" />
                    <span className="text-[11px]">Circle</span>
                  </button>
                  <button
                    onClick={() => addShape("line")}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-line bg-coal p-4 hover:border-gold/50"
                  >
                    <div className="h-0.5 w-10 bg-gold" />
                    <span className="text-[11px]">Divider Line</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === "images" && (
              <div className="space-y-5">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Media & Assets</h3>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-line bg-coal/60 p-6 text-center transition-all hover:border-gold/50">
                  <Upload size={22} className="text-gold" />
                  <span className="text-[12px] font-medium text-cream">Upload Custom Logo or Photo</span>
                  <span className="font-mono text-[9px] text-faint">PNG, JPG, SVG up to 10MB</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
            )}

            {activeTab === "brand" && (
              <div className="space-y-5">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Brand Palette</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: "Primary Gold", hex: "#d9ab5e" },
                    { label: "Deep Coal", hex: "#12100c" },
                    { label: "Alabaster White", hex: "#fffdf5" },
                    { label: "Sage Accent", hex: "#a3b18a" },
                    { label: "Warm Bronze", hex: "#b08b5e" },
                  ].map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => {
                        if (isTextbox) updateSelectedText("fill", c.hex);
                        else if (isShape) updateSelectedShape("fill", c.hex);
                      }}
                      className="flex items-center gap-2.5 rounded-xl border border-line bg-coal p-2.5 text-left hover:border-gold/50"
                    >
                      <span className="h-6 w-6 shrink-0 rounded-lg border border-line" style={{ background: c.hex }} />
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-medium">{c.label}</div>
                        <div className="font-mono text-[9px] text-faint">{c.hex}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "layers" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Canvas Layers</h3>
                  <span className="font-mono text-[10px] text-faint">{layersList.length} items</span>
                </div>
                <p className="text-[11px] leading-relaxed text-faint">
                  Select a text layer to edit its content, style, or position. Changes stay inside the image.
                </p>
                <div className="space-y-1.5">
                  {layersList.map((obj, i) => {
                    const meta = (obj as unknown as { meta?: ObjectMeta }).meta;
                    const isSelected = selectedObject === obj;
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          fabricCanvasRef.current?.setActiveObject(obj);
                          fabricCanvasRef.current?.renderAll();
                        }}
                        className={cx(
                          "flex items-center justify-between rounded-lg border px-3 py-2 text-[11.5px] cursor-pointer transition-all",
                          isSelected ? "border-gold bg-gold/15 text-gold" : "border-line bg-coal text-mute hover:text-cream"
                        )}
                      >
                        <span className="truncate max-w-[140px] font-medium">
                          {meta?.name ? String(meta.name) : String(obj.type || "Layer")}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleVisibility(obj); }}
                            className="p-1 text-faint hover:text-gold"
                          >
                            {obj.visible !== false ? <Eye size={12} /> : <EyeOff size={12} />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleLock(obj); }}
                            className="p-1 text-faint hover:text-gold"
                          >
                            {obj.lockMovementX ? <Lock size={12} /> : <LockOpen size={12} />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteObject(obj); }}
                            className="p-1 text-faint hover:text-rust"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>
        )}

        {/* ---------------- CENTER CANVAS VIEWPORT ---------------- */}
        <main
          ref={containerRef}
          className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#070605] p-6 select-none"
        >
          <div
            style={{
              width: `${Math.round(targetWidth * effectiveScale)}px`,
              height: `${Math.round(targetHeight * effectiveScale)}px`,
              position: "relative",
              boxShadow: "0 30px 100px rgba(0,0,0,0.85)",
              transition: "width 0.15s ease-out, height 0.15s ease-out",
            }}
            className="rounded-lg overflow-hidden border border-line/40 flex items-center justify-center bg-[#12100c]"
          >
            <canvas ref={canvasRef} />
          </div>
        </main>

        {/* ---------------- RIGHT PROPERTIES PANEL ---------------- */}
        {!previewMode && selectedObject && (
          <aside className="w-80 shrink-0 border-l border-line bg-panel/70 p-5 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
                {activeMeta?.name ? String(activeMeta.name) : "Object Properties"}
              </h3>
              <button onClick={() => deleteObject()} className="text-faint hover:text-rust" title="Delete Object">
                <Trash2 size={15} />
              </button>
            </div>

            {/* Alignment Shortcuts */}
            <div className="space-y-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-faint">Align on Canvas</span>
              <div className="grid grid-cols-3 gap-1.5">
                <button onClick={() => alignObject("left")} className="rounded-lg border border-line bg-coal py-1.5 text-[10px] text-mute hover:text-gold">Left</button>
                <button onClick={() => alignObject("center")} className="rounded-lg border border-line bg-coal py-1.5 text-[10px] text-mute hover:text-gold">Center</button>
                <button onClick={() => alignObject("right")} className="rounded-lg border border-line bg-coal py-1.5 text-[10px] text-mute hover:text-gold">Right</button>
                <button onClick={() => alignObject("top")} className="rounded-lg border border-line bg-coal py-1.5 text-[10px] text-mute hover:text-gold">Top</button>
                <button onClick={() => alignObject("middle")} className="rounded-lg border border-line bg-coal py-1.5 text-[10px] text-mute hover:text-gold">Middle</button>
                <button onClick={() => alignObject("bottom")} className="rounded-lg border border-line bg-coal py-1.5 text-[10px] text-mute hover:text-gold">Bottom</button>
              </div>
            </div>

            {/* Layer Depth */}
            <div className="space-y-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-faint">Layer Ordering</span>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={bringForward} className="rounded-lg border border-line bg-coal py-1.5 text-[11px] text-mute hover:text-gold">Bring Forward</button>
                <button onClick={sendBackward} className="rounded-lg border border-line bg-coal py-1.5 text-[11px] text-mute hover:text-gold">Send Backward</button>
              </div>
            </div>

            {/* TEXT SPECIFIC CONTROLS */}
            {isTextbox && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-mono text-[9px] uppercase tracking-widest text-faint">Content</label>
                  <textarea
                    value={textProps.text}
                    onChange={(e) => updateSelectedText("text", e.target.value)}
                    className="w-full rounded-lg border border-line bg-coal p-2.5 text-[12px] text-cream focus:border-gold outline-none"
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[9px] uppercase tracking-widest text-faint">Font Family</label>
                  <select
                    value={textProps.fontFamily}
                    onChange={(e) => updateSelectedText("fontFamily", e.target.value)}
                    className="w-full rounded-lg border border-line bg-coal p-2 text-[12px] text-cream focus:border-gold outline-none"
                  >
                    {FONT_LIBRARY.map((f) => (
                      <option key={f.name} value={f.family}>
                        {f.name} ({f.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-mono text-[9px] uppercase tracking-widest text-faint">Size</label>
                    <input
                      type="number"
                      value={textProps.fontSize}
                      onChange={(e) => updateSelectedText("fontSize", Number(e.target.value))}
                      className="w-full rounded-lg border border-line bg-coal p-2 text-[12px] text-cream outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-[9px] uppercase tracking-widest text-faint">Text Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={toHexColor(textProps.fill, "#ffffff")}
                        onChange={(e) => updateSelectedText("fill", e.target.value)}
                        className="h-8 w-8 cursor-pointer rounded border-none bg-transparent"
                      />
                      <span className="font-mono text-[11px] text-mute">{formatColorValue(textProps.fill)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-line bg-coal p-1">
                  <button
                    onClick={() => updateSelectedText("fontWeight", textProps.fontWeight === "bold" ? "normal" : "bold")}
                    className={cx("p-2 rounded text-faint hover:text-gold", textProps.fontWeight === "bold" && "bg-panel text-gold")}
                  >
                    <Bold size={14} />
                  </button>
                  <button
                    onClick={() => updateSelectedText("fontStyle", textProps.fontStyle === "italic" ? "normal" : "italic")}
                    className={cx("p-2 rounded text-faint hover:text-gold", textProps.fontStyle === "italic" && "bg-panel text-gold")}
                  >
                    <Italic size={14} />
                  </button>
                  <button
                    onClick={() => updateSelectedText("underline", !textProps.underline)}
                    className={cx("p-2 rounded text-faint hover:text-gold", textProps.underline && "bg-panel text-gold")}
                  >
                    <Underline size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* SHAPE SPECIFIC CONTROLS */}
            {isShape && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-mono text-[9px] uppercase tracking-widest text-faint">Fill Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={toHexColor(shapeProps.fill, "#d9ab5e")}
                      onChange={(e) => updateSelectedShape("fill", e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded border-none bg-transparent"
                    />
                    <span className="font-mono text-[11px] text-mute">{formatColorValue(shapeProps.fill)}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[9px] uppercase tracking-widest text-faint">Opacity</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={shapeProps.opacity}
                    onChange={(e) => updateSelectedShape("opacity", Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
