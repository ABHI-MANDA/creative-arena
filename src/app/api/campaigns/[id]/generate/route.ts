import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, isLocalJsonDb } from "@/db";
import { assets, campaigns } from "@/db/schema";
import { updateLocalDatabase } from "@/db/local-json";
import {
  analyzeDNA,
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
import {
  AD_TEXT_SECTIONS,
  PLATFORM_KINDS,
  platformById,
  type AdTextSection,
  type BrandSettings,
} from "@/lib/creative/presets";
import { DEFAULT_TEMPLATE_LIBRARY, TEMPLATE_LIBRARY_KEY, type TemplateLibrary } from "@/lib/creative/template-library";
import { isFreeOpenRouterModel, resolveOpenRouterModel } from "@/lib/creative/models";
import { generateAdImage, aspectToSize } from "@/lib/creative/image-provider";
import { writeImagePrompts, type ImagePromptContext } from "@/lib/creative/image-prompt-writer";
import { getAppSetting, getBrand, getCampaignBundle, logGeneration, setAppSetting } from "@/db/queries";
import { invalidateCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

function resolveTypographyValues<T extends string | number>(
  requested: Partial<Record<AdTextSection, T>> | undefined,
  prepared: Partial<Record<AdTextSection, T>> | undefined,
  defaults: Record<AdTextSection, T>
): Record<AdTextSection, T> {
  const resolved = { ...defaults };
  for (const { key } of AD_TEXT_SECTIONS) {
    const value = requested?.[key];
    if (value !== undefined && value !== prepared?.[key]) {
      resolved[key] = value;
    }
  }
  return resolved;
}

/* ------------------------------------------------------------------ */
/* AI Image Pipeline                                                    */
/* Attempts: LLM prompt writing → image generation → compose           */
/* Never substitutes an existing property photo for a failed generation. */
/* ------------------------------------------------------------------ */
async function tryAIImagePipeline({
  brief,
  dna,
  direction,
  brand,
  platformIds,
  presetId,
  thresholds,
  override,
  approvedContent,
  enabledKinds,
  requestedModel,
  referenceWebsite,
  campaignId,
}: {
  brief: Brief;
  dna: NonNullable<
    NonNullable<Awaited<ReturnType<typeof getCampaignBundle>>>["dna"]
  >;
  
  direction: ReturnType<typeof directionsFor>[number];
  brand: BrandSettings;
  platformIds: string[];
  presetId: string;
  thresholds: { ready: number; review: number };
  override: Parameters<typeof composeAssets>[0]["override"];
  approvedContent?: ApprovedAdContent | null;
  enabledKinds: string[] | undefined;
  requestedModel: string | null;
  referenceWebsite?: string;
  campaignId: string;
}): Promise<NewAsset[]> {
  try {
    const visualKindsFor = (platform: string) => {
      const kinds = [...new Set(PLATFORM_KINDS[platform] ?? ["hero"])].filter(
        (kind) => kind !== "reel" && kind !== "copy"
      );
      return kinds.length ? kinds : ["hero"];
    };
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
      const platformSpec = platformById(platform);
      const promptContext: ImagePromptContext = {
        brandName: brand.name,
        brandColor: brand.color,
        brandTones: brand.tones,
        campaignPreset: presetId,
        aspectRatio: platformSpec.aspect,
        platform: platformSpec.label,
        approvedImagePrompt: approvedContent?.imagePrompt?.trim(),
        referenceWebsite,
        campaignId,
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
      const qualityByKind: Record<string, { score: number; prompt: string; model: string }> = {};
      for (const [index, result] of imageResults.entries()) {
        if (result.status === "rejected") {
          console.warn(`[ai-pipeline] Image generation failed for '${imageEntries[index]?.[0]}' at ${platformSpec.aspect}:`, result.reason);
          continue;
        }
        const { kind, prompt, img } = result.value;
        qualityByKind[kind] = { score: img.qualityScore, prompt, model: img.model };
        for (const label of KIND_LABELS_MAP[kind] ?? ["Exterior"]) aiImages.push({ url: img.url, label });
        console.log(`[ai-pipeline] Generated '${kind}' for ${platformSpec.aspect}: QC=${img.qualityScore} in ${img.durationMs}ms`);
      }

      if (imageResults.some((result) => result.status === "rejected")) {
        throw new Error(`Image generation failed for one or more ${platformSpec.aspect} ad formats.`);
      }

      const composed = composeAssets({
        brief,
        dna: dna as Parameters<typeof composeAssets>[0]["dna"],
        presetId,
        platformIds: [platform],
        direction,
        images: aiImages,
        thresholds,
        override,
        approvedContent,
        typographyDefaults: brand.typographyDefaults,
        enabledKinds,
        variant: 10,
      });
      return {
        generated: aiImages.length,
        assets: composed.map((asset) => {
          const quality = qualityByKind[asset.kind] ?? (asset.kind === "reel" ? qualityByKind.hero : undefined);
          if (asset.kind !== "copy" && !quality) {
            throw new Error(`No campaign-specific image was generated for '${asset.kind}' at ${platformSpec.aspect}.`);
          }
          return {
            ...asset,
            payload: {
              ...asset.payload,
              imageSource: "ai-generated" as const,
              imageGenPrompt: quality?.prompt,
              imageGenModel: quality?.model,
              imageQualityScore: quality?.score,
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
        throw new Error(`Image generation failed for platform '${platformIds[index]}'.`, { cause: result.reason });
      }
    }
    if (generatedCount === 0) {
      throw new Error("No campaign-specific images were generated; refusing to substitute existing property photos.");
    }
    const copyPack = composeAssets({
      brief,
      dna: dna as Parameters<typeof composeAssets>[0]["dna"],
      presetId,
      platformIds,
      direction,
      images: [],
      thresholds,
      override,
      approvedContent,
      typographyDefaults: brand.typographyDefaults,
      enabledKinds,
    }).find((asset) => asset.kind === "copy");
    if (copyPack) assetsByPlatform.push(copyPack);
    return assetsByPlatform;
  } catch (error) {
    console.error("[ai-pipeline] Campaign-specific image generation failed:", error);
    throw error;
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

    const liveDna = analyzeDNA(brief);
    const dna = bundle.dna
      ? { ...bundle.dna, architecture: liveDna.architecture, palette: liveDna.palette, paletteHex: liveDna.paletteHex }
      : liveDna;

    const options = bundle.campaign.options?.length
      ? bundle.campaign.options
      : directionsFor(dna as Parameters<typeof directionsFor>[0], brief);
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

    const preparedContent = await getAppSetting<ApprovedAdContent | null>(
      `campaign-draft-content:${id}`,
      null
    );
    const submittedContent = body.approvedContent ?? preparedContent;
    const approvedContent = submittedContent
      ? {
          ...submittedContent,
          fontSizes: resolveTypographyValues(
            submittedContent.fontSizes,
            preparedContent?.fontSizes,
            brand.typographyDefaults.fontSizes
          ),
          fontColors: resolveTypographyValues(
            submittedContent.fontColors,
            preparedContent?.fontColors,
            brand.typographyDefaults.fontColors
          ),
        }
      : null;
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
        dna as Parameters<typeof tryLLMOverride>[1],
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

    const platformIds = bundle.campaign.platforms ?? [];

    /* ---- AI Image Pipeline (Agnes AI / OpenRouter / FLUX) ---- */
    const imageModel =
      process.env.AGNES_MODEL?.trim().toLowerCase() ||
      process.env.IMAGE_MODEL?.trim().toLowerCase() ||
      (process.env.AGNES_API_KEY?.trim() ? "agnes-image-2.1-flash" : "black-forest-labs/FLUX.1-schnell:free");
    console.log(`[generate] Generating campaign-specific architecture with configured model: ${imageModel}`);
    const composed = await tryAIImagePipeline({
      brief,
      dna: bundle.dna as NonNullable<typeof bundle.dna>,
      direction,
      brand,
      platformIds,
      presetId: bundle.campaign.preset,
      thresholds: brand.thresholds,
      override,
      approvedContent,
      enabledKinds,
      requestedModel,
      referenceWebsite: p.sourceUrl,
      campaignId: id,
    });

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
    const visualModels = [...new Set(
      composed.map((asset) => asset.payload.imageGenModel).filter((value): value is string => Boolean(value))
    )];
    const visualModel = visualModels.join(", ") || imageModel;
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
      imagePipeline: "ai-generated",
      imageModel: visualModel,
    });
  } catch (e) {
    console.error(e);
    await logGeneration({ kind: "compose", model: "compose-engine-1.4", status: "failed" });
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
