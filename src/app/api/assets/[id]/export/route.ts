import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { readLocalDatabase, updateLocalDatabase } from "@/db/local-json";
import { isLocalJsonDb } from "@/db";

export const dynamic = "force-dynamic";

const MIME_TYPES = {
  png: "image/png",
  jpeg: "image/jpeg",
} as const;

type ExportFormat = keyof typeof MIME_TYPES;

function isExportFormat(value: string | null): value is ExportFormat {
  return value === "png" || value === "jpeg";
}

function exportPath(id: string, format: ExportFormat) {
  return path.join(process.cwd(), ".local-db", "exports", `${id}.${format}`);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isLocalJsonDb) {
    return Response.json({ error: "Persistent media export storage is enabled only in local JSON mode." }, { status: 501 });
  }

  try {
    const { id } = await params;
    const form = await req.formData();
    const file = form.get("file");
    const formatValue = form.get("format");
    const format = typeof formatValue === "string" && isExportFormat(formatValue) ? formatValue : null;

    if (!/^[\da-f-]{36}$/i.test(id) || !format || !(file instanceof File)) {
      return Response.json({ error: "A valid asset ID, PNG/JPEG format, and file are required." }, { status: 400 });
    }
    if (file.type !== MIME_TYPES[format] || file.size > 20 * 1024 * 1024) {
      return Response.json({ error: "Unsupported image type or file exceeds 20 MB." }, { status: 413 });
    }

    const assetExists = await readLocalDatabase((database) => database.assets.some((asset) => asset.id === id));
    if (!assetExists) return Response.json({ error: "Asset not found." }, { status: 404 });

    const destination = exportPath(id, format);
    await mkdir(path.dirname(destination), { recursive: true });
    const temporaryPath = `${destination}.${process.pid}.tmp`;
    await writeFile(temporaryPath, Buffer.from(await file.arrayBuffer()));
    await rename(temporaryPath, destination);

    await updateLocalDatabase((database) => {
      const asset = database.assets.find((row) => row.id === id);
      if (asset) {
        asset.payload.exportFiles = {
          ...asset.payload.exportFiles,
          [format]: `.local-db/exports/${id}.${format}`,
        };
      }
    });

    const bytes = await readFile(destination);
    return new Response(bytes, {
      headers: {
        "Content-Type": MIME_TYPES[format],
        "Content-Disposition": `attachment; filename="${id}.${format}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("asset export storage failed", error);
    return Response.json({ error: "Failed to store exported image." }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isLocalJsonDb) return Response.json({ error: "Persistent media export storage is enabled only in local JSON mode." }, { status: 501 });

  const { id } = await params;
  const formatValue = new URL(req.url).searchParams.get("format");
  if (!/^[\da-f-]{36}$/i.test(id) || !isExportFormat(formatValue)) {
    return Response.json({ error: "A valid asset ID and PNG/JPEG format are required." }, { status: 400 });
  }

  const relativePath = await readLocalDatabase((database) =>
    database.assets.find((asset) => asset.id === id)?.payload.exportFiles?.[formatValue] ?? null
  );
  if (!relativePath) return Response.json({ error: "Export not found." }, { status: 404 });

  try {
    const bytes = await readFile(exportPath(id, formatValue));
    return new Response(bytes, {
      headers: {
        "Content-Type": MIME_TYPES[formatValue],
        "Content-Disposition": `attachment; filename="${id}.${formatValue}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "Stored export file is missing." }, { status: 404 });
  }
}