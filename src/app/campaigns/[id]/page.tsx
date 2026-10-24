import { notFound } from "next/navigation";
import { ensureSeed } from "@/db/seed";
import { getBrand, getCampaignBundle, listCampaignActions } from "@/db/queries";
import { directionsFor } from "@/lib/creative/engine";
import { CampaignWorkspace } from "./workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fresh?: string }>;
}) {
  const { id } = await params;
  const { fresh } = await searchParams;
  await ensureSeed();
  const [bundle, brand, actions] = await Promise.all([getCampaignBundle(id), getBrand(), listCampaignActions(id)]);
  if (!bundle) notFound();

  const { campaign, property, images, assets } = bundle;
  const contentModel = bundle.usedModel ??
    (bundle.selectedModel && bundle.selectedModel !== "auto"
      ? bundle.selectedModel
      : actions.find((action) => action.kind === "compose" || action.kind === "video-script")?.model ?? "Not generated yet");

  const brief = {
    name: property.name,
    location: property.location,
    propertyType: property.propertyType,
    price: property.price,
    audience: property.audience,
    amenities: property.amenities,
    description: property.description,
  };
  const directions = (campaign.options && campaign.options.length > 0)
    ? campaign.options
    : (bundle.dna ? directionsFor(bundle.dna, brief) : []);

  return (
    <CampaignWorkspace
      fresh={fresh === "1"}
      brand={brand}
      campaign={{
        id: campaign.id,
        name: campaign.name,
        preset: campaign.preset,
        presetLabel: campaign.presetLabel,
        platforms: campaign.platforms ?? [],
        status: campaign.status,
        options: directions,
        direction: campaign.direction ?? directions[0] ?? null,
        model: contentModel,
      }}
      property={{
        id: property.id,
        name: property.name,
        location: property.location,
        propertyType: property.propertyType,
        price: property.price,
      }}
      images={images.map((i) => i.url)}
      actions={actions.map((action) => ({
        id: action.id,
        kind: action.kind,
        model: action.model,
        status: action.status,
        createdAt: new Date(action.createdAt).toISOString(),
      }))}
      assets={assets.map((a) => {
        const { designJson: _stripped, ...safePayload } = a.payload as Record<string, unknown> & { designJson?: unknown };
        return {
          id: a.id,
          kind: a.kind,
          platform: a.platform,
          aspect: a.aspect,
          title: a.title,
          payload: safePayload,
          score: a.score,
          checks: a.checks,
          status: a.status,
          approved: a.approved,
        };
      })}
    />
  );
}
