import { NextResponse } from "next/server";
import { listFreeOpenRouterModels } from "@/lib/creative/models";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasAgnes = Boolean(process.env.AGNES_API_KEY?.trim());
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  if (!hasAgnes && !hasOpenRouter) {
    return NextResponse.json({ configured: false, models: [], error: "Add AGNES_API_KEY or OPENROUTER_API_KEY to .env to load provider models." });
  }
  try {
    const models = await listFreeOpenRouterModels();
    return NextResponse.json({ configured: true, models });
  } catch {
    return NextResponse.json({ configured: true, models: [], error: "Could not load models." }, { status: 502 });
  }
}
