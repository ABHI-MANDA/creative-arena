import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type {
  assets,
  campaigns,
  generations,
  properties,
  propertyDna,
  propertyImages,
  settings,
} from "./schema";

type LocalRows = {
  properties: (typeof properties.$inferSelect)[];
  propertyImages: (typeof propertyImages.$inferSelect)[];
  propertyDna: (typeof propertyDna.$inferSelect)[];
  campaigns: (typeof campaigns.$inferSelect)[];
  assets: (typeof assets.$inferSelect)[];
  generations: (typeof generations.$inferSelect)[];
  settings: (typeof settings.$inferSelect)[];
};

export type LocalJsonDatabase = LocalRows & { schemaVersion: 1 };

const TABLES = [
  "properties",
  "propertyImages",
  "propertyDna",
  "campaigns",
  "assets",
  "generations",
  "settings",
] as const satisfies readonly (keyof LocalRows)[];

const EMPTY_DATABASE: LocalJsonDatabase = {
  schemaVersion: 1,
  properties: [],
  propertyImages: [],
  propertyDna: [],
  campaigns: [],
  assets: [],
  generations: [],
  settings: [],
};

const DATA_DIRECTORY = path.join(process.cwd(), ".local-db");
const DATA_FILE = path.join(DATA_DIRECTORY, "database.json");
const globalForLocalDatabase = globalThis as typeof globalThis & {
  __arenaLocalJsonDatabaseQueue?: Promise<unknown>;
};

function createEmptyDatabase(): LocalJsonDatabase {
  return {
    schemaVersion: 1,
    properties: [],
    propertyImages: [],
    propertyDna: [],
    campaigns: [],
    assets: [],
    generations: [],
    settings: [],
  };
}

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const queue = globalForLocalDatabase.__arenaLocalJsonDatabaseQueue ?? Promise.resolve();
  const result = queue.then(operation, operation);
  globalForLocalDatabase.__arenaLocalJsonDatabaseQueue = result.then(() => undefined, () => undefined);
  return result;
}

function normalizeDatabase(value: unknown): LocalJsonDatabase {
  if (!value || typeof value !== "object") {
    throw new Error(`Local JSON database at ${DATA_FILE} is not a valid object.`);
  }

  const parsed = value as Record<string, unknown>;
  if (parsed.schemaVersion !== 1) {
    throw new Error(`Unsupported local JSON database schema version: ${String(parsed.schemaVersion)}.`);
  }

  const database = createEmptyDatabase();
  for (const table of TABLES) {
    const rows = parsed[table];
    if (!Array.isArray(rows)) {
      throw new Error(`Local JSON database table "${table}" is missing or invalid.`);
    }
    (database[table] as unknown[]) = rows;
  }

  for (const table of ["properties", "propertyDna", "campaigns", "assets", "generations"] as const) {
    const rows = database[table] as { createdAt: Date }[];
    (database as unknown as Record<string, unknown>)[table] = rows.map((row) => ({
      ...row,
      createdAt: new Date(row.createdAt),
    }));
  }

  return database;
}

async function loadDatabase(): Promise<LocalJsonDatabase> {
  try {
    return normalizeDatabase(JSON.parse(await readFile(DATA_FILE, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return createEmptyDatabase();
    throw error;
  }
}

async function saveDatabase(database: LocalJsonDatabase): Promise<void> {
  await mkdir(DATA_DIRECTORY, { recursive: true });
  const temporaryFile = `${DATA_FILE}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(database, null, 2)}\n`, "utf8");
  await rename(temporaryFile, DATA_FILE);
}

export function readLocalDatabase<T>(read: (database: LocalJsonDatabase) => T): Promise<T> {
  return serialize(async () => read(await loadDatabase()));
}

export function updateLocalDatabase<T>(
  update: (database: LocalJsonDatabase) => T | Promise<T>
): Promise<T> {
  return serialize(async () => {
    const database = await loadDatabase();
    const result = await update(database);
    await saveDatabase(database);
    return result;
  });
}
