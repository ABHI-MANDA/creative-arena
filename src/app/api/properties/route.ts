import { NextResponse } from "next/server";
import { db, isLocalJsonDb } from "@/db";
import { properties, propertyDna, propertyImages } from "@/db/schema";
import { updateLocalDatabase } from "@/db/local-json";
import { analyzeDNA, type Brief } from "@/lib/creative/engine";
import { listProperties, logGeneration } from "@/db/queries";
import { ensureSeed } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  const list = await listProperties();
  return NextResponse.json(
    list.map((c) => ({
      id: c.property.id,
      name: c.property.name,
      location: c.property.location,
      propertyType: c.property.propertyType,
      price: c.property.price,
      cover: c.images.find((i) => i.label === "Exterior")?.url ?? c.images[0]?.url ?? null,
      analyzed: Boolean(c.dna),
    }))
  );
}

export async function POST(req: Request) {
  try {
    await ensureSeed();
    const body = (await req.json()) as {
      brief?: Brief;
      images?: { url: string; label?: string }[];
      source?: string;
      sourceUrl?: string;
    };
    const brief = body.brief;
    const images = (body.images ?? []).slice(0, 12);
    if (!brief?.name?.trim() || !brief.location?.trim() || !brief.propertyType?.trim() || !brief.price?.trim()) {
      return NextResponse.json({ error: "Name, location, type and price are required." }, { status: 400 });
    }
    if (!images.length) {
      return NextResponse.json({ error: "Stage at least one property shot." }, { status: 400 });
    }

    const dna = analyzeDNA(brief);
    const propertyId = isLocalJsonDb
      ? await updateLocalDatabase((database) => {
          const id = crypto.randomUUID();
          database.properties.push({
            id,
            name: brief.name.trim(),
            location: brief.location.trim(),
            propertyType: brief.propertyType.trim(),
            price: brief.price.trim(),
            audience: brief.audience?.trim() ?? "",
            amenities: brief.amenities ?? "",
            description: brief.description ?? "",
            objective: "",
            source: body.source ?? "samples",
            sourceUrl: body.sourceUrl ?? "",
            status: "analyzed",
            createdAt: new Date(),
          });
          database.propertyImages.push(
            ...images.map((image, index) => ({
              id: crypto.randomUUID(),
              propertyId: id,
              url: image.url,
              label: image.label || "Shot",
              kind: image.url.startsWith("data:") ? "upload" : "photo",
              sort: index,
            }))
          );
          database.propertyDna.push({
            id: crypto.randomUUID(),
            propertyId: id,
            data: dna,
            createdAt: new Date(),
          });
          return id;
        })
      : await (async () => {
          const [property] = await db
            .insert(properties)
            .values({
              name: brief.name.trim(),
              location: brief.location.trim(),
              propertyType: brief.propertyType.trim(),
              price: brief.price.trim(),
              audience: brief.audience?.trim() ?? "",
              amenities: brief.amenities ?? "",
              description: brief.description ?? "",
              source: body.source ?? "samples",
              sourceUrl: body.sourceUrl ?? "",
              status: "analyzed",
            })
            .returning({ id: properties.id });

          await db.insert(propertyImages).values(
            images.map((image, index) => ({
              propertyId: property.id,
              url: image.url,
              label: image.label || "Shot",
              kind: image.url.startsWith("data:") ? "upload" : "photo",
              sort: index,
            }))
          );
          await db.insert(propertyDna).values({ propertyId: property.id, data: dna });
          return property.id;
        })();

    await logGeneration({ kind: "analysis", model: "aurum-vision-v2", durationMs: 900 + (images.length * 130), costCents: 4, propertyId });

    return NextResponse.json({ id: propertyId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create property." }, { status: 500 });
  }
}
