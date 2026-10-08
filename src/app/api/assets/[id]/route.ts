import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, isLocalJsonDb } from "@/db";
import { assets } from "@/db/schema";
import { readLocalDatabase, updateLocalDatabase } from "@/db/local-json";
import { recomposeAsset, directionsFor, analyzeDNA, type AssetPayload } from "@/lib/creative/engine";
import { getBrand, getCampaignBundle, logGeneration } from "@/db/queries";
import { invalidateCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as {
      action?: string;
      designJson?: Record<string, unknown> | string;
      payload?: Partial<AssetPayload>;
      finalAssetUrl?: string;
    };
    const action = body.action;

    const asset = isLocalJsonDb
      ? await readLocalDatabase((database) => database.assets.find((row) => row.id === id) ?? null)
      : (await db.select().from(assets).where(eq(assets.id, id)).limit(1))[0] ?? null;
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (action === "approve" || action === "unapprove") {
      if (isLocalJsonDb) {
        await updateLocalDatabase((database) => {
          const storedAsset = database.assets.find((row) => row.id === id);
          if (storedAsset) storedAsset.approved = action === "approve";
        });
      } else {
        await db.update(assets).set({ approved: action === "approve" }).where(eq(assets.id, id));
      }
      await logGeneration({ kind: "approval", model: "operator", campaignId: asset.campaignId, propertyId: asset.propertyId });
      invalidateCache("assets");
      invalidateCache(`campaign:bundle:${asset.campaignId}`);
      invalidateCache("dashboard");
      invalidateCache("admin");
      return NextResponse.json({ ok: true, approved: action === "approve" });
    }

    if (action === "regenerate") {
      const bundle = await getCampaignBundle(asset.campaignId);
      if (!bundle) return NextResponse.json({ error: "Campaign missing" }, { status: 404 });
      const brand = await getBrand();
      const p = bundle.property;
      const brief = {
        name: p.name,
        location: p.location,
        propertyType: p.propertyType,
        price: p.price,
        audience: p.audience,
        amenities: p.amenities,
        description: p.description,
      };
      const dna = bundle.dna ?? analyzeDNA(brief);
      const direction =
        bundle.campaign.direction ?? bundle.campaign.options?.[0] ?? directionsFor(dna, brief)[0];

      const variant = (asset.payload.variant ?? 0) + 1;
      const { payload, qc } = recomposeAsset(
        { kind: asset.kind, platform: asset.platform, payload: asset.payload },
        {
          brief,
          dna,
          presetId: bundle.campaign.preset,
          platformIds: [asset.platform],
          direction,
          images: bundle.images.map((i) => ({ url: i.url, label: i.label })),
          thresholds: brand.thresholds,
          variant,
        },
        variant
      );

      if (isLocalJsonDb) {
        await updateLocalDatabase((database) => {
          const storedAsset = database.assets.find((row) => row.id === id);
          if (storedAsset) Object.assign(storedAsset, { payload, score: qc.score, checks: qc.checks, status: qc.status });
        });
      } else {
        await db
          .update(assets)
          .set({ payload, score: qc.score, checks: qc.checks, status: qc.status })
          .where(eq(assets.id, id));
      }
      await logGeneration({ kind: "visual", model: "estatescape-xl", durationMs: 1400, costCents: 11, campaignId: asset.campaignId, propertyId: asset.propertyId });
      await logGeneration({ kind: "qc", model: "qc-heuristics-1.1", durationMs: 220, costCents: 1, campaignId: asset.campaignId, propertyId: asset.propertyId });

      invalidateCache("assets");
      invalidateCache(`campaign:bundle:${asset.campaignId}`);
      invalidateCache("dashboard");
      invalidateCache("admin");

      return NextResponse.json({ ok: true, score: qc.score });
    }

    if (action === "save_design") {

      const updatedPayload: AssetPayload = {
        ...asset.payload,
        ...(body.payload ?? {}),
        ...(body.designJson !== undefined ? { designJson: body.designJson } : {}),
        ...(body.finalAssetUrl !== undefined ? { finalAssetUrl: body.finalAssetUrl } : {}),
        editingStatus: "edited",
        version: (asset.payload.version ?? 1) + 1,
      };

      if (isLocalJsonDb) {
        await updateLocalDatabase((database) => {
          const storedAsset = database.assets.find((row) => row.id === id);
          if (storedAsset) {
            storedAsset.payload = updatedPayload;
          }
        });
      } else {
        await db
          .update(assets)
          .set({ payload: updatedPayload })
          .where(eq(assets.id, id));
      }

      await logGeneration({
        kind: "design_edit",
        model: "fabric-editor",
        durationMs: 300,
        costCents: 0,
        campaignId: asset.campaignId,
        propertyId: asset.propertyId,
      });

      invalidateCache("assets");
      invalidateCache(`campaign:bundle:${asset.campaignId}`);
      invalidateCache("dashboard");
      invalidateCache("admin");

      return NextResponse.json({ ok: true, payload: updatedPayload });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
