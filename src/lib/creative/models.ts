export type OpenRouterModel = {
  id: string;
  name: string;
  contextLength: number;
  description: string;
};

type OpenRouterCatalogModel = {
  id?: string;
  name?: string;
  description?: string;
  context_length?: number;
  architecture?: { modality?: string };
  pricing?: { prompt?: string; completion?: string; image?: string };
};

let cachedCatalog: { expiresAt: number; models: OpenRouterModel[] } | null = null;

function isFreeTextModel(model: OpenRouterCatalogModel) {
  const prompt = Number(model.pricing?.prompt);
  const completion = Number(model.pricing?.completion);
  const modality = model.architecture?.modality?.toLowerCase() ?? "";
  const outputModality = modality.split("->").at(-1) ?? "";
  const explicitlyFree = Boolean(model.id?.endsWith(":free") || model.id === "openrouter/free");
  if (/safety|moderation|embedding|rerank/i.test(`${model.id} ${model.name} ${model.description}`)) return false;
  return Boolean(
    model.id &&
      Number.isFinite(prompt) &&
      Number.isFinite(completion) &&
      prompt === 0 &&
      completion === 0 &&
      (!modality || outputModality.includes("text")) &&
      (!/audio|video|image/.test(outputModality)) &&
      (explicitlyFree || (modality.includes("text") && !/audio|video|image/i.test(model.description ?? "")))
  );
}

const FEATURED_MODELS: OpenRouterModel[] = [
  {
    id: "openai/gpt-4o",
    name: "OpenAI GPT-4o (Recommended Flagship)",
    contextLength: 128_000,
    description: "Flagship SOTA reasoning, high-converting real-estate copywriting and photography art direction.",
  },
  {
    id: "openai/gpt-4o-mini",
    name: "OpenAI GPT-4o Mini",
    contextLength: 128_000,
    description: "Fast, highly capable, cost-effective precision copywriting.",
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "NVIDIA Nemotron 3 Super 120B (Free)",
    contextLength: 131_072,
    description: "Flagship 120B parameter model with excellent instruction-following.",
  },
  {
    id: "openrouter/free",
    name: "OpenRouter Universal Router (Free)",
    contextLength: 128_000,
    description: "Automatically routes across available flagship free models with failover.",
  },
];

export async function listFreeOpenRouterModels(): Promise<OpenRouterModel[]> {
  if (cachedCatalog && cachedCatalog.expiresAt > Date.now()) return cachedCatalog.models;
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return FEATURED_MODELS;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!response.ok) return FEATURED_MODELS;
    const result = (await response.json()) as { data?: OpenRouterCatalogModel[] };
    const dynamicModels = (result.data ?? [])
      .filter(isFreeTextModel)
      .map((model) => ({
        id: model.id!,
        name: model.name || model.id!,
        contextLength: Number(model.context_length) || 0,
        description: model.description?.slice(0, 180) ?? "Free text model",
      }))
      .sort((a, b) => modelScore(b) - modelScore(a) || a.id.localeCompare(b.id));

    // Combine featured models at the top, without duplicates
    const combined = [...FEATURED_MODELS];
    for (const dm of dynamicModels) {
      if (!combined.some((m) => m.id === dm.id)) {
        combined.push(dm);
      }
    }

    cachedCatalog = { models: combined, expiresAt: Date.now() + 5 * 60 * 1000 };
    return combined;
  } catch {
    return FEATURED_MODELS;
  }
}

function modelScore(model: OpenRouterModel) {
  const id = model.id.toLowerCase();
  let score = Math.min(model.contextLength, 128_000) / 4_000;
  if (/gpt-4o/.test(id)) score += 50;
  if (/qwen3|qwen-3/.test(id)) score += 36;
  if (/deepseek-r1|deepseek-v3/.test(id)) score += 34;
  if (/llama-3\.3|llama3\.3/.test(id)) score += 32;
  if (/gemma-3.*27b|gemma3.*27b/.test(id)) score += 30;
  if (/mistral-small/.test(id)) score += 28;
  if (/70b|72b|32b|27b|30b/.test(id)) score += 20;
  if (/8b|7b|3b|1b/.test(id)) score -= 12;
  return score;
}

export async function resolveOpenRouterModel(selection?: string) {
  if (selection && selection !== "auto") return selection;
  const configured = process.env.OPENROUTER_MODEL?.trim();
  if (configured) return configured;
  try {
    const models = await listFreeOpenRouterModels();
    if (models[0]?.id) return models[0].id;
  } catch {
    // Fall back to gpt-4o
  }
  return "openai/gpt-4o";
}

export async function isFreeOpenRouterModel(modelId: string) {
  if (!modelId) return false;
  if (modelId === "auto") return true;
  const configured = process.env.OPENROUTER_MODEL?.trim();
  if (configured && modelId === configured) return true;
  if (FEATURED_MODELS.some((m) => m.id === modelId)) return true;
  try {
    return (await listFreeOpenRouterModels()).some((model) => model.id === modelId);
  } catch {
    return true; // Don't block user's choice on network error
  }
}
