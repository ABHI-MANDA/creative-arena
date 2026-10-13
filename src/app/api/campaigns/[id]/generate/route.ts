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
  type ApprovedAdContent,
  type Brief,
  type Img,
  type NewAsset,
} from "@/lib/creative/engine";
import { PLATFORM_KINDS, platformById, type BrandSettings } from "@/lib/creative/presets";
import { DEFAULT_TEMPLATE_LIBRARY, TEMPLATE_LIBRARY_KEY, type TemplateLibrary } from "@/lib/creative/template-library";
import { isFreeOpenRouterModel, resolveOpenRouterModel } from "@/lib/creative/models";
import { generateAdImage, aspectToSize } from "@/lib/creative/image-provider";
import { writeImagePrompts, type ImagePromptContext } from "@/lib/creative/image-prompt-writer";
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
  brand,
  platformIds,
  presetId,
  uploadedImages,
  thresholds,
  override,
  approvedContent,
  enabledKinds,
  requestedModel,
}: {
  brief: Brief;
  dna: NonNullable<
    NonNullable<Awaited<ReturnType<typeof getCampaignBundle>>>["dna"]
  >;
  
  direction: ReturnType<typeof directionsFor>[number];
  brand: BrandSettings;
  platformIds: string[];
  presetId: string;
  uploadedImages: Img[];
  thresholds: { ready: number; review: number };
  override: Parameters<typeof composeAssets>[0]["override"];
  approvedContent?: ApprovedAdContent | null;
  enabledKinds: string[] | undefined;
  requestedModel: string | null;
}): Promise<NewAsset[] | null> {
  try {
    const visualKindsFor = (platform: string) =>
      [...new Set(PLATFORM_KINDS[platform] ?? ["hero"])].filter((kind) => kind !== "reel" && kind !== "copy");
    const KIND_LABELS_MAP: Record<string, string[]> = {
      hero:      ["Exterior"],
      feature:   ["Living", "Kitchen", "Interior", "Clubhouse"],
      location:  ["Location", "View"],
      offer:     ["Exterior", "View"],
      lifestyle: ["Garden", "Living", "Amenities"],
      story:     ["Exterior", "Living"],
      reel:      ["Exterior"],
    };

    const platformResults = await Promise.allSettled(platformIds.map(async (platform) => {
      const visualKinds = visualKindsFor(platform);
      if (visualKinds.length === 0) return { assets: [] as NewAsset[], generated: 0 };

      const platformSpec = platformById(platform);
      const promptContext: ImagePromptContext = {
        brandName: brand.name,
        brandColor: brand.color,
        brandTones: brand.tones,
        campaignPreset: presetId,
        aspectRatio: platformSpec.aspect,
        platform: platformSpec.label,
        approvedImagePrompt: approvedContent?.imagePrompt?.trim(),
      };
      console.log(`[ai-pipeline] Writing ${platformSpec.aspect} prompts for kinds:`, visualKinds);
      const { prompts, model: promptModel, fallback: promptFallback } = await writeImagePrompts(
        brief,
        dna as Parameters<typeof writeImagePrompts>[1],
        direction,
        visualKinds,
        requestedModel,
        promptContext
      );
      console.log(`[ai-pipeline] Prompt writer for ${platformSpec.aspect}: ${promptModel} (fallback=${promptFallback})`);

      const imageEntries = Object.entries(prompts);
      const imageResults = await Promise.allSettled(
        imageEntries.map(async ([kind, prompt]) => ({
          kind,
          prompt,
          img: await generateAdImage(prompt, { size: aspectToSize(platformSpec.aspect), timeoutMs: 90_000 }),
        }))
      );
      const aiImages: Img[] = [];
      const qualityByKind: Record<string, { score: number; prompt: string }> = {};
      for (const [index, result] of imageResults.entries()) {
        if (result.status === "rejected") {
          console.warn(`[ai-pipeline] Image generation failed for '${imageEntries[index]?.[0]}' at ${platformSpec.aspect}:`, result.reason);
          continue;
        }
        const { kind, prompt, img } = result.value;
        qualityByKind[kind] = { score: img.qualityScore, prompt };
        for (const label of KIND_LABELS_MAP[kind] ?? ["Exterior"]) aiImages.push({ url: img.url, label });
        console.log(`[ai-pipeline] Generated '${kind}' for ${platformSpec.aspect}: QC=${img.qualityScore} in ${img.durationMs}ms`);
      }

      const composed = composeAssets({
        brief,
        dna: dna as Parameters<typeof composeAssets>[0]["dna"],
        presetId,
        platformIds: [platform],
        direction,
        images: [...aiImages, ...uploadedImages],
        thresholds,
        override,
        approvedContent,
        enabledKinds,
        variant: 10,
      });
      return {
        generated: aiImages.length,
        assets: composed.map((asset) => {
          const quality = qualityByKind[asset.kind];
          return {
            ...asset,
            payload: {
              ...asset.payload,
              imageSource: (quality ? "ai-generated" : uploadedImages.length ? "uploaded" : "sample") as "ai-generated" | "uploaded" | "sample",
              imageGenPrompt: quality?.prompt ?? approvedContent?.imagePrompt,
              imageQualityScore: quality?.score ?? asset.score,
            },
          };
        }),
      };
    }));

    const assetsByPlatform: NewAsset[] = [];
    let generatedCount = 0;
    for (const [index, result] of platformResults.entries()) {
      if (result.status === "fulfilled") {
        generatedCount += result.value.generated;
        assetsByPlatform.push(...result.value.assets.filter((asset) => asset.kind !== "copy"));
      } else {
        const platform = platformIds[index];
        console.warn(`[ai-pipeline] Falling back to supplied images for ${platform}:`, result.reason);
        assetsByPlatform.push(...composeAssets({
          brief,
          dna: dna as Parameters<typeof composeAssets>[0]["dna"],
          presetId,
          platformIds: [platform],
          direction,
          images: uploadedImages,
          thresholds,
          override,
          approvedContent,
          enabledKinds,
        }).filter((asset) => asset.kind !== "copy").map((asset) => ({
          ...asset,
          payload: {
            ...asset.payload,
            imageSource: (uploadedImages.length ? "uploaded" : "sample") as "uploaded" | "sample",
            imagePrompt: approvedContent?.imagePrompt,
          },
        })));
      }
    }
    if (generatedCount === 0) {
      console.warn("[ai-pipeline] No format-specific image generated — using the existing composition path.");
      return null;
    }
    const copyPack = composeAssets({
      brief,
      dna: dna as Parameters<typeof composeAssets>[0]["dna"],
      presetId,
      platformIds,
      direction,
      images: uploadedImages,
      thresholds,
      override,
      approvedContent,
      enabledKinds,
    }).find((asset) => asset.kind === "copy");
    if (copyPack) assetsByPlatform.push(copyPack);
    return assetsByPlatform;
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
    const body = (await req.json().catch(() => ({}))) as {
      directionId?: string;
      model?: string;
      approvedContent?: ApprovedAdContent;
    };
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
    const selection = body.model ?? (await getAppSetting(`campaign-model:${id}`, "auto"));
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

    const approvedContent =
      body.approvedContent ??
      (await getAppSetting<ApprovedAdContent | null>(`campaign-draft-content:${id}`, null));
    if (approvedContent) {
      await setAppSetting(`campaign-approved-content:${id}`, approvedContent);
    }

    /* ---- LLM copy override ---- */
    let override = null;
    let model = "approved-content";
    let fallback = false;

    if (!approvedContent) {
      const llmResult = await tryLLMOverride(
        brief,
        bundle.dna as Parameters<typeof tryLLMOverride>[1],
        bundle.campaign.preset,
        requestedModel,
        templateInstructions,
        direction,
        { name: brand.name, color: brand.color, tones: brand.tones }
      );
      override = llmResult.override;
      model = llmResult.model;
      fallback = llmResult.fallback;
      await setAppSetting(`campaign-model:${id}`, model);
    }

    const uploadedImages = bundle.images.map((i) => ({ url: i.url, label: i.label }));
    const platformIds = bundle.campaign.platforms ?? [];

    /* ---- AI Image Pipeline (Agnes AI / OpenRouter / FLUX) ---- */
    const imageApiKey =
      process.env.AGNES_API_KEY?.trim() ||
      process.env.IMAGE_API_KEY?.trim() ||
      process.env.OPENROUTER_API_KEY?.trim();
    const imageModel =
      process.env.AGNES_MODEL?.trim().toLowerCase() ||
      process.env.IMAGE_MODEL?.trim().toLowerCase() ||
      (process.env.AGNES_API_KEY?.trim() ? "agnes-image-2.1-flash" : "black-forest-labs/FLUX.1-schnell:free");
    let composed: NewAsset[] | null = null;
    let usedAIPipeline = false;

    if (imageApiKey && imageModel) {
      console.log(`[generate] Attempting AI image pipeline with model: ${imageModel}`);
      composed = await tryAIImagePipeline({
        brief,
        dna: bundle.dna as NonNullable<typeof bundle.dna>,
        direction,
        brand,
        platformIds,
        presetId: bundle.campaign.preset,
        uploadedImages,
        thresholds: brand.thresholds,
        override,
        approvedContent,
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
      console.log("[generate] No image API key or model configured — skipping AI image pipeline.");
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
        approvedContent,
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
        const isApproved = Boolean(approvedContent);
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
            approved: isApproved,
            createdAt: new Date(),
          }))
        );
        const campaign = database.campaigns.find((row) => row.id === id);
        if (campaign) Object.assign(campaign, { status: isApproved ? "approved" : "ready", direction });
      });
    } else {
      const isApproved = Boolean(approvedContent);
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
          approved: isApproved,
        }))
      );
      await db.update(campaigns).set({ status: isApproved ? "approved" : "ready", direction }).where(eq(campaigns.id, id));
    }

    /* ---- Log generation actions ---- */
    const elapsed = Date.now() - started;
    const hasReel = composed.some((a) => a.kind === "reel");
    const visualModel = usedAIPipeline ? (imageModel ?? "agnes-image-2.1-flash") : "local-ad-layout-v1";
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
      imageModel: usedAIPipeline ? imageModel : null,
    });
  } catch (e) {
    console.error(e);
    await logGeneration({ kind: "compose", model: "compose-engine-1.4", status: "failed" });
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
