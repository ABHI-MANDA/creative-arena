import { NextResponse } from "next/server";
import { listFreeOpenRouterModels } from "@/lib/creative/models";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return NextResponse.json({ configured: false, models: [], error: "Add OPENROUTER_API_KEY to .env to load provider models." });
  }
  try {
    const models = await listFreeOpenRouterModels();
    return NextResponse.json({ configured: true, models });
  } catch {
    return NextResponse.json({ configured: true, models: [], error: "Could not load free models from OpenRouter." }, { status: 502 });
  }
}
