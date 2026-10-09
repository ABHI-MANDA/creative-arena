import { desc, eq, gte, sql } from "drizzle-orm";
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
import { getOrSetCache, invalidateCache } from "@/lib/cache";
import { recordDbMetric } from "@/lib/observability";

/* ---------------- brand settings ---------------- */

export async function getBrand(): Promise<BrandSettings> {
  return getOrSetCache("brand:settings", 600, async () => {
    const started = Date.now();
    try {
      if (isLocalJsonDb) {
        return await readLocalDatabase((database) => {
          const row = database.settings.find((entry) => entry.key === "brand");
          return row ? { ...DEFAULT_BRAND, ...(row.value as Partial<BrandSettings>) } : DEFAULT_BRAND;
        });
      }
      const rows = await db
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, "brand"))
        .limit(1);
      recordDbMetric("getBrand", Date.now() - started, 1, 400);
      if (!rows.length) return DEFAULT_BRAND;
      return { ...DEFAULT_BRAND, ...(rows[0].value as Partial<BrandSettings>) };
    } catch {
      return DEFAULT_BRAND;
    }
  }, "brand");
}

export async function setBrand(value: BrandSettings): Promise<void> {
  invalidateCache("brand");
  invalidateCache("dashboard");
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
  return getOrSetCache(`setting:${key}`, 300, async () => {
    try {
      if (isLocalJsonDb) {
        return await readLocalDatabase((database) =>
          (database.settings.find((entry) => entry.key === key)?.value as T | undefined) ?? fallback
        );
      }
      const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
      return (row?.value as T | undefined) ?? fallback;
    } catch {
      return fallback;
    }
  }, "settings");
}

export async function setAppSetting<T>(key: string, value: T): Promise<void> {
  invalidateCache(`setting:${key}`);
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
  return getOrSetCache("properties:list", 45, async () => {
    const started = Date.now();
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

      // Explicit projections - do not fetch full DNA JSONB blobs or full assets
      const [props, imgs, dnaIds, camps, assetStats] = await Promise.all([
        db
          .select({
            id: properties.id,
            name: properties.name,
            location: properties.location,
            propertyType: properties.propertyType,
            price: properties.price,
            audience: properties.audience,
            amenities: properties.amenities,
            description: properties.description,
            objective: properties.objective,
            source: properties.source,
            sourceUrl: properties.sourceUrl,
            status: properties.status,
            createdAt: properties.createdAt,
          })
          .from(properties)
          .orderBy(desc(properties.createdAt)),
        db
          .select({
            id: propertyImages.id,
            propertyId: propertyImages.propertyId,
            url: propertyImages.url,
            label: propertyImages.label,
            kind: propertyImages.kind,
            sort: propertyImages.sort,
          })
          .from(propertyImages),
        db
          .select({
            propertyId: propertyDna.propertyId,
          })
          .from(propertyDna),
        db
          .select({
            propertyId: campaigns.propertyId,
          })
          .from(campaigns),
        db
          .select({
            propertyId: assets.propertyId,
          })
          .from(assets),
      ]);

      recordDbMetric("listProperties", Date.now() - started, props.length, props.length * 300);

      const dnaSet = new Set(dnaIds.map((d) => d.propertyId));

      return props.map((p) => {
        // Return dummy marker DNA object if DNA exists so boolean checks ({dna && ...}) succeed without transferring JSONB
        const hasDna = dnaSet.has(p.id);
        const dummyDna: DNA | null = hasDna
          ? ({ architecture: "analyzed", palette: [], paletteHex: [], lighting: "", audience: "", positioning: "", usps: [], features: { Exterior: [], Interior: [], Amenities: [], Location: [] }, visualStyle: "", brandTone: "", locationAdvantages: [], rawAmenities: [] } as DNA)
          : null;

        return {
          property: p,
          images: imgs.filter((i) => i.propertyId === p.id).sort((a, b) => a.sort - b.sort),
          dna: dummyDna,
          campaignCount: camps.filter((c) => c.propertyId === p.id).length,
          assetCount: assetStats.filter((a) => a.propertyId === p.id).length,
        };
      });
    } catch (err) {
      console.error("listProperties error", err);
      return [];
    }
  }, "properties");
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
  return getOrSetCache(`property:bundle:${id}`, 60, async () => {
    const started = Date.now();
    try {
      const [prop, images, dnaRows, camps, propAssets] = await Promise.all([
        db.select().from(properties).where(eq(properties.id, id)).limit(1),
        db.select().from(propertyImages).where(eq(propertyImages.propertyId, id)).orderBy(propertyImages.sort),
        db.select().from(propertyDna).where(eq(propertyDna.propertyId, id)).limit(1),
        db.select().from(campaigns).where(eq(campaigns.propertyId, id)).orderBy(desc(campaigns.createdAt)),
        db
          .select({
            id: assets.id,
            campaignId: assets.campaignId,
            propertyId: assets.propertyId,
            kind: assets.kind,
            platform: assets.platform,
            aspect: assets.aspect,
            title: assets.title,
            payload: assets.payload,
            score: assets.score,
            status: assets.status,
            approved: assets.approved,
            createdAt: assets.createdAt,
          })
          .from(assets)
          .where(eq(assets.propertyId, id))
          .orderBy(desc(assets.createdAt)),
      ]);

      recordDbMetric("getProperty", Date.now() - started, 1, 3500);

      if (!prop.length) return getLocalPropertyBundle(id);

      return {
        property: prop[0],
        images,
        dna: currentPropertyDNA(prop[0], dnaRows[0]?.data),
        campaigns: camps,
        assets: propAssets.map((a) => {
          // Strip heavy designJson to avoid transferring canvas serialization unless in editor
          const { designJson: _stripped, ...safePayload } = (a.payload || {}) as Record<string, unknown> & { designJson?: unknown };
          return { ...a, payload: safePayload as any, checks: [] };
        }),
      };
    } catch (err) {
      console.warn("PostgreSQL getProperty failed, falling back to local JSON DB:", err);
      return getLocalPropertyBundle(id);
    }
  }, `property:${id}`);
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
  return getOrSetCache("campaigns:list", 45, async () => {
    const started = Date.now();
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

      // Explicit projections - NEVER select * from assets with payloads here!
      const [camps, props, imgs, assetMetrics] = await Promise.all([
        db
          .select({
            id: campaigns.id,
            propertyId: campaigns.propertyId,
            name: campaigns.name,
            preset: campaigns.preset,
            presetLabel: campaigns.presetLabel,
            platforms: campaigns.platforms,
            status: campaigns.status,
            createdAt: campaigns.createdAt,
          })
          .from(campaigns)
          .orderBy(desc(campaigns.createdAt)),
        db
          .select({
            id: properties.id,
            name: properties.name,
            location: properties.location,
          })
          .from(properties),
        db
          .select({
            propertyId: propertyImages.propertyId,
            url: propertyImages.url,
            label: propertyImages.label,
          })
          .from(propertyImages),
        db
          .select({
            campaignId: assets.campaignId,
            score: assets.score,
            approved: assets.approved,
          })
          .from(assets),
      ]);

      recordDbMetric("listCampaigns", Date.now() - started, camps.length, camps.length * 250);

      const propsMap = new Map(props.map((p) => [p.id, p]));

      // Group asset metrics by campaignId in memory
      const campaignAssetStats = new Map<string, { count: number; totalScore: number; approvedCount: number }>();
      for (const a of assetMetrics) {
        const existing = campaignAssetStats.get(a.campaignId) ?? { count: 0, totalScore: 0, approvedCount: 0 };
        existing.count++;
        existing.totalScore += a.score;
        if (a.approved) existing.approvedCount++;
        campaignAssetStats.set(a.campaignId, existing);
      }

      // Index exterior covers
      const coverMap = new Map<string, string>();
      for (const img of imgs) {
        if (!coverMap.has(img.propertyId) || img.label === "Exterior") {
          coverMap.set(img.propertyId, img.url);
        }
      }

      return camps.map((c) => {
        const p = propsMap.get(c.propertyId);
        const stats = campaignAssetStats.get(c.id);
        const count = stats?.count ?? 0;
        const avg = count ? Math.round(stats!.totalScore / count) : 0;

        return {
          campaign: c as Campaign,
          propertyName: p?.name ?? "—",
          propertyLocation: p?.location ?? "",
          cover: coverMap.get(c.propertyId) ?? null,
          assetCount: count,
          avgScore: avg,
          approvedCount: stats?.approvedCount ?? 0,
        };
      });
    } catch (err) {
      console.error("listCampaigns error", err);
      return [];
    }
  }, "campaigns");
}

export async function listPropertyCampaigns(propertyId: string): Promise<CampaignRow[]> {
  return getOrSetCache(`campaigns:property:${propertyId}`, 45, async () => {
    const started = Date.now();
    try {
      if (isLocalJsonDb) {
        const all = await listCampaigns();
        return all.filter((c) => c.campaign.propertyId === propertyId);
      }

      const [camps, [prop], imgs, assetMetrics] = await Promise.all([
        db
          .select({
            id: campaigns.id,
            propertyId: campaigns.propertyId,
            name: campaigns.name,
            preset: campaigns.preset,
            presetLabel: campaigns.presetLabel,
            platforms: campaigns.platforms,
            status: campaigns.status,
            createdAt: campaigns.createdAt,
          })
          .from(campaigns)
          .where(eq(campaigns.propertyId, propertyId))
          .orderBy(desc(campaigns.createdAt)),
        db
          .select({
            id: properties.id,
            name: properties.name,
            location: properties.location,
          })
          .from(properties)
          .where(eq(properties.id, propertyId))
          .limit(1),
        db
          .select({
            url: propertyImages.url,
            label: propertyImages.label,
          })
          .from(propertyImages)
          .where(eq(propertyImages.propertyId, propertyId)),
        db
          .select({
            campaignId: assets.campaignId,
            score: assets.score,
            approved: assets.approved,
          })
          .from(assets)
          .where(eq(assets.propertyId, propertyId)),
      ]);

      recordDbMetric("listPropertyCampaigns", Date.now() - started, camps.length, camps.length * 200);

      const cover = imgs.find((i) => i.label === "Exterior")?.url ?? imgs[0]?.url ?? null;

      const campaignAssetStats = new Map<string, { count: number; totalScore: number; approvedCount: number }>();
      for (const a of assetMetrics) {
        const existing = campaignAssetStats.get(a.campaignId) ?? { count: 0, totalScore: 0, approvedCount: 0 };
        existing.count++;
        existing.totalScore += a.score;
        if (a.approved) existing.approvedCount++;
        campaignAssetStats.set(a.campaignId, existing);
      }

      return camps.map((c) => {
        const stats = campaignAssetStats.get(c.id);
        const count = stats?.count ?? 0;
        const avg = count ? Math.round(stats!.totalScore / count) : 0;

        return {
          campaign: c as Campaign,
          propertyName: prop?.name ?? "—",
          propertyLocation: prop?.location ?? "",
          cover,
          assetCount: count,
          avgScore: avg,
          approvedCount: stats?.approvedCount ?? 0,
        };
      });
    } catch {
      return [];
    }
  }, `property:${propertyId}`);
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
  return getOrSetCache(`campaign:bundle:${id}`, 60, async () => {
    const started = Date.now();
    try {
      const camps = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
      if (!camps.length) return getLocalCampaignBundle(id);
      const campaign = camps[0];

      // Scoped queries for ONLY this campaign and its parent property
      const [prop, images, dnaRows, campAssets, selectedModel] = await Promise.all([
        db.select().from(properties).where(eq(properties.id, campaign.propertyId)).limit(1),
        db.select().from(propertyImages).where(eq(propertyImages.propertyId, campaign.propertyId)).orderBy(propertyImages.sort),
        db.select().from(propertyDna).where(eq(propertyDna.propertyId, campaign.propertyId)).limit(1),
        db.select().from(assets).where(eq(assets.campaignId, id)).orderBy(assets.kind),
        getAppSetting<string | undefined>(`campaign-model:${id}`, undefined),
      ]);

      recordDbMetric("getCampaignBundle", Date.now() - started, 1, 4000);

      if (!prop.length) return null;

      return {
        campaign,
        property: prop[0],
        images,
        dna: currentPropertyDNA(prop[0], dnaRows[0]?.data),
        campaigns: [campaign],
        assets: campAssets,
        selectedModel,
      };
    } catch (err) {
      console.warn("PostgreSQL getCampaignBundle failed, falling back to local JSON DB:", err);
      return getLocalCampaignBundle(id);
    }
  }, `campaign:${id}`);
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
    return await db
      .select({
        id: generations.id,
        kind: generations.kind,
        model: generations.model,
        status: generations.status,
        durationMs: generations.durationMs,
        costCents: generations.costCents,
        campaignId: generations.campaignId,
        propertyId: generations.propertyId,
        createdAt: generations.createdAt,
      })
      .from(generations)
      .orderBy(desc(generations.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}

export async function getOverviewActivity() {
  return getOrSetCache("overview:activity", 30, async () => {
    const started = Date.now();
    try {
      if (isLocalJsonDb) {
        const generations = await listRecentGenerations(60);
        const recentGens = generations.slice(0, 7);
        const referenceTime = generations[0] ? new Date(generations[0].createdAt).getTime() : Date.now();
        const spark = Array.from({ length: 8 }, (_, i) => {
          const day = new Date(referenceTime - (7 - i) * 86400000);
          return generations.filter((generation) => new Date(generation.createdAt).toDateString() === day.toDateString()).length;
        });
        return { recentGens, spark };
      }

      // Query only 7 recent generations and spark counts for the last 8 days
      const [recentGens, sparkRows] = await Promise.all([
        db
          .select({
            id: generations.id,
            kind: generations.kind,
            model: generations.model,
            status: generations.status,
            createdAt: generations.createdAt,
          })
          .from(generations)
          .orderBy(desc(generations.createdAt))
          .limit(7),
        db
          .select({
            createdAt: generations.createdAt,
          })
          .from(generations)
          .where(gte(generations.createdAt, new Date(Date.now() - 8 * 86400000)))
          .orderBy(desc(generations.createdAt)),
      ]);

      recordDbMetric("getOverviewActivity", Date.now() - started, recentGens.length, 1200);

      const referenceTime = recentGens[0] ? new Date(recentGens[0].createdAt).getTime() : Date.now();
      const spark = Array.from({ length: 8 }, (_, i) => {
        const day = new Date(referenceTime - (7 - i) * 86400000);
        return sparkRows.filter((generation) => new Date(generation.createdAt).toDateString() === day.toDateString()).length;
      });

      return { recentGens, spark };
    } catch {
      return { recentGens: [], spark: [0, 0, 0, 0, 0, 0, 0, 0] };
    }
  }, "activity");
}

/* ---------------- assets library ---------------- */

export type LibraryAsset = {
  asset: Asset;
  campaignName: string;
  propertyName: string;
  preset: string;
};

export async function listLibraryAssets(propertyId?: string): Promise<LibraryAsset[]> {
  const cacheKey = `assets:library:${propertyId ?? "all"}`;
  return getOrSetCache(cacheKey, 30, async () => {
    const started = Date.now();
    try {
      if (isLocalJsonDb) {
        return await readLocalDatabase((database) => {
          let rows = database.assets;
          if (propertyId) rows = rows.filter((r) => r.propertyId === propertyId);
          return [...rows]
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
            });
        });
      }

      // Explicit projections, excluding heavy designJson
      const [all, camps, props] = await Promise.all([
        propertyId
          ? db
              .select({
                id: assets.id,
                campaignId: assets.campaignId,
                propertyId: assets.propertyId,
                kind: assets.kind,
                platform: assets.platform,
                aspect: assets.aspect,
                title: assets.title,
                payload: assets.payload,
                score: assets.score,
                status: assets.status,
                approved: assets.approved,
                createdAt: assets.createdAt,
              })
              .from(assets)
              .where(eq(assets.propertyId, propertyId))
              .orderBy(desc(assets.createdAt))
          : db
              .select({
                id: assets.id,
                campaignId: assets.campaignId,
                propertyId: assets.propertyId,
                kind: assets.kind,
                platform: assets.platform,
                aspect: assets.aspect,
                title: assets.title,
                payload: assets.payload,
                score: assets.score,
                status: assets.status,
                approved: assets.approved,
                createdAt: assets.createdAt,
              })
              .from(assets)
              .orderBy(desc(assets.createdAt)),
        db
          .select({
            id: campaigns.id,
            name: campaigns.name,
            presetLabel: campaigns.presetLabel,
          })
          .from(campaigns),
        db
          .select({
            id: properties.id,
            name: properties.name,
          })
          .from(properties),
      ]);

      recordDbMetric("listLibraryAssets", Date.now() - started, all.length, all.length * 600);

      const campMap = new Map(camps.map((c) => [c.id, c]));
      const propMap = new Map(props.map((p) => [p.id, p]));

      return all.map((a) => {
        const c = campMap.get(a.campaignId);
        const p = propMap.get(a.propertyId);

        // Strip designJson from payload to avoid transporting massive fabric JSON over network
        const { designJson: _stripped, ...safePayload } = (a.payload || {}) as Record<string, unknown> & { designJson?: unknown };

        return {
          asset: {
            ...a,
            payload: safePayload as any,
            checks: [],
          } as Asset,
          campaignName: c?.name ?? "",
          propertyName: p?.name ?? "",
          preset: c?.presetLabel ?? "",
        };
      });
    } catch {
      return [];
    }
  }, "assets");
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
    invalidateCache("activity");
    invalidateCache("admin");

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
  return getOrSetCache("admin:stats", 60, async () => {
    const started = Date.now();
    try {
      if (isLocalJsonDb) {
        const local = await readLocalDatabase((database) => database);
        const gens = local.generations;
        const camps = local.campaigns;
        const props = local.properties;
        const allAssets = local.assets;
        const imgs = local.propertyImages;

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
      }

      // Efficient Postgres aggregations - zero SELECT *
      const [
        [{ propCount }],
        camps,
        [{ imgCount }],
        allAssets,
        gens,
      ] = await Promise.all([
        db.select({ propCount: sql<number>`count(*)::int` }).from(properties),
        db.select({ status: campaigns.status }).from(campaigns),
        db.select({ imgCount: sql<number>`count(*)::int` }).from(propertyImages),
        db.select({ approved: assets.approved }).from(assets),
        db
          .select({
            id: generations.id,
            kind: generations.kind,
            model: generations.model,
            status: generations.status,
            durationMs: generations.durationMs,
            costCents: generations.costCents,
            createdAt: generations.createdAt,
          })
          .from(generations)
          .orderBy(desc(generations.createdAt))
          .limit(1000),
      ]);

      recordDbMetric("adminStats", Date.now() - started, 1, 2000);

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
        users: 118 + propCount,
        activeCampaigns: camps.filter((c) => c.status !== "archived").length,
        generations: gens.length,
        failed: gens.filter((g) => g.status !== "success").length,
        aiCostCents: gens.reduce((s, g) => s + g.costCents, 0),
        assetsGenerated: allAssets.length,
        approved: allAssets.filter((a) => a.approved).length,
        storageMb: Math.round(imgCount * 4.6 + allAssets.length * 0.9 + 92),
        days,
        models: [...byModel.entries()].map(([model, v]) => ({
          model,
          count: v.n,
          successRate: v.n ? Math.round((1 - v.fail / v.n) * 990) / 10 : 100,
          avgMs: v.n ? Math.round(v.ms / v.n) : 0,
          costCents: v.cost,
        })),
        recent: gens.slice(0, 10),
        openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      };
    } catch {
      return null;
    }
  }, "admin");
}

export type DashboardStats = {
  camps: CampaignRow[];
  lib: { asset: Asset }[];
  brand: BrandSettings;
  ready: number;
  avg: number;
  approved: number;
  byKind: [string, number][];
};

export async function dashboardStats(): Promise<DashboardStats> {
  return getOrSetCache("dashboard:stats", 30, async () => {
    const started = Date.now();
    try {
      if (isLocalJsonDb) {
        const [camps, lib, brand] = await Promise.all([listCampaigns(), listLibraryAssets(), getBrand()]);
        const ready = lib.filter((l) => l.asset.status === "ready").length;
        const avg = lib.length ? Math.round(lib.reduce((s, l) => s + l.asset.score, 0) / lib.length) : 0;
        const approved = lib.filter((l) => l.asset.approved).length;
        const byKind = new Map<string, number>();
        for (const l of lib) byKind.set(l.asset.kind, (byKind.get(l.asset.kind) ?? 0) + 1);
        return { camps, lib, brand, ready, avg, approved, byKind: [...byKind.entries()] };
      }

      // High-efficiency queries:
      // 1. Camps summary (cached listCampaigns)
      // 2. Brand (cached getBrand)
      // 3. Asset metrics (ONLY 4 tiny columns from assets, zero JSON payloads!)
      // 4. ONE single hero asset for the hero visual card
      const [camps, brand, assetMetrics, [heroAsset]] = await Promise.all([
        listCampaigns(),
        getBrand(),
        db
          .select({
            kind: assets.kind,
            score: assets.score,
            status: assets.status,
            approved: assets.approved,
          })
          .from(assets),
        db
          .select()
          .from(assets)
          .where(eq(assets.kind, "hero"))
          .orderBy(desc(assets.score))
          .limit(1)
          .then(async (rows) => {
            if (rows.length) return rows;
            return db.select().from(assets).limit(1);
          }),
      ]);

      recordDbMetric("dashboardStats", Date.now() - started, 1, 1500);

      const ready = assetMetrics.filter((a) => a.status === "ready").length;
      const avg = assetMetrics.length
        ? Math.round(assetMetrics.reduce((s, a) => s + a.score, 0) / assetMetrics.length)
        : 0;
      const approved = assetMetrics.filter((a) => a.approved).length;
      const byKindMap = new Map<string, number>();
      for (const a of assetMetrics) {
        byKindMap.set(a.kind, (byKindMap.get(a.kind) ?? 0) + 1);
      }

      // Return hero asset in lib wrapper for backwards-compatibility with OverviewPage
      const libWrapper = heroAsset ? [{ asset: heroAsset }] : [];

      return {
        camps,
        lib: libWrapper as any,
        brand,
        ready,
        avg,
        approved,
        byKind: [...byKindMap.entries()],
      };
    } catch (err) {
      console.error("dashboardStats error", err);
      const brand = await getBrand();
      return { camps: [], lib: [], brand, ready: 0, avg: 0, approved: 0, byKind: [] };
    }
  }, "dashboard");
}
