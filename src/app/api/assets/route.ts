import { NextResponse } from "next/server";
import { listLibraryAssets } from "@/db/queries";
import { ensureSeed } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  const lib = await listLibraryAssets();
  return NextResponse.json(
    lib.map((l) => ({
      ...l.asset,
      campaignName: l.campaignName,
      propertyName: l.propertyName,
    }))
  );
}
