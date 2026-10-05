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

export async function listFreeOpenRouterModels(): Promise<OpenRouterModel[]> {
  if (cachedCatalog && cachedCatalog.expiresAt > Date.now()) return cachedCatalog.models;
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return [];

  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`OpenRouter model catalog returned ${response.status}.`);
  const result = (await response.json()) as { data?: OpenRouterCatalogModel[] };
  const models = (result.data ?? [])
    .filter(isFreeTextModel)
    .map((model) => ({
      id: model.id!,
      name: model.name || model.id!,
      contextLength: Number(model.context_length) || 0,
      description: model.description?.slice(0, 180) ?? "Free text model",
    }))
    .sort((a, b) => modelScore(b) - modelScore(a) || a.id.localeCompare(b.id));

  cachedCatalog = { models, expiresAt: Date.now() + 5 * 60 * 1000 };
  return models;
}

function modelScore(model: OpenRouterModel) {
  const id = model.id.toLowerCase();
  let score = Math.min(model.contextLength, 128_000) / 4_000;
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
  try {
    const models = await listFreeOpenRouterModels();
    if (models[0]?.id) return models[0].id;
  } catch {
    // Automatic mode stays local if the free-model catalog is unavailable.
  }
  return null;
}

export async function isFreeOpenRouterModel(modelId: string) {
  try {
    return (await listFreeOpenRouterModels()).some((model) => model.id === modelId);
  } catch {
    return false;
  }
}
