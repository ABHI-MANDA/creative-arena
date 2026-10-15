import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, isLocalJsonDb } from "@/db";
import { assets, campaigns } from "@/db/schema";
import { readLocalDatabase, updateLocalDatabase } from "@/db/local-json";
import { recomposeAsset, directionsFor, analyzeDNA, type AssetPayload } from "@/lib/creative/engine";
import { getBrand, getCampaignBundle, logGeneration } from "@/db/queries";
import { invalidateCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const asset = isLocalJsonDb
      ? await readLocalDatabase((database) => database.assets.find((row) => row.id === id) ?? null)
      : (await db.select().from(assets).where(eq(assets.id, id)).limit(1))[0] ?? null;

    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(asset, {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Failed to get asset:", error);
    return NextResponse.json({ error: "Failed to fetch asset" }, { status: 500 });
  }
}

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
      const isApproved = action === "approve";
      let allVisualApproved = false;

      if (!isLocalJsonDb) {
        try {
          await db
            .update(assets)
            .set({ approved: isApproved })
            .where(eq(assets.id, id));

          const campAssets = await db
            .select({ id: assets.id, kind: assets.kind, approved: assets.approved })
            .from(assets)
            .where(eq(assets.campaignId, asset.campaignId));

          const visuals = campAssets.filter((a) => a.kind !== "copy");
          allVisualApproved =
            visuals.length > 0 &&
            visuals.every((a) => (a.id === id ? isApproved : a.approved));

          if (allVisualApproved) {
            await db
              .update(campaigns)
              .set({ status: "approved" })
              .where(eq(campaigns.id, asset.campaignId));
          }
        } catch (e) {
          console.error("Neon asset update error in PATCH:", e);
        }
      }

      await updateLocalDatabase((database) => {
        const storedAsset = database.assets.find((row) => row.id === id);
        if (storedAsset) storedAsset.approved = isApproved;
        const campAssets = database.assets.filter((a) => a.campaignId === asset.campaignId && a.kind !== "copy");
        if (campAssets.length > 0 && campAssets.every((a) => a.id === id ? isApproved : a.approved)) {
          const camp = database.campaigns.find((c) => c.id === asset.campaignId);
          if (camp) camp.status = "approved";
          allVisualApproved = true;
        }
      });

      await logGeneration({ kind: "approval", model: "operator", campaignId: asset.campaignId, propertyId: asset.propertyId });
      invalidateCache("assets");
      invalidateCache("campaigns");
      invalidateCache(`campaign:bundle:${asset.campaignId}`);
      invalidateCache(`campaign:${asset.campaignId}`);
      invalidateCache("dashboard");
      invalidateCache("admin");

      try {
        revalidatePath(`/campaigns/${asset.campaignId}`);
        revalidatePath(`/campaigns`);
        revalidatePath(`/`);
      } catch {}

      return NextResponse.json({
        ok: true,
        approved: isApproved,
        campaignStatus: allVisualApproved ? "approved" : undefined,
      });
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
          typographyDefaults: brand.typographyDefaults,
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
      invalidateCache("campaigns");
      invalidateCache(`campaign:bundle:${asset.campaignId}`);
      invalidateCache(`campaign:${asset.campaignId}`);
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
