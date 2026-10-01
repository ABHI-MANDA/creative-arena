import { desc, eq, sql } from "drizzle-orm";
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
  type Asset,
  type Campaign,
  type Property as PropertyRow,
  type PropertyImage,
} from "./schema";
import {
  DEFAULT_BRAND,
  type BrandSettings,
} from "@/lib/creative/presets";
import { analyzeDNA, type DNA } from "@/lib/creative/engine";

/* ---------------- brand settings ---------------- */

export async function getBrand(): Promise<BrandSettings> {
  try {
    if (isLocalJsonDb) {
      return await readLocalDatabase((database) => {
        const row = database.settings.find((entry) => entry.key === "brand");
        return row ? { ...DEFAULT_BRAND, ...(row.value as Partial<BrandSettings>) } : DEFAULT_BRAND;
      });
    }
    const rows = await db.select().from(settings).where(eq(settings.key, "brand")).limit(1);
    if (!rows.length) return DEFAULT_BRAND;
    return { ...DEFAULT_BRAND, ...(rows[0].value as Partial<BrandSettings>) };
  } catch {
    return DEFAULT_BRAND;
  }
}

export async function setBrand(value: BrandSettings): Promise<void> {
  if (isLocalJsonDb) {
    await updateLocalDatabase((database) => {
      const row = database.settings.find((entry) => entry.key === "brand");
      if (row) row.value = value;
      else database.settings.push({ key: "brand", value });
    });
    return;
  }
  await db
    .insert(settings)
    .values({ key: "brand", value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function getAppSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    if (isLocalJsonDb) {
      return await readLocalDatabase((database) =>
        (database.settings.find((entry) => entry.key === key)?.value as T | undefined) ?? fallback
      );
    }
    const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return (row?.value as T | undefined) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function setAppSetting<T>(key: string, value: T): Promise<void> {
  if (isLocalJsonDb) {
    await updateLocalDatabase((database) => {
      const row = database.settings.find((entry) => entry.key === key);
      if (row) row.value = value;
      else database.settings.push({ key, value });
    });
    return;
  }
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({
    target: settings.key,
    set: { value },
  });
}

/* ---------------- properties ---------------- */

export type PropertyCard = {
  property: PropertyRow;
  images: PropertyImage[];
  dna: DNA | null;
  campaignCount: number;
  assetCount: number;
};

function currentPropertyDNA(property: PropertyRow, storedDNA: DNA | null | undefined): DNA | null {
  if (!storedDNA) return null;
  return analyzeDNA({
    name: property.name,
    location: property.location,
    propertyType: property.propertyType,
    price: property.price,
    audience: property.audience,
    amenities: property.amenities,
    description: property.description,
  });
}

export async function listProperties(): Promise<PropertyCard[]> {
  try {
    if (isLocalJsonDb) {
      return await readLocalDatabase((database) =>
        [...database.properties]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((property) => ({
            property,
            images: database.propertyImages
              .filter((image) => image.propertyId === property.id)
              .sort((a, b) => a.sort - b.sort),
            dna: database.propertyDna.find((row) => row.propertyId === property.id)?.data ?? null,
            campaignCount: database.campaigns.filter((row) => row.propertyId === property.id).length,
            assetCount: database.assets.filter((row) => row.propertyId === property.id).length,
          }))
      );
    }
    const props = await db.select().from(properties).orderBy(desc(properties.createdAt));
    const imgs = await db.select().from(propertyImages);
    const dnas = await db.select().from(propertyDna);
    const camps = await db.select().from(campaigns);
    const allAssets = await db.select({ propertyId: assets.propertyId }).from(assets);
    return props.map((p) => ({
      property: p,
      images: imgs.filter((i) => i.propertyId === p.id).sort((a, b) => a.sort - b.sort),
      dna: dnas.find((d) => d.propertyId === p.id)?.data ?? null,
      campaignCount: camps.filter((c) => c.propertyId === p.id).length,
      assetCount: allAssets.filter((a) => a.propertyId === p.id).length,
    }));
  } catch {
    return [];
  }
}

async function getLocalPropertyBundle(id: string) {
  return readLocalDatabase((database) => {
    const property = database.properties.find((row) => row.id === id);
    if (!property) return null;
    const storedDNA = database.propertyDna.find((row) => row.propertyId === id)?.data;
    return {
      property,
      images: database.propertyImages
        .filter((row) => row.propertyId === id)
        .sort((a, b) => a.sort - b.sort),
      dna: currentPropertyDNA(property, storedDNA),
      campaigns: database.campaigns
        .filter((row) => row.propertyId === id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      assets: database.assets
        .filter((row) => row.propertyId === id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    };
  });
}

export async function getProperty(id: string) {
  if (isLocalJsonDb) {
    return getLocalPropertyBundle(id);
  }
  try {
    const prop = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
    if (!prop.length) return getLocalPropertyBundle(id);
    const images = await db
      .select()
      .from(propertyImages)
      .where(eq(propertyImages.propertyId, id))
      .orderBy(propertyImages.sort);
    const dnaRows = await db.select().from(propertyDna).where(eq(propertyDna.propertyId, id)).limit(1);
    const camps = await db.select().from(campaigns).where(eq(campaigns.propertyId, id)).orderBy(desc(campaigns.createdAt));
    const propAssets = await db.select().from(assets).where(eq(assets.propertyId, id)).orderBy(desc(assets.createdAt));
    return {
      property: prop[0],
      images,
      dna: currentPropertyDNA(prop[0], dnaRows[0]?.data),
      campaigns: camps,
      assets: propAssets,
    };
  } catch (err) {
    console.warn("PostgreSQL getProperty failed, falling back to local JSON DB:", err);
    return getLocalPropertyBundle(id);
  }
}

/* ---------------- campaigns ---------------- */

export type CampaignRow = {
  campaign: Campaign;
  propertyName: string;
  propertyLocation: string;
  cover: string | null;
  assetCount: number;
  avgScore: number;
  approvedCount: number;
};

export async function listCampaigns(): Promise<CampaignRow[]> {
  try {
    if (isLocalJsonDb) {
      return await readLocalDatabase((database) =>
        [...database.campaigns]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((campaign) => {
            const property = database.properties.find((row) => row.id === campaign.propertyId);
            const campaignAssets = database.assets.filter((row) => row.campaignId === campaign.id);
            const coverImages = database.propertyImages.filter((row) => row.propertyId === campaign.propertyId);
            return {
              campaign,
              propertyName: property?.name ?? "—",
              propertyLocation: property?.location ?? "",
              cover: coverImages.find((row) => row.label === "Exterior")?.url ?? coverImages[0]?.url ?? null,
              assetCount: campaignAssets.length,
              avgScore: campaignAssets.length
                ? Math.round(campaignAssets.reduce((sum, row) => sum + row.score, 0) / campaignAssets.length)
                : 0,
              approvedCount: campaignAssets.filter((row) => row.approved).length,
            };
          })
      );
    }
    const camps = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
    const props = await db.select().from(properties);
    const imgs = await db.select().from(propertyImages);
    const allAssets = await db.select().from(assets);
    return camps.map((c) => {
      const p = props.find((pp) => pp.id === c.propertyId);
      const list = allAssets.filter((a) => a.campaignId === c.id);
      const avg = list.length ? Math.round(list.reduce((s, a) => s + a.score, 0) / list.length) : 0;
      return {
        campaign: c,
        propertyName: p?.name ?? "—",
        propertyLocation: p?.location ?? "",
        cover: imgs.find((i) => i.propertyId === c.propertyId && i.label === "Exterior")?.url ?? imgs.find((i) => i.propertyId === c.propertyId)?.url ?? null,
        assetCount: list.length,
        avgScore: avg,
        approvedCount: list.filter((a) => a.approved).length,
      };
    });
  } catch {
    return [];
  }
}

async function getLocalCampaignBundle(id: string) {
  return readLocalDatabase((database) => {
    const campaign = database.campaigns.find((row) => row.id === id);
    if (!campaign) return null;
    const property = database.properties.find((row) => row.id === campaign.propertyId);
    if (!property) return null;
    const storedDNA = database.propertyDna.find((row) => row.propertyId === property.id)?.data;
    return {
      campaign,
      selectedModel: database.settings.find((row) => row.key === `campaign-model:${id}`)?.value as string | undefined,
      property,
      images: database.propertyImages
        .filter((row) => row.propertyId === property.id)
        .sort((a, b) => a.sort - b.sort),
      dna: currentPropertyDNA(property, storedDNA),
      campaigns: database.campaigns
        .filter((row) => row.propertyId === property.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      assets: database.assets
        .filter((row) => row.propertyId === property.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    };
  }).then((bundle) => {
    if (!bundle) return null;
    return {
      ...bundle,
      selectedModel: bundle.selectedModel,
      assets: bundle.assets.filter((row) => row.campaignId === id).sort((a, b) => a.kind.localeCompare(b.kind)),
    };
  });
}

export async function getCampaignBundle(id: string) {
  if (isLocalJsonDb) {
    return getLocalCampaignBundle(id);
  }
  try {
    const camps = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    if (!camps.length) return getLocalCampaignBundle(id);
    const campaign = camps[0];
    const bundle = await getProperty(campaign.propertyId);
    if (!bundle) return null;
    const campAssets = await db
      .select()
      .from(assets)
      .where(eq(assets.campaignId, id))
      .orderBy(assets.kind);
    const selectedModel = await getAppSetting<string | undefined>(`campaign-model:${id}`, undefined);
    return { campaign, ...bundle, selectedModel, assets: campAssets };
  } catch (err) {
    console.warn("PostgreSQL getCampaignBundle failed, falling back to local JSON DB:", err);
    return getLocalCampaignBundle(id);
  }
}

export async function listCampaignActions(campaignId: string, limit = 12) {
  if (isLocalJsonDb) {
    return readLocalDatabase((database) =>
      database.generations
        .filter((entry) => entry.campaignId === campaignId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)
    );
  }
  try {
    return await db
      .select()
      .from(generations)
      .where(eq(generations.campaignId, campaignId))
      .orderBy(desc(generations.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}

export async function listRecentGenerations(limit = 7) {
  if (isLocalJsonDb) {
    return readLocalDatabase((database) =>
      [...database.generations]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)
    );
  }
  try {
    return await db.select().from(generations).orderBy(desc(generations.createdAt)).limit(limit);
  } catch {
    return [];
  }
}

/* ---------------- assets library ---------------- */

export type LibraryAsset = {
  asset: Asset;
  campaignName: string;
  propertyName: string;
  preset: string;
};

export async function listLibraryAssets(): Promise<LibraryAsset[]> {
  try {
    if (isLocalJsonDb) {
      return await readLocalDatabase((database) =>
        [...database.assets]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((asset) => {
            const campaign = database.campaigns.find((row) => row.id === asset.campaignId);
            const property = database.properties.find((row) => row.id === asset.propertyId);
            return {
              asset,
              campaignName: campaign?.name ?? "",
              propertyName: property?.name ?? "",
              preset: campaign?.presetLabel ?? "",
            };
          })
      );
    }
    const all = await db.select().from(assets).orderBy(desc(assets.createdAt));
    const camps = await db.select().from(campaigns);
    const props = await db.select().from(properties);
    return all.map((a) => {
      const c = camps.find((cc) => cc.id === a.campaignId);
      const p = props.find((pp) => pp.id === a.propertyId);
      return {
        asset: a,
        campaignName: c?.name ?? "",
        propertyName: p?.name ?? "",
        preset: c?.presetLabel ?? "",
      };
    });
  } catch {
    return [];
  }
}

/* ---------------- telemetry ---------------- */

export async function logGeneration(entry: {
  kind: string;
  model: string;
  status?: string;
  durationMs?: number;
  costCents?: number;
  campaignId?: string | null;
  propertyId?: string | null;
}) {
  try {
    if (isLocalJsonDb) {
      await updateLocalDatabase((database) => {
        database.generations.push({
          id: crypto.randomUUID(),
          kind: entry.kind,
          model: entry.model,
          status: entry.status ?? "success",
          durationMs: entry.durationMs ?? 0,
          costCents: entry.costCents ?? 0,
          campaignId: entry.campaignId ?? null,
          propertyId: entry.propertyId ?? null,
          createdAt: new Date(),
        });
      });
      return;
    }
    await db.insert(generations).values({
      kind: entry.kind,
      model: entry.model,
      status: entry.status ?? "success",
      durationMs: entry.durationMs ?? 0,
      costCents: entry.costCents ?? 0,
      campaignId: entry.campaignId ?? null,
      propertyId: entry.propertyId ?? null,
    });
  } catch (e) {
    console.error("logGeneration failed", e);
  }
}

export async function adminStats() {
  try {
    const local = isLocalJsonDb ? await readLocalDatabase((database) => database) : null;
    const gens = local?.generations ?? await db.select().from(generations);
    const camps = local?.campaigns ?? await db.select().from(campaigns);
    const props = local?.properties ?? await db.select().from(properties);
    const allAssets = local?.assets ?? await db.select().from(assets);
    const imgs = local?.propertyImages ?? await db.select().from(propertyImages);

    const now = Date.now();
    const days: { d: string; count: number; cost: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const day = new Date(now - i * 86400000);
      const key = day.toISOString().slice(5, 10);
      const list = gens.filter((g) => new Date(g.createdAt).toDateString() === day.toDateString());
      days.push({ d: key, count: list.length, cost: list.reduce((s, g) => s + g.costCents, 0) });
    }

    const byModel = new Map<string, { n: number; fail: number; ms: number; cost: number }>();
    for (const g of gens) {
      const cur = byModel.get(g.model) ?? { n: 0, fail: 0, ms: 0, cost: 0 };
      cur.n++;
      cur.ms += g.durationMs;
      cur.cost += g.costCents;
      if (g.status !== "success") cur.fail++;
      byModel.set(g.model, cur);
    }

    return {
      users: 118 + props.length,
      activeCampaigns: camps.filter((c) => c.status !== "archived").length,
      generations: gens.length,
      failed: gens.filter((g) => g.status !== "success").length,
      aiCostCents: gens.reduce((s, g) => s + g.costCents, 0),
      assetsGenerated: allAssets.length,
      approved: allAssets.filter((a) => a.approved).length,
      storageMb: Math.round(imgs.length * 4.6 + allAssets.length * 0.9 + 92),
      days,
      models: [...byModel.entries()].map(([model, v]) => ({
        model,
        count: v.n,
        successRate: v.n ? Math.round((1 - v.fail / v.n) * 990) / 10 : 100,
        avgMs: v.n ? Math.round(v.ms / v.n) : 0,
        costCents: v.cost,
      })),
      recent: gens.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 10),
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    };
  } catch {
    return null;
  }
}

export async function dashboardStats() {
  const [camps, lib, brand] = await Promise.all([listCampaigns(), listLibraryAssets(), getBrand()]);
  const ready = lib.filter((l) => l.asset.status === "ready").length;
  const avg = lib.length ? Math.round(lib.reduce((s, l) => s + l.asset.score, 0) / lib.length) : 0;
  const approved = lib.filter((l) => l.asset.approved).length;
  const byKind = new Map<string, number>();
  for (const l of lib) byKind.set(l.asset.kind, (byKind.get(l.asset.kind) ?? 0) + 1);
  return { camps, lib, brand, ready, avg, approved, byKind: [...byKind.entries()] };
}
