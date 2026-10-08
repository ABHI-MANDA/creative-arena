import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, isLocalJsonDb } from "@/db";
import { assets, campaigns } from "@/db/schema";
import { updateLocalDatabase } from "@/db/local-json";
import {
  composeAssets,
  directionsFor,
  hx,
  imageFor,
  tryLLMOverride,
  type Brief,
  type Img,
  type NewAsset,
} from "@/lib/creative/engine";
import { PLATFORM_KINDS, platformById } from "@/lib/creative/presets";
import { DEFAULT_TEMPLATE_LIBRARY, TEMPLATE_LIBRARY_KEY, type TemplateLibrary } from "@/lib/creative/template-library";
import { isFreeOpenRouterModel, resolveOpenRouterModel } from "@/lib/creative/models";
import { generateAdImage, aspectToSize } from "@/lib/creative/image-provider";
import { writeImagePrompts } from "@/lib/creative/image-prompt-writer";
import { getAppSetting, getBrand, getCampaignBundle, logGeneration, setAppSetting } from "@/db/queries";
import { invalidateCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/* AI Image Pipeline                                                    */
/* Attempts: LLM prompt writing → FLUX image generation → compose      */
/* Returns null on any failure so the caller can fall back.            */
/* ------------------------------------------------------------------ */
async function tryAIImagePipeline({
  brief,
  dna,
  direction,
  platformIds,
  presetId,
  uploadedImages,
  thresholds,
  override,
  enabledKinds,
  requestedModel,
}: {
  brief: Brief;
  dna: NonNullable<
    NonNullable<Awaited<ReturnType<typeof getCampaignBundle>>>["dna"]
  >;
  
  direction: ReturnType<typeof directionsFor>[number];
  platformIds: string[];
  presetId: string;
  uploadedImages: Img[];
  thresholds: { ready: number; review: number };
  override: Parameters<typeof composeAssets>[0]["override"];
  enabledKinds: string[] | undefined;
  requestedModel: string | null;
}): Promise<NewAsset[] | null> {
  try {
    /* 1. Determine which visual ad kinds are needed (exclude reel & copy — no static image needed) */
    const visualKinds = [...new Set(
      platformIds.flatMap((p) => (PLATFORM_KINDS[p] ?? ["hero"]))
    )].filter((k) => k !== "reel" && k !== "copy");

    if (visualKinds.length === 0) return null;

    /* 2. LLM writes optimised image-generation prompts for each kind */
    console.log("[ai-pipeline] Writing image prompts for kinds:", visualKinds);
    const { prompts, model: promptModel, fallback: promptFallback } = await writeImagePrompts(
      brief, dna as Parameters<typeof writeImagePrompts>[1], direction, visualKinds, requestedModel
    );
    console.log(`[ai-pipeline] Prompt writer: ${promptModel} (fallback=${promptFallback})`);

    /* 3. Generate images in parallel — one per unique kind */
    /* Use square size for best compatibility across models */
    const imageGenEntries = Object.entries(prompts);
    const imageResults = await Promise.allSettled(
      imageGenEntries.map(async ([kind, prompt]) => {
        /* Determine the best size for this kind's typical platform */
        const typicalPlatform = platformIds.find((p) => (PLATFORM_KINDS[p] ?? []).includes(kind));
        const aspect = typicalPlatform ? platformById(typicalPlatform).aspect : "1:1";
        const size = aspectToSize(aspect);
        const img = await generateAdImage(prompt, { size, timeoutMs: 90_000 });
        return { kind, prompt, img };
      })
    );

    /* 4. Collect successful image generations */
    /* Map each generated image to the label keywords composeAssets uses for imageFor() */
    const KIND_LABELS_MAP: Record<string, string[]> = {
      hero:      ["Exterior"],
      feature:   ["Living", "Kitchen", "Interior", "Clubhouse"],
      location:  ["Location", "View"],
      offer:     ["Exterior", "View"],
      lifestyle: ["Garden", "Living", "Amenities"],
      story:     ["Exterior", "Living"],
      reel:      ["Exterior"],
    };

    const aiImages: Img[] = [];
    const kindQualityMap: Record<string, { score: number; prompt: string }> = {};

    for (const result of imageResults) {
      if (result.status === "fulfilled") {
        const { kind, img } = result.value;
        kindQualityMap[kind] = { score: img.qualityScore, prompt: img.prompt };
        const labels = KIND_LABELS_MAP[kind] ?? ["Exterior"];
        for (const label of labels) {
          aiImages.push({ url: img.url, label });
        }
        console.log(`[ai-pipeline] Generated image for '${kind}': QC=${img.qualityScore} in ${img.durationMs}ms`);
      } else {
        console.warn(`[ai-pipeline] Image generation failed for kind '${imageGenEntries.find((_, i) => i === imageResults.indexOf(result))?.[0]}':`, result.reason);
      }
    }

    if (aiImages.length === 0) {
      console.warn("[ai-pipeline] All image generation attempts failed — falling back.");
      return null;
    }

    /* 5. Compose assets — AI images take priority; uploaded photos fill any gaps */
    const mergedImages = [...aiImages, ...uploadedImages];
    const composed = composeAssets({
      brief,
      dna: dna as Parameters<typeof composeAssets>[0]["dna"],
      presetId,
      platformIds,
      direction,
      images: mergedImages,
      thresholds,
      override,
      enabledKinds,
      variant: 10, // offset from 0 so AI variant is distinguishable
    });

    /* 6. Tag each asset with its image origin and quality score */
    return composed.map((asset) => {
      const qi = kindQualityMap[asset.kind];
      return {
        ...asset,
        payload: {
          ...asset.payload,
          imageSource: (qi ? "ai-generated" : "uploaded") as "ai-generated" | "uploaded" | "sample",
          imageGenPrompt: qi?.prompt,
          imageQualityScore: qi?.score ?? asset.score,
        },
      };
    });
  } catch (error) {
    console.error("[ai-pipeline] Pipeline threw an unhandled error — falling back:", error);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/campaigns/[id]/generate                                   */
/* ------------------------------------------------------------------ */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { directionId?: string; model?: string };
    const bundle = await getCampaignBundle(id);
    if (!bundle) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (!bundle.dna) return NextResponse.json({ error: "Run property analysis first." }, { status: 400 });

    const brand = await getBrand();
    const p = bundle.property;
    const brief: Brief = {
      name: p.name,
      location: p.location,
      propertyType: p.propertyType,
      price: p.price,
      audience: p.audience,
      amenities: p.amenities,
      description: p.description,
    };

    const options = bundle.campaign.options?.length
      ? bundle.campaign.options
      : directionsFor(bundle.dna as Parameters<typeof directionsFor>[0], brief);
    const direction = options.find((o) => o.id === body.directionId) ?? options[0];

    const started = Date.now();
    const selection = body.model ?? await getAppSetting(`campaign-model:${id}`, "auto");
    if (selection !== "auto" && !(await isFreeOpenRouterModel(selection))) {
      return NextResponse.json({ error: "Choose a currently available free text model, or use Automatic." }, { status: 400 });
    }
    const requestedModel = await resolveOpenRouterModel(selection);
    const templateLibrary = await getAppSetting<TemplateLibrary>(TEMPLATE_LIBRARY_KEY, DEFAULT_TEMPLATE_LIBRARY);
    const enabledKinds = templateLibrary.enabledKinds;
    const templateInstructions = templateLibrary.customTemplates
      .filter((template) => bundle.campaign.platforms.some((platform) => template.platforms.length === 0 || template.platforms.includes(platform)))
      .map((template) => `${template.kind}: ${template.name}. ${template.instructions}`)
      .join("\n");

    /* ---- LLM copy override (existing, unchanged) ---- */
    const { override, model, fallback } = await tryLLMOverride(
      brief,
      bundle.dna as Parameters<typeof tryLLMOverride>[1],
      bundle.campaign.preset,
      requestedModel,
      templateInstructions,
      direction
    );
    await setAppSetting(`campaign-model:${id}`, model);

    const uploadedImages = bundle.images.map((i) => ({ url: i.url, label: i.label }));
    const platformIds = bundle.campaign.platforms ?? [];

    /* ---- NEW: try AI image pipeline first ---- */
    const imageApiKey = process.env.IMAGE_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim();
    const imageModel  = process.env.IMAGE_MODEL?.trim();
    let composed: NewAsset[] | null = null;
    let usedAIPipeline = false;

    if (imageApiKey && imageModel) {
      console.log(`[generate] Attempting AI image pipeline with model: ${imageModel}`);
      composed = await tryAIImagePipeline({
        brief,
        dna: bundle.dna as NonNullable<typeof bundle.dna>,
        direction,
        platformIds,
        presetId: bundle.campaign.preset,
        uploadedImages,
        thresholds: brand.thresholds,
        override,
        enabledKinds,
        requestedModel,
      });
      if (composed) {
        usedAIPipeline = true;
        console.log(`[generate] AI image pipeline succeeded: ${composed.length} assets`);
      } else {
        console.warn("[generate] AI image pipeline returned null — using existing approach.");
      }
    } else {
      console.log("[generate] IMAGE_MODEL not configured — skipping AI image pipeline.");
    }

    /* ---- FALLBACK: existing deterministic approach ---- */
    if (!composed) {
      composed = composeAssets({
        brief,
        dna: bundle.dna as Parameters<typeof composeAssets>[0]["dna"],
        presetId: bundle.campaign.preset,
        platformIds,
        direction,
        images: uploadedImages,
        thresholds: brand.thresholds,
        override,
        enabledKinds,
      });
      // Tag as uploaded source
      composed = composed.map((asset) => ({
        ...asset,
        payload: { ...asset.payload, imageSource: "uploaded" as const },
      }));
    }

    /* ---- Persist assets (unchanged logic) ---- */
    if (isLocalJsonDb) {
      await updateLocalDatabase((database) => {
        database.assets = database.assets.filter((asset) => asset.campaignId !== id);
        database.assets.push(
          ...composed!.map((asset) => ({
            id: crypto.randomUUID(),
            campaignId: id,
            propertyId: p.id,
            kind: asset.kind,
            platform: asset.platform,
            aspect: asset.aspect,
            title: asset.title,
            payload: asset.payload,
            score: asset.score,
            checks: asset.checks,
            status: asset.status,
            approved: false,
            createdAt: new Date(),
          }))
        );
        const campaign = database.campaigns.find((row) => row.id === id);
        if (campaign) Object.assign(campaign, { status: "ready", direction });
      });
    } else {
      await db.delete(assets).where(eq(assets.campaignId, id));
      await db.insert(assets).values(
        composed.map((asset) => ({
          campaignId: id,
          propertyId: p.id,
          kind: asset.kind,
          platform: asset.platform,
          aspect: asset.aspect,
          title: asset.title,
          payload: asset.payload,
          score: asset.score,
          checks: asset.checks,
          status: asset.status,
        }))
      );
      await db.update(campaigns).set({ status: "ready", direction }).where(eq(campaigns.id, id));
    }

    /* ---- Log generation actions ---- */
    const elapsed = Date.now() - started;
    const hasReel = composed.some((a) => a.kind === "reel");
    const visualModel = usedAIPipeline ? (process.env.IMAGE_MODEL ?? "flux") : "local-ad-layout-v1";
    await logGeneration({ kind: "visual", model: visualModel, durationMs: 1200 + (hx(id) % 2400), costCents: 0, campaignId: id, propertyId: p.id });
    await logGeneration({ kind: "compose", model, durationMs: Math.max(400, elapsed), costCents: 6, campaignId: id, propertyId: p.id });
    if (hasReel) await logGeneration({ kind: "video-script", model, durationMs: Math.max(400, elapsed), costCents: 0, campaignId: id, propertyId: p.id });
    await logGeneration({ kind: "qc", model: "qc-heuristics-1.1", durationMs: 210 + composed.length * 18, costCents: 2, campaignId: id, propertyId: p.id });

    invalidateCache("assets");
    invalidateCache("campaigns");
    invalidateCache(`campaign:bundle:${id}`);
    invalidateCache("dashboard");
    invalidateCache("admin");

    return NextResponse.json({
      ok: true,
      count: composed.length,
      model,
      requestedModel,
      fallback,
      videoOutput: "storyboard-script",
      imagePipeline: usedAIPipeline ? "ai-generated" : "uploaded",
      imageModel: usedAIPipeline ? process.env.IMAGE_MODEL : null,
    });
  } catch (e) {
    console.error(e);
    await logGeneration({ kind: "compose", model: "compose-engine-1.4", status: "failed" });
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
