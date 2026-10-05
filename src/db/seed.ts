import { sql } from "drizzle-orm";
import { db, isLocalJsonDb } from "./index";
import { readLocalDatabase, updateLocalDatabase } from "./local-json";
import {
  assets,
  campaigns,
  generations,
  properties,
  propertyDna,
  propertyImages,
  settings,
} from "./schema";
import {
  analyzeDNA,
  composeAssets,
  directionsFor,
  hx,
  type Brief,
} from "@/lib/creative/engine";
import { DEFAULT_BRAND, DEFAULT_THRESHOLDS, SAMPLE_BLUEPRINTS, SAMPLE_SHOTS } from "@/lib/creative/presets";

const briefFor = (id: string): Brief => {
  const bp = SAMPLE_BLUEPRINTS.find((b) => b.id === id)!;
  return {
    name: bp.name,
    location: bp.location,
    propertyType: bp.propertyType,
    price: bp.price,
    audience: bp.audience,
    amenities: bp.amenities,
    description: bp.description,
  };
};

const shotsFor = (set: string) =>
  SAMPLE_SHOTS.filter((s) => s.set === set || s.set === "both").map((s, i) => ({
    url: s.url,
    label: s.label,
    sort: i,
  }));

export async function ensureSeed(): Promise<boolean> {
  if (isLocalJsonDb) return ensureLocalSeed();

  try {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(properties);
    if (count > 0) return true;
  } catch {
    return false; // tables not provisioned yet
  }

  try {
    await db.insert(settings).values({ key: "brand", value: DEFAULT_BRAND }).onConflictDoNothing();

    /* ---- properties + imagery + DNA ---- */
    const propertyIds: Record<string, string> = {};
    for (const set of ["villa", "tower"]) {
      const brief = briefFor(set);
      const [prop] = await db
        .insert(properties)
        .values({
          name: brief.name,
          location: brief.location,
          propertyType: brief.propertyType,
          price: brief.price,
          audience: brief.audience ?? "",
          amenities: brief.amenities ?? "",
          description: brief.description ?? "",
          objective: "Brand-led launch & site visits",
          source: "samples",
          status: "analyzed",
        })
        .returning({ id: properties.id });
      propertyIds[set] = prop.id;
      await db.insert(propertyImages).values(
        shotsFor(set).map((s, i) => ({ propertyId: prop.id, url: s.url, label: s.label, sort: i }))
      );
      await db.insert(propertyDna).values({ propertyId: prop.id, data: analyzeDNA(brief) });
    }

    /* ---- ready campaign for Green Valley ---- */
    const brief = briefFor("villa");
    const dna = analyzeDNA(brief);
    const directions = directionsFor(dna, brief);
    const platforms = ["ig-post", "ig-reel", "ig-story", "fb-ad", "whatsapp"];
    const [camp] = await db
      .insert(campaigns)
      .values({
        propertyId: propertyIds.villa,
        name: "Green Valley — Festive Luxury Launch",
        preset: "luxury-property",
        presetLabel: "Luxury Property",
        platforms,
        options: directions,
        direction: directions[0],
        status: "ready",
      })
      .returning({ id: campaigns.id });

    const composed = composeAssets({
      brief,
      dna,
      presetId: "luxury-property",
      platformIds: platforms,
      direction: directions[0],
      images: shotsFor("villa"),
      thresholds: DEFAULT_THRESHOLDS,
    });
    await db.insert(assets).values(
      composed.map((a) => ({
        campaignId: camp.id,
        propertyId: propertyIds.villa,
        kind: a.kind,
        platform: a.platform,
        aspect: a.aspect,
        title: a.title,
        payload: a.payload,
        score: a.score,
        checks: a.checks,
        status: a.status,
        approved: a.score >= 96,
      }))
    );

    /* ---- draft campaign for Skyline ---- */
    const brief2 = briefFor("tower");
    const dna2 = analyzeDNA(brief2);
    await db.insert(campaigns).values({
      propertyId: propertyIds.tower,
      name: "Skyline Heights — Investor Push (Draft)",
      preset: "investment",
      presetLabel: "Investment",
      platforms: ["linkedin", "fb-ad", "portal"],
      options: directionsFor(dna2, brief2),
      status: "draft",
    });

    /* ---- telemetry history (8 days) ---- */
    const rows: (typeof generations.$inferInsert)[] = [];
    const models: Record<string, string> = {
      analysis: "aurum-vision-v2",
      directions: "copyforge-70b",
      visual: "estatescape-xl",
      compose: "compose-engine-1.4",
      video: "motioncraft-2",
      qc: "qc-heuristics-1.1",
    };
    let k = 0;
    for (let day = 7; day >= 0; day--) {
      const n = 6 + ((hx("day" + day) % 7) as number);
      for (let i = 0; i < n; i++) {
        const kind = Object.keys(models)[(k + i) % 6];
        const h = hx(`${day}:${i}:${kind}`);
        const failed = h % 17 === 0;
        const video = kind === "video";
        rows.push({
          kind,
          model: models[kind],
          status: failed ? "failed" : "success",
          durationMs: (video ? 5200 : 420) + (h % (video ? 6800 : 2100)),
          costCents: failed ? 0 : video ? 55 + (h % 40) : kind === "visual" ? 8 + (h % 7) : 1 + (h % 3),
          campaignId: null,
          propertyId: [propertyIds.villa, propertyIds.tower][h % 2],
          createdAt: new Date(Date.now() - day * 86400000 - (h % 70000) * 1000),
        });
      }
      k += n;
    }
    await db.insert(generations).values(rows);
    return true;
  } catch (e) {
    console.error("seed failed", e);
    return false;
  }
}

async function ensureLocalSeed(): Promise<boolean> {
  const seeded = await readLocalDatabase((database) => database.properties.length > 0);
  if (seeded) return true;

  return updateLocalDatabase((database) => {
    if (database.properties.length) return true;

    database.settings.push({ key: "brand", value: DEFAULT_BRAND });
    const propertyIds: Record<string, string> = {};

    for (const set of ["villa", "tower"]) {
      const brief = briefFor(set);
      const id = crypto.randomUUID();
      propertyIds[set] = id;
      database.properties.push({
        id,
        name: brief.name,
        location: brief.location,
        propertyType: brief.propertyType,
        price: brief.price,
        audience: brief.audience ?? "",
        amenities: brief.amenities ?? "",
        description: brief.description ?? "",
        objective: "Brand-led launch & site visits",
        source: "samples",
        sourceUrl: "",
        status: "analyzed",
        createdAt: new Date(),
      });
      database.propertyImages.push(
        ...shotsFor(set).map((shot, index) => ({
          id: crypto.randomUUID(),
          propertyId: id,
          url: shot.url,
          label: shot.label,
          kind: "photo",
          sort: index,
        }))
      );
      database.propertyDna.push({
        id: crypto.randomUUID(),
        propertyId: id,
        data: analyzeDNA(brief),
        createdAt: new Date(),
      });
    }

    const villaBrief = briefFor("villa");
    const villaDna = analyzeDNA(villaBrief);
    const villaDirections = directionsFor(villaDna, villaBrief);
    const villaPlatforms = ["ig-post", "ig-reel", "ig-story", "fb-ad", "whatsapp"];
    const readyCampaignId = crypto.randomUUID();
    database.campaigns.push({
      id: readyCampaignId,
      propertyId: propertyIds.villa,
      name: "Green Valley — Festive Luxury Launch",
      preset: "luxury-property",
      presetLabel: "Luxury Property",
      platforms: villaPlatforms,
      options: villaDirections,
      direction: villaDirections[0],
      status: "ready",
      createdAt: new Date(),
    });

    const composed = composeAssets({
      brief: villaBrief,
      dna: villaDna,
      presetId: "luxury-property",
      platformIds: villaPlatforms,
      direction: villaDirections[0],
      images: shotsFor("villa"),
      thresholds: DEFAULT_THRESHOLDS,
    });
    database.assets.push(
      ...composed.map((asset) => ({
        id: crypto.randomUUID(),
        campaignId: readyCampaignId,
        propertyId: propertyIds.villa,
        kind: asset.kind,
        platform: asset.platform,
        aspect: asset.aspect,
        title: asset.title,
        payload: asset.payload,
        score: asset.score,
        checks: asset.checks,
        status: asset.status,
        approved: asset.score >= 96,
        createdAt: new Date(),
      }))
    );

    const towerBrief = briefFor("tower");
    const towerDna = analyzeDNA(towerBrief);
    database.campaigns.push({
      id: crypto.randomUUID(),
      propertyId: propertyIds.tower,
      name: "Skyline Heights — Investor Push (Draft)",
      preset: "investment",
      presetLabel: "Investment",
      platforms: ["linkedin", "fb-ad", "portal"],
      options: directionsFor(towerDna, towerBrief),
      direction: null,
      status: "draft",
      createdAt: new Date(),
    });

    const models: Record<string, string> = {
      analysis: "aurum-vision-v2",
      directions: "copyforge-70b",
      visual: "estatescape-xl",
      compose: "compose-engine-1.4",
      video: "motioncraft-2",
      qc: "qc-heuristics-1.1",
    };
    let sequence = 0;
    for (let day = 7; day >= 0; day--) {
      const count = 6 + (hx(`day${day}`) % 7);
      for (let index = 0; index < count; index++) {
        const kind = Object.keys(models)[(sequence + index) % 6];
        const hash = hx(`${day}:${index}:${kind}`);
        const failed = hash % 17 === 0;
        const video = kind === "video";
        database.generations.push({
          id: crypto.randomUUID(),
          kind,
          model: models[kind],
          status: failed ? "failed" : "success",
          durationMs: (video ? 5200 : 420) + (hash % (video ? 6800 : 2100)),
          costCents: failed ? 0 : video ? 55 + (hash % 40) : kind === "visual" ? 8 + (hash % 7) : 1 + (hash % 3),
          campaignId: null,
          propertyId: [propertyIds.villa, propertyIds.tower][hash % 2],
          createdAt: new Date(Date.now() - day * 86400000 - (hash % 70000) * 1000),
        });
      }
      sequence += count;
    }

    return true;
  });
}
