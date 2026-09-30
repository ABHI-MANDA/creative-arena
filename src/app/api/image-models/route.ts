import { NextResponse } from "next/server";
import { listImageModels } from "@/lib/creative/image-provider";

export const dynamic = "force-dynamic";

export async function GET() {
  const models = listImageModels();
  return NextResponse.json({ models });
}
