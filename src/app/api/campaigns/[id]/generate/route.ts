import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, isLocalJsonDb } from "@/db";
import { assets, campaigns } from "@/db/schema";
import { updateLocalDatabase } from "@/db/local-json";
import {
  composeAssets,
  directionsFor,
  hx,
  tryLLMOverride,
  type Brief,
} from "@/lib/creative/engine";
import { DEFAULT_TEMPLATE_LIBRARY, TEMPLATE_LIBRARY_KEY, type TemplateLibrary } from "@/lib/creative/template-library";
import { isFreeOpenRouterModel, resolveOpenRouterModel } from "@/lib/creative/models";
import { getAppSetting, getBrand, getCampaignBundle, logGeneration, setAppSetting } from "@/db/queries";

export const dynamic = "force-dynamic";

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
      : directionsFor(bundle.dna, brief);
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
    const { override, model, fallback } = await tryLLMOverride(
      brief,
      bundle.dna,
      bundle.campaign.preset,
      requestedModel,
      templateInstructions,
      direction
    );
    await setAppSetting(`campaign-model:${id}`, model);

    const composed = composeAssets({
      brief,
      dna: bundle.dna,
      presetId: bundle.campaign.preset,
      platformIds: bundle.campaign.platforms ?? [],
      direction,
      images: bundle.images.map((i) => ({ url: i.url, label: i.label })),
      thresholds: brand.thresholds,
      override,
      enabledKinds,
    });

    if (isLocalJsonDb) {
      await updateLocalDatabase((database) => {
        database.assets = database.assets.filter((asset) => asset.campaignId !== id);
        database.assets.push(
          ...composed.map((asset) => ({
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

    const elapsed = Date.now() - started;
    const hasReel = composed.some((a) => a.kind === "reel");
    await logGeneration({ kind: "visual", model: "local-ad-layout-v1", durationMs: 1200 + (hx(id) % 2400), costCents: 0, campaignId: id, propertyId: p.id });
    await logGeneration({ kind: "compose", model, durationMs: Math.max(400, elapsed), costCents: 6, campaignId: id, propertyId: p.id });
    if (hasReel) await logGeneration({ kind: "video-script", model, durationMs: Math.max(400, elapsed), costCents: 0, campaignId: id, propertyId: p.id });
    await logGeneration({ kind: "qc", model: "qc-heuristics-1.1", durationMs: 210 + composed.length * 18, costCents: 2, campaignId: id, propertyId: p.id });

    return NextResponse.json({ ok: true, count: composed.length, model, requestedModel, fallback, videoOutput: "storyboard-script" });
  } catch (e) {
    console.error(e);
    await logGeneration({ kind: "compose", model: "compose-engine-1.4", status: "failed" });
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
