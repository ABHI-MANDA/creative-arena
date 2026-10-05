"use client";

import { useEffect, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { AssetVisual, type AdAssetLike } from "@/components/ad-creative";
import { KIND_LABELS, PLATFORMS, type BrandSettings } from "@/lib/creative/presets";
import {
  DEFAULT_TEMPLATE_LIBRARY,
  SUPPORTED_TEMPLATE_KINDS,
  type CustomAdTemplate,
  type TemplateLibrary,
} from "@/lib/creative/template-library";

export function TemplateManager({
  samples,
  brand,
}: {
  samples: AdAssetLike[];
  brand: BrandSettings;
}) {
  const [library, setLibrary] = useState<TemplateLibrary>(DEFAULT_TEMPLATE_LIBRARY);
  const [name, setName] = useState("");
  const [kind, setKind] = useState(SUPPORTED_TEMPLATE_KINDS[0]);
  const [instructions, setInstructions] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/templates")
      .then((response) => response.json())
      .then((data: TemplateLibrary) => setLibrary(data))
      .catch(() => setMessage("Could not load saved templates."));
  }, []);

  const saveLibrary = async (next: TemplateLibrary) => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const result = (await response.json()) as TemplateLibrary & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Save failed.");
      setLibrary(result);
      setMessage("Templates saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save templates.");
    } finally {
      setSaving(false);
    }
  };

  const toggleBuiltIn = (templateKind: string) => {
    const enabledKinds = library.enabledKinds.includes(templateKind)
      ? library.enabledKinds.filter((entry) => entry !== templateKind)
      : [...library.enabledKinds, templateKind];
    void saveLibrary({ ...library, enabledKinds });
  };

  const addTemplate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !instructions.trim()) return;
    const template: CustomAdTemplate = {
      id: crypto.randomUUID(),
      name: name.trim(),
      kind,
      platforms,
      instructions: instructions.trim(),
      createdAt: new Date().toISOString(),
    };
    void saveLibrary({ ...library, customTemplates: [...library.customTemplates, template] });
    setName("");
    setInstructions("");
    setPlatforms([]);
  };

  const togglePlatform = (platform: string) =>
    setPlatforms((selected) => selected.includes(platform)
      ? selected.filter((entry) => entry !== platform)
      : [...selected, platform]);

  const restoreDefaults = () => void saveLibrary({ ...DEFAULT_TEMPLATE_LIBRARY, customTemplates: library.customTemplates });

  return (
    <section className="panel mb-8 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display text-[19px]">Template Library</h2>
          <p className="mt-1 text-[12px] text-mute">Remove formats you don’t use, or add reusable creative direction for generation.</p>
        </div>
        <button type="button" onClick={restoreDefaults} disabled={saving} className="btn-ghost flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] text-mute disabled:opacity-50">
          <RotateCcw size={13} /> Restore defaults
        </button>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Built-in formats</h3>
          <div className="space-y-1">
            {SUPPORTED_TEMPLATE_KINDS.map((templateKind) => {
              const enabled = library.enabledKinds.includes(templateKind);
              return (
                <label key={templateKind} className="flex cursor-pointer items-center justify-between gap-3 border-b border-line/60 py-2.5 text-[12px]">
                  <span>{KIND_LABELS[templateKind] ?? templateKind}</span>
                  <input type="checkbox" checked={enabled} disabled={saving} onChange={() => toggleBuiltIn(templateKind)} aria-label={`Enable ${KIND_LABELS[templateKind] ?? templateKind}`} />
                </label>
              );
            })}
          </div>

          <h3 className="mb-3 mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Add custom direction</h3>
          <form onSubmit={addTemplate} className="space-y-3">
            <label className="block text-[11px] text-mute">
              Template name
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required className="input mt-1 w-full" placeholder="e.g. Investor proof points" />
            </label>
            <label className="block text-[11px] text-mute">
              Format
              <select value={kind} onChange={(event) => setKind(event.target.value)} className="input mt-1 w-full">
                {SUPPORTED_TEMPLATE_KINDS.map((templateKind) => <option key={templateKind} value={templateKind}>{KIND_LABELS[templateKind] ?? templateKind}</option>)}
              </select>
            </label>
            <fieldset>
              <legend className="mb-1.5 text-[11px] text-mute">Platforms (leave clear for all)</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {PLATFORMS.map((platform) => (
                  <label key={platform.id} className="flex items-center gap-1.5 text-[10px] text-faint">
                    <input type="checkbox" checked={platforms.includes(platform.id)} onChange={() => togglePlatform(platform.id)} />
                    {platform.short}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-[11px] text-mute">
              Reusable creative instructions
              <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={1200} required rows={3} className="input mt-1 w-full resize-y" placeholder="Describe the audience, proof points, tone, layout, and facts the model must not invent." />
            </label>
            <button type="submit" disabled={saving || !name.trim() || !instructions.trim()} className="btn-gold flex items-center gap-2 rounded-lg px-3.5 py-2 text-[11px] font-semibold disabled:opacity-50">
              <Plus size={13} /> Add template
            </button>
          </form>
        </div>

        <div>
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Custom templates · {library.customTemplates.length}</h3>
          {library.customTemplates.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line p-4 text-[12px] text-faint">No custom templates yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {library.customTemplates.map((template) => {
                const sample = samples.find((entry) => entry.kind === template.kind) ?? samples[0];
                return (
                  <article key={template.id} className="overflow-hidden rounded-lg border border-line bg-panel">
                    {sample && <AssetVisual asset={sample} brand={brand} />}
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="truncate text-[12px] font-medium">{template.name}</h4>
                          <p className="mt-0.5 font-mono text-[9px] uppercase text-faint">{KIND_LABELS[template.kind]} · {template.platforms.length ? template.platforms.join(", ") : "All platforms"}</p>
                        </div>
                        <button type="button" title={`Remove ${template.name}`} onClick={() => void saveLibrary({ ...library, customTemplates: library.customTemplates.filter((entry) => entry.id !== template.id) })} className="text-faint hover:text-rust">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="mt-2 line-clamp-3 text-[10px] leading-relaxed text-mute">{template.instructions}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <p aria-live="polite" className="mt-3 min-h-4 text-[11px] text-faint">{saving ? "Saving…" : message}</p>
        </div>
      </div>

      <div className="border-t border-line px-5 py-5">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Active previews</div>
        <div className="nice-scroll flex snap-x gap-4 overflow-x-auto pb-2">
          {samples.filter((sample) => library.enabledKinds.includes(sample.kind)).map((sample, index) => (
            <div key={`${sample.kind}-${sample.platform}-${index}`} className="w-[220px] shrink-0 snap-start overflow-hidden rounded-lg border border-line">
              <AssetVisual asset={sample} brand={brand} />
              <div className="border-t border-line p-3 text-[11px] font-medium">{KIND_LABELS[sample.kind]}{sample.platform === "linkedin" ? " · Wide" : ""}</div>
            </div>
          ))}
          {library.enabledKinds.length === 0 && <p className="text-[12px] text-faint">All built-in formats are removed. Restore any format to preview it here.</p>}
        </div>
      </div>
    </section>
  );
}
