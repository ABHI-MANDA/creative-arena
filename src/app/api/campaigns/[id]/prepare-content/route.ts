import { NextResponse } from "next/server";
import { getCampaignBundle, getBrand, getAppSetting, setAppSetting } from "@/db/queries";
import {
  buildDraftAdContent,
  directionsFor,
  tryLLMOverride,
  type Brief,
} from "@/lib/creative/engine";
import { DEFAULT_TEMPLATE_LIBRARY, TEMPLATE_LIBRARY_KEY, type TemplateLibrary } from "@/lib/creative/template-library";
import { isFreeOpenRouterModel, resolveOpenRouterModel } from "@/lib/creative/models";

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
      : directionsFor(bundle.dna as Parameters<typeof directionsFor>[0], brief);
    const direction = options.find((o) => o.id === body.directionId) ?? options[0];

    const selection = body.model ?? (await getAppSetting(`campaign-model:${id}`, "auto"));
    if (selection !== "auto" && !(await isFreeOpenRouterModel(selection))) {
      return NextResponse.json(
        { error: "Choose a currently available free text model, or use Automatic." },
        { status: 400 }
      );
    }
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
      bundle.dna as Parameters<typeof tryLLMOverride>[1],
      bundle.campaign.preset,
      requestedModel,
      templateInstructions,
      direction
    );
    await setAppSetting(`campaign-model:${id}`, model);

    const draftContent = buildDraftAdContent(
      brief,
      bundle.dna as Parameters<typeof buildDraftAdContent>[1],
      direction,
      override,
      brand?.name
    );

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

