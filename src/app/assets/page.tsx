import { ensureSeed } from "@/db/seed";
import { getBrand, listLibraryAssets } from "@/db/queries";
import { AssetLibrary } from "./library";

export const dynamic = "force-dynamic";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const { property } = await searchParams;
  await ensureSeed();
  const [lib, brand] = await Promise.all([listLibraryAssets(), getBrand()]);

  const items = lib.map((l) => {
    // Strip designJson from the payload — it may contain serialised Fabric objects
    // (gradients, images) that React cannot render as children when passed as props.
    // The editor fetches the full asset separately when it is opened.
    const { designJson: _stripped, ...safePayload } = l.asset.payload as Record<string, unknown> & { designJson?: unknown };
    return {
      id: l.asset.id,
      kind: l.asset.kind,
      platform: l.asset.platform,
      aspect: l.asset.aspect,
      title: l.asset.title,
      payload: safePayload,
      score: l.asset.score,
      status: l.asset.status,
      approved: l.asset.approved,
      createdAt: l.asset.createdAt.toISOString(),
      campaignId: l.asset.campaignId,
      campaignName: l.campaignName,
      propertyId: l.asset.propertyId,
      propertyName: l.propertyName,
      preset: l.preset,
    };
  });

  return <AssetLibrary items={items} brand={brand} initialProperty={property ?? ""} />;
}
