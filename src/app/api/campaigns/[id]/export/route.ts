import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { readLocalDatabase } from "@/db/local-json";
import { isLocalJsonDb } from "@/db";

export const dynamic = "force-dynamic";

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "campaign";
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isLocalJsonDb) {
    return Response.json({ error: "Server-side package export is enabled only in local JSON mode." }, { status: 501 });
  }

  const { id } = await params;
  if (!/^[\da-f-]{36}$/i.test(id)) return Response.json({ error: "Invalid campaign ID." }, { status: 400 });

  const campaignData = await readLocalDatabase((database) => {
    const campaign = database.campaigns.find((row) => row.id === id);
    if (!campaign) return null;
    const property = database.properties.find((row) => row.id === campaign.propertyId);
    if (!property) return null;
    const brand = database.settings.find((row) => row.key === "brand")?.value ?? null;
    return {
      campaign,
      property,
      brand,
      assets: database.assets.filter((row) => row.campaignId === id),
    };
  });
  if (!campaignData) return Response.json({ error: "Campaign not found." }, { status: 404 });

  const stills = campaignData.assets.filter((asset) => asset.kind !== "reel" && asset.kind !== "copy");
  const reels = campaignData.assets.filter((asset) => asset.kind === "reel");
  if (stills.some((asset) => !asset.payload.exportFiles?.png)) {
    return Response.json({ error: "Render all still images before creating the package." }, { status: 409 });
  }

  try {
    const zip = new JSZip();
    const imageFiles = new Map<string, string>();
    for (const asset of stills) {
      const fileName = `images/${safeFileName(asset.title)}-${asset.id.slice(0, 8)}.png`;
      const imagePath = path.join(process.cwd(), ".local-db", "exports", `${asset.id}.png`);
      zip.file(fileName, await readFile(imagePath));
      imageFiles.set(asset.id, fileName);
    }

    const storyboardFiles = new Map<string, string>();
    for (const asset of reels) {
      const fileName = `storyboards/${safeFileName(asset.title)}-${asset.id.slice(0, 8)}.json`;
      zip.file(fileName, JSON.stringify({
        title: asset.title,
        platform: asset.platform,
        duration: asset.payload.durationBadge ?? null,
        music: asset.payload.music ?? null,
        shots: asset.payload.shots ?? [],
        note: "Storyboard only. No rendered video footage is available for this asset.",
      }, null, 2));
      storyboardFiles.set(asset.id, fileName);
    }

    const manifest = {
      product: "M & A — AI Real Estate Creative Studio",
      campaign: campaignData.campaign.name,
      preset: campaignData.campaign.presetLabel,
      property: campaignData.property,
      brand: campaignData.brand,
      platforms: campaignData.campaign.platforms,
      generatedAt: new Date().toISOString(),
      deliverables: campaignData.assets.map((asset) => ({
        title: asset.title,
        kind: asset.kind,
        platform: asset.platform,
        aspect: asset.aspect,
        qcScore: asset.score,
        status: asset.approved ? "approved" : asset.status,
        image: asset.payload.image ?? null,
        imageFile: imageFiles.get(asset.id) ?? null,
        storyboardFile: storyboardFiles.get(asset.id) ?? null,
        copy: {
          kicker: asset.payload.kicker ?? null,
          headline: asset.payload.headline ?? null,
          cta: asset.payload.cta ?? null,
          priceLine: asset.payload.priceLine ?? null,
        },
        captions: asset.payload.captions ?? undefined,
        hashtags: asset.payload.hashtags ?? undefined,
        storyboard: asset.payload.shots ?? undefined,
      })),
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    const archive = await zip.generateAsync({ type: "nodebuffer" });
    return new Response(new Uint8Array(archive), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeFileName(campaignData.property.name)}-campaign-package.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("campaign package export failed", error);
    return Response.json({ error: "Failed to build campaign package." }, { status: 500 });
  }
}
