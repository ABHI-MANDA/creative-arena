import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, isLocalJsonDb } from "@/db";
import { properties, propertyDna } from "@/db/schema";
import { readLocalDatabase, updateLocalDatabase } from "@/db/local-json";
import { analyzeDNA, hx } from "@/lib/creative/engine";
import { logGeneration } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const property = isLocalJsonDb
      ? await readLocalDatabase((database) => database.properties.find((row) => row.id === id) ?? null)
      : (await db.select().from(properties).where(eq(properties.id, id)).limit(1))[0] ?? null;
    if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const p = property;

    const dna = analyzeDNA({
      name: p.name,
      location: p.location,
      propertyType: p.propertyType,
      price: p.price,
      audience: p.audience,
      amenities: p.amenities,
      description: p.description,
    });

    if (isLocalJsonDb) {
      await updateLocalDatabase((database) => {
        const existing = database.propertyDna.find((row) => row.propertyId === id);
        if (existing) existing.data = dna;
        else database.propertyDna.push({ id: crypto.randomUUID(), propertyId: id, data: dna, createdAt: new Date() });
        const storedProperty = database.properties.find((row) => row.id === id);
        if (storedProperty) storedProperty.status = "analyzed";
      });
    } else {
      await db
        .insert(propertyDna)
        .values({ propertyId: id, data: dna })
        .onConflictDoUpdate({ target: propertyDna.propertyId, set: { data: dna } });
      await db.update(properties).set({ status: "analyzed" }).where(eq(properties.id, id));
    }

    await logGeneration({ kind: "analysis", model: "aurum-vision-v2", durationMs: 700 + (hx(id) % 900), costCents: 4, propertyId: id });

    return NextResponse.json({ ok: true, dna });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
