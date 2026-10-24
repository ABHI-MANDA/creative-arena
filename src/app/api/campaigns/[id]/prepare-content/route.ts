import { NextResponse } from "next/server";
import { getCampaignBundle, getBrand, getAppSetting, setAppSetting } from "@/db/queries";
import {
  analyzeDNA,
  buildDraftAdContent,
  directionsFor,
  tryLLMOverride,
  type Brief,
} from "@/lib/creative/engine";
import { DEFAULT_TEMPLATE_LIBRARY, TEMPLATE_LIBRARY_KEY, type TemplateLibrary } from "@/lib/creative/template-library";
import { isFreeOpenRouterModel, resolveOpenRouterModel } from "@/lib/creative/models";
import { DEFAULT_SCRIM_SETTINGS } from "@/lib/creative/style-config";

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

    const liveDna = analyzeDNA(brief);
    const dna = bundle.dna
      ? { ...bundle.dna, architecture: liveDna.architecture, palette: liveDna.palette, paletteHex: liveDna.paletteHex }
      : liveDna;

    const options = bundle.campaign.options?.length
      ? bundle.campaign.options
      : directionsFor(dna as Parameters<typeof directionsFor>[0], brief);
    const direction = options.find((o) => o.id === body.directionId) ?? options[0];

    const savedSelection = await getAppSetting(`campaign-model:${id}`, "auto");
    let selection = body.model ?? savedSelection;
    if (selection !== "auto" && !(await isFreeOpenRouterModel(selection))) {
      if (body.model !== undefined) {
        return NextResponse.json(
          { error: "Choose a currently available free text model, or use Automatic." },
          { status: 400 }
        );
      }
      selection = "auto";
    }
    await setAppSetting(`campaign-model:${id}`, selection);
    const requestedModel = await resolveOpenRouterModel(selection);

    const templateLibrary = await getAppSetting<TemplateLibrary>(TEMPLATE_LIBRARY_KEY, DEFAULT_TEMPLATE_LIBRARY);
    const templateInstructions = templateLibrary.customTemplates
      .filter((template) =>
        bundle.campaign.platforms.some(
          (platform) => template.platforms.length === 0 || template.platforms.includes(platform)
        )
      )
      .map((template) => `${template.kind}: ${template.name}. ${template.instructions}`)
      .join("\n");

    const { override, model } = await tryLLMOverride(
      brief,
      dna as Parameters<typeof tryLLMOverride>[1],
      bundle.campaign.preset,
      requestedModel,
      templateInstructions,
      direction,
      { name: brand.name, color: brand.color, tones: brand.tones }
    );
    await setAppSetting(`campaign-model-used:${id}`, model);
    const draftContent = buildDraftAdContent(
      brief,
      dna as Parameters<typeof buildDraftAdContent>[1],
      direction,
      override,
      brand?.name,
      bundle.campaign.preset
    );
    draftContent.fontSizes = brand.typographyDefaults.fontSizes;
    draftContent.fontColors = brand.typographyDefaults.fontColors;
    draftContent.scrimSettings = DEFAULT_SCRIM_SETTINGS;

    await setAppSetting(`campaign-draft-content:${id}`, draftContent);

    return NextResponse.json({
      ok: true,
      content: draftContent,
      directionId: direction.id,
      directionName: direction.name,
      model,
    });
  } catch (error) {
    console.error("[prepare-content] Failed to draft ad content:", error);
    return NextResponse.json({ error: "Failed to prepare ad content for review." }, { status: 500 });
  }
}
