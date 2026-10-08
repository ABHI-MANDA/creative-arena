import { NextResponse } from "next/server";
import { db, isLocalJsonDb } from "@/db";
import { campaigns } from "@/db/schema";
import { updateLocalDatabase } from "@/db/local-json";
import { analyzeDNA, directionsFor } from "@/lib/creative/engine";
import { PRESETS, presetById } from "@/lib/creative/presets";
import { getProperty, listCampaigns, logGeneration, setAppSetting } from "@/db/queries";
import { ensureSeed } from "@/db/seed";
import { invalidateCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  return NextResponse.json(await listCampaigns());
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { propertyId?: string; presetId?: string; platforms?: string[]; model?: string };
    if (!body.propertyId) return NextResponse.json({ error: "Choose a property first." }, { status: 400 });
    const platforms = (body.platforms ?? []).filter(Boolean);
    if (!platforms.length) return NextResponse.json({ error: "Pick at least one platform." }, { status: 400 });

    const bundle = await getProperty(body.propertyId);
    if (!bundle) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    const preset = presetById(body.presetId ?? "luxury-property");
    const brief = {
      name: bundle.property.name,
      location: bundle.property.location,
      propertyType: bundle.property.propertyType,
      price: bundle.property.price,
      audience: bundle.property.audience,
      amenities: bundle.property.amenities,
      description: bundle.property.description,
    };
    const dna = bundle.dna ?? analyzeDNA(brief);
    const directions = directionsFor(dna, brief);

    const campaignId = isLocalJsonDb
      ? await updateLocalDatabase((database) => {
          const id = crypto.randomUUID();
          database.campaigns.push({
            id,
            propertyId: bundle.property.id,
            name: `${bundle.property.name} — ${preset.label}`,
            preset: preset.id,
            presetLabel: preset.label,
            platforms,
            options: directions,
            direction: null,
            status: "draft",
            createdAt: new Date(),
          });
          return id;
        })
      : await db
          .insert(campaigns)
          .values({
            propertyId: bundle.property.id,
            name: `${bundle.property.name} — ${preset.label}`,
            preset: preset.id,
            presetLabel: preset.label,
            platforms,
            options: directions,
            status: "draft",
          })
          .returning({ id: campaigns.id })
          .then(([campaign]) => campaign.id);

    await logGeneration({ kind: "directions", model: "local-direction-planner-v1", durationMs: 1400, costCents: 0, campaignId, propertyId: bundle.property.id });
    if (body.model) await setAppSetting(`campaign-model:${campaignId}`, body.model);

    invalidateCache("campaigns");
    invalidateCache("dashboard");
    invalidateCache("admin");

    return NextResponse.json({ id: campaignId, directions, presets: PRESETS.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to plan campaign." }, { status: 500 });
  }
}
