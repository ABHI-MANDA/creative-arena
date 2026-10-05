import { NextResponse } from "next/server";
import { getBrand, setBrand } from "@/db/queries";
import { DEFAULT_BRAND, type BrandSettings } from "@/lib/creative/presets";
import { ensureSeed } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  return NextResponse.json(await getBrand());
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<BrandSettings>;
    const merged: BrandSettings = {
      ...DEFAULT_BRAND,
      ...body,
      thresholds: {
        ready: Math.min(99, Math.max(88, body.thresholds?.ready ?? DEFAULT_BRAND.thresholds.ready)),
        review: Math.min(98, Math.max(50, body.thresholds?.review ?? DEFAULT_BRAND.thresholds.review)),
      },
    };
    if (merged.thresholds.review >= merged.thresholds.ready) {
      merged.thresholds.review = merged.thresholds.ready - 1;
    }
    merged.mark = (merged.mark || "A").slice(0, 1).toUpperCase();
    await setBrand(merged);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
