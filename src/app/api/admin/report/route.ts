import { NextResponse } from "next/server";
import { db, isLocalJsonDb } from "@/db";
import { readLocalDatabase } from "@/db/local-json";
import { assets, campaigns, generations, properties } from "@/db/schema";
import { ensureSeed } from "@/db/seed";

export const dynamic = "force-dynamic";

type ReportRecord = {
  id: string;
  createdAt: string;
  type: "property" | "campaign" | "asset" | "generation";
  status: string;
  name: string;
  property: string;
  metric: string;
  details: string;
  costCents: number;
  durationMs: number;
  approved: boolean;
};

function safeIsoDate(val: unknown): string {
  if (!val) return new Date().toISOString();
  try {
    const d = new Date(val as string | number | Date);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function makeRecords(data: {
  properties: (typeof properties.$inferSelect)[];
  campaigns: (typeof campaigns.$inferSelect)[];
  assets: (typeof assets.$inferSelect)[];
  generations: (typeof generations.$inferSelect)[];
}): ReportRecord[] {
  const propertyNames = new Map(data.properties.map((property) => [property.id, property.name]));
  const campaignNames = new Map(data.campaigns.map((campaign) => [campaign.id, campaign.name]));

  return [
    ...data.properties.map((property): ReportRecord => {
      const propertyCampaigns = data.campaigns.filter((campaign) => campaign.propertyId === property.id);
      const propertyAssets = data.assets.filter((asset) => asset.propertyId === property.id);
      return {
        id: property.id,
        createdAt: safeIsoDate(property.createdAt),
        type: "property",
        status: property.status || "active",
        name: property.name || "Untitled Property",
        property: property.name || "Untitled Property",
        metric: `${propertyCampaigns.length} campaigns · ${propertyAssets.length} assets`,
        details: `Type: ${property.propertyType || ""}; Price: ${property.price || ""}; Audience: ${property.audience || ""}; Amenities: ${property.amenities || ""}; Description: ${property.description || ""}; Source: ${property.source || ""}`,
        costCents: 0,
        durationMs: 0,
        approved: false,
      };
    }),
    ...data.campaigns.map((campaign): ReportRecord => {
      const campaignAssets = data.assets.filter((asset) => asset.campaignId === campaign.id);
      const approved = campaignAssets.filter((asset) => asset.approved).length;
      const averageScore = campaignAssets.length
        ? Math.round(campaignAssets.reduce((sum, asset) => sum + (asset.score || 0), 0) / campaignAssets.length)
        : 0;
      const platformList = Array.isArray(campaign.platforms) ? campaign.platforms.join(", ") : String(campaign.platforms || "");
      return {
        id: campaign.id,
        createdAt: safeIsoDate(campaign.createdAt),
        type: "campaign",
        status: campaign.status || "active",
        name: campaign.name || "Untitled Campaign",
        property: propertyNames.get(campaign.propertyId) ?? "",
        metric: `${campaignAssets.length} assets · ${approved} approved · avg score ${averageScore}`,
        details: `Preset: ${campaign.presetLabel || ""}; Platforms: ${platformList}`,
        costCents: 0,
        durationMs: 0,
        approved: false,
      };
    }),
    ...data.assets.map((asset): ReportRecord => {
      const checksStr = Array.isArray(asset.checks)
        ? asset.checks.map((check) => `${check.label}=${check.pass ? "pass" : "fail"}`).join(", ")
        : "";
      return {
        id: asset.id,
        createdAt: safeIsoDate(asset.createdAt),
        type: "asset",
        status: asset.approved ? "approved" : (asset.status || "draft"),
        name: asset.title || `${asset.kind || "Asset"} · ${asset.platform || "Platform"}`,
        property: propertyNames.get(asset.propertyId) ?? "",
        metric: `Score ${asset.score ?? 0}/100 · ${asset.aspect || ""}`,
        details: `Campaign: ${campaignNames.get(asset.campaignId) ?? ""}; Kind: ${asset.kind || ""}; Platform: ${asset.platform || ""}; Approved: ${asset.approved}; Checks: ${checksStr}; Payload: ${JSON.stringify(asset.payload || {})}`,
        costCents: 0,
        durationMs: 0,
        approved: !!asset.approved,
      };
    }),
    ...data.generations.map((generation): ReportRecord => ({
      id: generation.id,
      createdAt: safeIsoDate(generation.createdAt),
      type: "generation",
      status: generation.status || "completed",
      name: generation.kind || "generation",
      property: generation.propertyId ? propertyNames.get(generation.propertyId) ?? "" : "",
      metric: `${generation.durationMs || 0} ms · ${((generation.costCents || 0) / 100).toFixed(2)} cost`,
      details: `Model: ${generation.model || ""}; Campaign: ${generation.campaignId ? campaignNames.get(generation.campaignId) ?? generation.campaignId : ""}; Cost: ${generation.costCents || 0} cents; Duration: ${generation.durationMs || 0} ms`,
      costCents: generation.costCents || 0,
      durationMs: generation.durationMs || 0,
      approved: false,
    })),
  ];
}

function csvCell(value: string | number | boolean) {
  const text = String(value);
  const safe = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  try {
    await ensureSeed();
    const data = isLocalJsonDb
      ? await readLocalDatabase((database) => ({
          properties: database.properties,
          campaigns: database.campaigns,
          assets: database.assets,
          generations: database.generations,
        }))
      : await Promise.all([
          db.select().from(properties),
          db.select().from(campaigns),
          db.select().from(assets),
          db.select().from(generations),
        ]).then(([propertyRows, campaignRows, assetRows, generationRows]) => ({
          properties: propertyRows,
          campaigns: campaignRows,
          assets: assetRows,
          generations: generationRows,
        }));

    const params = new URL(request.url).searchParams;
    const type = params.get("type") ?? "all";
    const status = params.get("status") ?? "all";
    const search = (params.get("q") ?? "").trim().toLowerCase();
    const from = params.get("from");
    const to = params.get("to");
    const fromTime = from ? Date.parse(`${from}T00:00:00.000Z`) : Number.NEGATIVE_INFINITY;
    const toTime = to ? Date.parse(`${to}T00:00:00.000Z`) + 86400000 : Number.POSITIVE_INFINITY;
    const records = makeRecords(data).filter((record) => {
      const time = new Date(record.createdAt).getTime();
      return (type === "all" || record.type === type)
        && (status === "all" || record.status === status)
        && time >= fromTime
        && time < toTime
        && (!search || `${record.name} ${record.property} ${record.details} ${record.type} ${record.status}`.toLowerCase().includes(search));
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (params.get("format") === "csv") {
      const columns: (keyof ReportRecord)[] = ["id", "createdAt", "type", "status", "name", "property", "metric", "details", "costCents", "durationMs", "approved"];
      const csv = [columns.join(","), ...records.map((record) => columns.map((column) => csvCell(record[column])).join(","))].join("\r\n");
      return new Response(`\uFEFF${csv}`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="creative-arena-report-${new Date().toISOString().slice(0, 10)}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({
      records,
      totals: {
        records: records.length,
        generations: records.filter((record) => record.type === "generation").length,
        failures: records.filter((record) => record.status === "failed").length,
        costCents: records.reduce((sum, record) => sum + record.costCents, 0),
        approvedAssets: records.filter((record) => record.type === "asset" && record.approved).length,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("admin report failed", error);
    return NextResponse.json({ error: "Could not load the admin report." }, { status: 500 });
  }
}