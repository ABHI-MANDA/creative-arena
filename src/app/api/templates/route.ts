import { NextResponse } from "next/server";
import { getAppSetting, setAppSetting } from "@/db/queries";
import {
  DEFAULT_TEMPLATE_LIBRARY,
  SUPPORTED_TEMPLATE_KINDS,
  SUPPORTED_TEMPLATE_PLATFORMS,
  TEMPLATE_LIBRARY_KEY,
  type CustomAdTemplate,
  type TemplateLibrary,
} from "@/lib/creative/template-library";

export const dynamic = "force-dynamic";

function sanitizeLibrary(value: Partial<TemplateLibrary>): TemplateLibrary {
  const enabledKinds = Array.isArray(value.enabledKinds)
    ? [...new Set(value.enabledKinds.filter((kind): kind is string => SUPPORTED_TEMPLATE_KINDS.includes(kind)))]
    : DEFAULT_TEMPLATE_LIBRARY.enabledKinds;
  const customTemplates = Array.isArray(value.customTemplates)
    ? value.customTemplates
        .filter((template): template is CustomAdTemplate =>
          Boolean(
            template &&
              typeof template.id === "string" &&
              typeof template.name === "string" &&
              SUPPORTED_TEMPLATE_KINDS.includes(template.kind) &&
              typeof template.instructions === "string"
          )
        )
        .slice(0, 30)
        .map((template) => ({
          id: template.id.slice(0, 80),
          name: template.name.trim().slice(0, 80),
          kind: template.kind,
          platforms: Array.isArray(template.platforms)
            ? [...new Set(template.platforms.filter((platform) => SUPPORTED_TEMPLATE_PLATFORMS.includes(platform)))]
            : [],
          instructions: template.instructions.trim().slice(0, 1200),
          createdAt: template.createdAt,
        }))
        .filter((template) => template.name && template.instructions)
    : [];

  return { enabledKinds, customTemplates };
}

export async function GET() {
  return NextResponse.json(await getAppSetting(TEMPLATE_LIBRARY_KEY, DEFAULT_TEMPLATE_LIBRARY));
}

export async function PUT(req: Request) {
  try {
    const value = sanitizeLibrary((await req.json()) as Partial<TemplateLibrary>);
    await setAppSetting(TEMPLATE_LIBRARY_KEY, value);
    return NextResponse.json(value);
  } catch {
    return NextResponse.json({ error: "Could not save template library." }, { status: 400 });
  }
}
