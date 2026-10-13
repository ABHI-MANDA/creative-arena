import { NextResponse } from "next/server";
import { listProperties, listCampaigns, listLibraryAssets } from "@/db/queries";

export const dynamic = "force-dynamic";

const QUICK_ACTIONS = [
  { label: "Create New Property", description: "Add a new real estate project or import website", href: "/properties/new", category: "Actions" },
  { label: "New Campaign", description: "Launch multi-platform ad generation", href: "/campaigns/new", category: "Actions" },
  { label: "Ad Creative Library", description: "Browse and export generated ads across all aspect ratios", href: "/assets", category: "Navigation" },
  { label: "Ad Templates", description: "Custom advertising format instructions & presets", href: "/templates", category: "Navigation" },
  { label: "Brand Kit & QC", description: "Brand tone, hex palette, and 11-point quality thresholds", href: "/brand", category: "Navigation" },
  { label: "Admin Console", description: "Operational metrics, cost telemetry, and generation logs", href: "/admin", category: "Navigation" },
  { label: "All Properties", description: "View full property portfolio", href: "/properties", category: "Navigation" },
  { label: "All Campaigns", description: "View all active and draft campaigns", href: "/campaigns", category: "Navigation" },
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();

    // Use memory-cached queries — zero redundant network egress to Neon
    const [propertiesList, campaignsList, assetsList] = await Promise.all([
      listProperties(),
      listCampaigns(),
      listLibraryAssets(),
    ]);

    if (!q) {
      // Return top recent items and actions when search query is empty
      return NextResponse.json(
        {
          query: "",
          properties: propertiesList.slice(0, 4).map((p) => ({
            id: p.property.id,
            name: p.property.name,
            location: p.property.location,
            propertyType: p.property.propertyType,
            price: p.property.price,
            cover: p.images[0]?.url,
            url: `/properties/${p.property.id}`,
          })),
          campaigns: campaignsList.slice(0, 4).map((c) => ({
            id: c.campaign.id,
            name: c.campaign.name,
            propertyName: c.propertyName,
            presetLabel: c.campaign.presetLabel,
            status: c.campaign.status,
            url: `/campaigns/${c.campaign.id}`,
          })),
          assets: assetsList.slice(0, 4).map((a) => ({
            id: a.asset.id,
            title: a.asset.title || `${a.asset.kind} · ${a.asset.aspect}`,
            kind: a.asset.kind,
            platform: a.asset.platform,
            aspect: a.asset.aspect,
            score: a.asset.score,
            campaignId: a.asset.campaignId,
            url: `/campaigns/${a.asset.campaignId}`,
          })),
          actions: QUICK_ACTIONS.slice(0, 4),
        },
        {
          headers: {
            "Cache-Control": "private, max-age=15, stale-while-revalidate=60",
          },
        }
      );
    }

    // Filter properties
    const matchedProperties = propertiesList
      .filter((p) => {
        const text = `${p.property.name} ${p.property.location} ${p.property.propertyType} ${p.property.price} ${p.property.amenities}`.toLowerCase();
        return text.includes(q);
      })
      .slice(0, 5)
      .map((p) => ({
        id: p.property.id,
        name: p.property.name,
        location: p.property.location,
        propertyType: p.property.propertyType,
        price: p.property.price,
        cover: p.images[0]?.url,
        url: `/properties/${p.property.id}`,
      }));

    // Filter campaigns
    const matchedCampaigns = campaignsList
      .filter((c) => {
        const text = `${c.campaign.name} ${c.propertyName} ${c.campaign.presetLabel} ${c.campaign.status}`.toLowerCase();
        return text.includes(q);
      })
      .slice(0, 5)
      .map((c) => ({
        id: c.campaign.id,
        name: c.campaign.name,
        propertyName: c.propertyName,
        presetLabel: c.campaign.presetLabel,
        status: c.campaign.status,
        url: `/campaigns/${c.campaign.id}`,
      }));

    // Filter assets
    const matchedAssets = assetsList
      .filter((a) => {
        const payload = (a.asset.payload || {}) as Record<string, unknown>;
        const text = `${a.asset.title} ${a.asset.kind} ${a.asset.platform} ${a.asset.aspect} ${a.propertyName} ${a.campaignName} ${payload.headline || ""} ${payload.subline || ""}`.toLowerCase();
        return text.includes(q);
      })
      .slice(0, 5)
      .map((a) => ({
        id: a.asset.id,
        title: a.asset.title || `${a.asset.kind} · ${a.asset.aspect}`,
        kind: a.asset.kind,
        platform: a.asset.platform,
        aspect: a.asset.aspect,
        score: a.asset.score,
        campaignId: a.asset.campaignId,
        url: `/campaigns/${a.asset.campaignId}`,
      }));

    // Filter actions
    const matchedActions = QUICK_ACTIONS.filter(
      (action) =>
        action.label.toLowerCase().includes(q) || action.description.toLowerCase().includes(q)
    );

    return NextResponse.json(
      {
        query: q,
        properties: matchedProperties,
        campaigns: matchedCampaigns,
        assets: matchedAssets,
        actions: matchedActions,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json({ error: "Failed to perform search" }, { status: 500 });
  }
}

