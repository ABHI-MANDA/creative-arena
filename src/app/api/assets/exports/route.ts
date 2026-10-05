import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { updateLocalDatabase } from "@/db/local-json";
import { isLocalJsonDb } from "@/db";

export const dynamic = "force-dynamic";

const MIME_TYPES = { png: "image/png", jpeg: "image/jpeg" } as const;
type ExportFormat = keyof typeof MIME_TYPES;
type ExportItem = { assetId: string; format: ExportFormat };

export async function POST(req: Request) {
  if (!isLocalJsonDb) {
    return Response.json({ error: "Persistent media export storage is enabled only in local JSON mode." }, { status: 501 });
  }

  try {
    const form = await req.formData();
    const rawItems = form.get("items");
    if (typeof rawItems !== "string") return Response.json({ error: "Export manifest is required." }, { status: 400 });

    const items = JSON.parse(rawItems) as ExportItem[];
    const files = form.getAll("files");
    if (!Array.isArray(items) || !items.length || items.length > 50 || items.length !== files.length) {
      return Response.json({ error: "Export manifest does not match its files." }, { status: 400 });
    }

    const uploads = items.map((item, index) => ({ item, file: files[index] }));
    const totalBytes = uploads.reduce((total, upload) => total + (upload.file instanceof File ? upload.file.size : 0), 0);
    if (totalBytes > 100 * 1024 * 1024) return Response.json({ error: "Export package exceeds 100 MB." }, { status: 413 });

    for (const { item, file } of uploads) {
      if (!/^[\da-f-]{36}$/i.test(item.assetId) || !(item.format in MIME_TYPES) || !(file instanceof File)) {
        return Response.json({ error: "Invalid exported file entry." }, { status: 400 });
      }
      if (file.type !== MIME_TYPES[item.format] || file.size > 20 * 1024 * 1024) {
        return Response.json({ error: "Unsupported image type or file exceeds 20 MB." }, { status: 413 });
      }
    }

    const assetIds = new Set(items.map((item) => item.assetId));
    const directory = path.join(process.cwd(), ".local-db", "exports");
    await mkdir(directory, { recursive: true });
    await Promise.all(uploads.map(async ({ item, file }) => {
      const destination = path.join(directory, `${item.assetId}.${item.format}`);
      const temporaryPath = `${destination}.${process.pid}.tmp`;
      await writeFile(temporaryPath, Buffer.from(await (file as File).arrayBuffer()));
      await rename(temporaryPath, destination);
    }));

    await updateLocalDatabase((database) => {
      const existingIds = new Set(database.assets.filter((asset) => assetIds.has(asset.id)).map((asset) => asset.id));
      if (existingIds.size !== assetIds.size) throw new Error("One or more assets no longer exist.");
      for (const item of items) {
        const asset = database.assets.find((row) => row.id === item.assetId);
        if (asset) {
          asset.payload.exportFiles = {
            ...asset.payload.exportFiles,
            [item.format]: `.local-db/exports/${item.assetId}.${item.format}`,
          };
        }
      }
    });

    return Response.json({ stored: items.length });
  } catch (error) {
    console.error("campaign export storage failed", error);
    return Response.json({ error: "Failed to store exported campaign images." }, { status: 500 });
  }
}