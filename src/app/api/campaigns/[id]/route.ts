import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, isLocalJsonDb } from "@/db";
import { assets, campaigns } from "@/db/schema";
import { readLocalDatabase, updateLocalDatabase } from "@/db/local-json";
import { getCampaignBundle, logGeneration } from "@/db/queries";
import { invalidateCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const bundle = await getCampaignBundle(id);
    if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(bundle);
  } catch (error) {
    console.error("Failed to get campaign:", error);
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { action?: string };
    const action = body.action;

    if (action === "approve" || action === "unapprove") {
      const isApproved = action === "approve";
      if (!isLocalJsonDb) {
        try {
          await Promise.all([
            db
              .update(campaigns)
              .set({ status: isApproved ? "approved" : "ready" })
              .where(eq(campaigns.id, id)),
            db
              .update(assets)
              .set({ approved: isApproved })
              .where(eq(assets.campaignId, id)),
          ]);
        } catch (e) {
          console.error("Neon db update error in campaign PATCH:", e);
        }
      }

      await updateLocalDatabase((database) => {
        const camp = database.campaigns.find((c) => c.id === id);
        if (camp) camp.status = isApproved ? "approved" : "ready";
        for (const a of database.assets) {
          if (a.campaignId === id) a.approved = isApproved;
        }
      });

      await logGeneration({
        kind: "approval",
        model: "operator",
        campaignId: id,
      });

      invalidateCache("campaigns");
      invalidateCache("assets");
      invalidateCache(`campaign:bundle:${id}`);
      invalidateCache(`campaign:${id}`);
      invalidateCache("dashboard");
      invalidateCache("admin");

      try {
        revalidatePath(`/campaigns/${id}`);
        revalidatePath(`/campaigns`);
        revalidatePath(`/`);
      } catch {}

      return NextResponse.json({ ok: true, approved: isApproved, status: isApproved ? "approved" : "ready" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to update campaign:", error);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

