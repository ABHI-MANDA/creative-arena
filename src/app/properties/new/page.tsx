"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDashed,
  Dna,
  Globe,
  ImagePlus,
  LayoutGrid,
  Link2,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { SAMPLE_BLUEPRINTS, SAMPLE_SHOTS } from "@/lib/creative/presets";
import { cx } from "@/lib/utils";

type ImgPick = { url: string; label: string };

const TYPE_CHIPS = [
  "4 BHK Luxury Villas",
  "3 BHK Apartments",
  "2/3/4 BHK Sky Residences",
  "Penthouse Collection",
  "Plotted Development",
];

type Source = "url" | "upload" | "samples";

export default function NewPropertyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 source · 1 brief · 2 analyzing
  const [source, setSource] = useState<Source>("samples");
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [images, setImages] = useState<ImgPick[]>([]);
  const [brief, setBrief] = useState({
    name: "",
    location: "",
    propertyType: "",
    price: "",
    audience: "",
    amenities: "",
    description: "",
  });
  const [error, setError] = useState("");
  const [analysisStep, setAnalysisStep] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof brief) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setBrief((b) => ({ ...b, [k]: e.target.value }));

  const applyBlueprint = (bpId: string) => {
    const bp = SAMPLE_BLUEPRINTS.find((b) => b.id === bpId)!;
    setBrief({
      name: bp.name,
      location: bp.location,
      propertyType: bp.propertyType,
      price: bp.price,
      audience: bp.audience,
      amenities: bp.amenities,
      description: bp.description,
    });
    setImages(SAMPLE_SHOTS.filter((s) => s.set === bpId || s.set === "both").map((s) => ({ url: s.url, label: s.label })));
  };

  const toggleShot = (s: ImgPick) =>
    setImages((cur) => (cur.some((i) => i.url === s.url) ? cur.filter((i) => i.url !== s.url) : [...cur, s]));

  const fetchFromUrl = async () => {
    if (!url.trim()) return;
    setFetching(true);
    setFetched(false);
    setError("");
    try {
      const res = await fetch("/api/properties/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json()) as {
        brief?: typeof brief;
        images?: ImgPick[];
        error?: string;
      };
      if (!res.ok || data.error || !data.brief) {
        throw new Error(data.error ?? "Failed to extract details from webpage.");
      }
      setBrief(data.brief);
      if (data.images?.length) {
        setImages(data.images);
      }
      setFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract webpage content.");
    } finally {
      setFetching(false);
    }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files).slice(0, 10)) {
      const dataUrl = await new Promise<string>((resolve) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = () => {
          img.onload = () => {
            const scale = Math.min(1, 1000 / img.width);
            const c = document.createElement("canvas");
            c.width = Math.round(img.width * scale);
            c.height = Math.round(img.height * scale);
            c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL("image/jpeg", 0.82));
          };
          img.src = String(reader.result);
        };
        reader.readAsDataURL(f);
      });
      setImages((cur) => [...cur, { url: dataUrl, label: "Upload" }]);
    }
  };

  const valid = useMemo(
    () => brief.name.trim() && brief.location.trim() && brief.propertyType.trim() && brief.price.trim() && images.length > 0,
    [brief, images]
  );

  const ANALYSIS = [
    "Ingesting project imagery",
    "Vision pass — extracting exterior, interior, amenities",
    "Resolving architecture, palette & lighting",
    "Composing project Creative DNA",
    "Registering property in the studio",
  ];

  const analyze = async () => {
    setStep(2);
    setAnalysisStep(0);
    const timer = setInterval(() => setAnalysisStep((s) => Math.min(s + 1, ANALYSIS.length - 1)), 620);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, images, source, sourceUrl: url }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? "Failed to create property");
      setTimeout(() => {
        clearInterval(timer);
        router.push(`/properties/${data.id}?fresh=1`);
      }, ANALYSIS.length * 620);
    } catch (e) {
      clearInterval(timer);
      setError(e instanceof Error ? e.message : "Failed");
      setStep(1);
    }
  };

  return (
    <div className="mx-auto max-w-[1180px]">
      <Link href="/properties" className="mb-5 inline-flex items-center gap-2 text-[12.5px] text-faint transition-colors hover:text-gold">
        <ArrowLeft size={14} /> Back to properties
      </Link>

      {/* stepper */}
      <div className="anim-up mb-7 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.24em]">
        {["Source", "Creative Brief", "AI Analysis"].map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <span className={cx("flex h-6 w-6 items-center justify-center rounded-full border text-[10px]",
              i < step ? "border-sage/50 bg-sage/10 text-sage" : i === step ? "border-gold/60 bg-gold/10 text-gold" : "border-line text-faint")}>
              {i < step ? <Check size={11} strokeWidth={3} /> : i + 1}
            </span>
            <span className={i === step ? "text-cream" : "text-faint"}>{s}</span>
            {i < 2 && <span className="h-px w-8 bg-line" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="anim-up grid gap-6 lg:grid-cols-[1.55fr_1fr]">
          <div className="panel p-6 md:p-7">
            <h1 className="font-display text-[28px] font-medium">Bring in a property</h1>
            <p className="mt-1.5 text-[13px] text-mute">
              Three ways in. M &amp; A reads the photography — never invents a different building.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-ink/60 p-1.5 hairline">
              {([
                { id: "url", label: "Website URL", icon: Globe },
                { id: "upload", label: "Upload Photos", icon: ImagePlus },
                { id: "samples", label: "Sample Library", icon: LayoutGrid },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSource(t.id)}
                  className={cx(
                    "flex flex-col items-center gap-1.5 rounded-xl px-2 py-3.5 text-[11.5px] transition-all sm:flex-row sm:justify-center sm:gap-2",
                    source === t.id ? "bg-panel2 text-gold shadow-[inset_0_0_0_1px_rgba(217,171,94,.35)]" : "text-faint hover:text-mute"
                  )}
                >
                  <t.icon size={15} /> {t.label}
                </button>
              ))}
            </div>

            {source === "url" && (
              <div className="anim-up mt-5">
                <div className="label mb-2">Project or listing URL</div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https:// developer.in/projects/green-valley"
                      className="input pl-10"
                    />
                  </div>
                  <button onClick={fetchFromUrl} disabled={fetching || !url.trim()} className="btn-gold flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-semibold disabled:opacity-40">
                    {fetching ? <Loader2 size={14} className="spin-slow" /> : <Sparkles size={14} />}
                    Fetch details
                  </button>
                </div>
                {fetching && (
                  <div className="mt-4 space-y-2">
                    <div className="shimmer h-3 w-2/3 rounded bg-panel2" />
                    <div className="shimmer h-3 w-1/2 rounded bg-panel2" />
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Reading listing page — extracting brief + photography…</p>
                  </div>
                )}
                {fetched && !fetching && (
                  <p className="mt-3 flex items-center gap-2 text-[12px] text-sage">
                    <Check size={13} /> Brief extracted from page — review it on the next step.
                  </p>
                )}
              </div>
            )}

            {source === "upload" && (
              <div className="anim-up mt-5">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-ink/40 px-6 py-10 text-mute transition-all hover:border-gold/50 hover:text-gold"
                >
                  <ImagePlus size={22} />
                  <span className="text-[13px]">Drop property photos or click to browse</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-faint">JPG / PNG · up to 10 · resized locally</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
              </div>
            )}

            {source === "samples" && (
              <div className="anim-up mt-5">
                <div className="label mb-2">Quick start from a reference project</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SAMPLE_BLUEPRINTS.map((bp) => (
                    <button key={bp.id} onClick={() => applyBlueprint(bp.id)} className="sel-card rounded-xl px-4 py-3.5 text-left">
                      <div className="text-[13.5px] font-medium">{bp.name}</div>
                      <div className="mt-0.5 text-[11.5px] text-faint">{bp.location} · {bp.propertyType}</div>
                    </button>
                  ))}
                </div>
                <div className="label mb-2 mt-5">Or pick individual shots</div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {SAMPLE_SHOTS.map((s) => {
                    const on = images.some((i) => i.url === s.url);
                    return (
                      <button key={s.url + s.label} onClick={() => toggleShot({ url: s.url, label: s.label })} className={cx("sel-card relative overflow-hidden rounded-xl", on && "sel-on")}>
                        <div className="aspect-[4/3] w-full">
                          <img src={s.url} alt={s.label} className="h-full w-full object-cover" />
                        </div>
                        <div className="px-2 py-1.5 text-left font-mono text-[9px] uppercase tracking-widest text-mute">{s.label}</div>
                        {on && (
                          <span className="absolute right-1.5 top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-gold text-[#171208]">
                            <Check size={10} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                {images.length} shot{images.length === 1 ? "" : "s"} staged
              </span>
              <button onClick={() => setStep(1)} disabled={images.length === 0} className="btn-gold flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold disabled:opacity-40">
                Continue to brief <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* staged shots rail */}
          <div className="anim-up anim-d1 panel h-fit p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-mute">Staged shots</span>
              <span className="font-mono text-[11px] text-gold">{images.length}</span>
            </div>
            {images.length === 0 ? (
              <p className="text-[12px] text-faint">Shots you stage appear here. The exterior shot becomes the campaign cover.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {images.map((im, i) => (
                  <div key={im.url + i} className="group relative overflow-hidden rounded-xl hairline">
                    <img src={im.url} alt={im.label} className="aspect-[4/3] w-full object-cover" />
                    <span className="absolute left-1.5 top-1.5 rounded bg-ink/75 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-widest text-cream/85">{im.label}</span>
                    <button onClick={() => setImages((c) => c.filter((x) => x.url !== im.url))} className="absolute right-1.5 top-1.5 rounded-full bg-ink/75 p-1 text-cream/70 opacity-0 transition-opacity group-hover:opacity-100">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="anim-up grid gap-6 lg:grid-cols-[1.55fr_1fr]">
          <div className="panel p-6 md:p-7">
            <h1 className="font-display text-[28px] font-medium">What are you promoting?</h1>
            <p className="mt-1.5 text-[13px] text-mute">
              A brief, not a prompt. M &amp; A turns these answers into prompts internally — your team never writes one.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="label mb-1.5">Property / Project name</div>
                <input className="input" value={brief.name} onChange={set("name")} placeholder="Green Valley Estates" />
              </div>
              <div>
                <div className="label mb-1.5">Location</div>
                <input className="input" value={brief.location} onChange={set("location")} placeholder="Whitefield, Bengaluru" />
              </div>
              <div className="sm:col-span-2">
                <div className="label mb-1.5">Property type</div>
                <input className="input" value={brief.propertyType} onChange={set("propertyType")} placeholder="4 BHK Luxury Villas" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TYPE_CHIPS.map((t) => (
                    <button key={t} onClick={() => setBrief((b) => ({ ...b, propertyType: t }))} className={cx("rounded-full border px-3 py-1.5 text-[11px] transition-all", brief.propertyType === t ? "border-gold/60 bg-gold/10 text-gold" : "border-line text-faint hover:text-mute")}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="label mb-1.5">Price</div>
                <input className="input" value={brief.price} onChange={set("price")} placeholder="₹4.8 Cr onwards" />
              </div>
              <div>
                <div className="label mb-1.5">Target audience</div>
                <input className="input" value={brief.audience} onChange={set("audience")} placeholder="CXOs, premium family buyers" />
              </div>
              <div className="sm:col-span-2">
                <div className="label mb-1.5">Key amenities — comma separated</div>
                <textarea className="input min-h-[72px]" value={brief.amenities} onChange={set("amenities")} placeholder="Private garden, Smart home, Clubhouse, Infinity pool" />
              </div>
              <div className="sm:col-span-2">
                <div className="label mb-1.5">One-line story</div>
                <textarea className="input min-h-[72px]" value={brief.description} onChange={set("description")} placeholder="A gated enclave of courtyard villas wrapped in tropical landscaping…" />
              </div>
            </div>

            {error && <p className="mt-4 text-[12.5px] text-rust">{error}</p>}

            <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
              <button onClick={() => setStep(0)} className="btn-ghost rounded-xl px-4 py-2.5 text-[12.5px] text-mute">
                <ArrowLeft size={13} className="mr-1.5 inline" /> Source
              </button>
              <button onClick={analyze} disabled={!valid} className="btn-gold flex items-center gap-2 rounded-xl px-6 py-3 text-[13.5px] font-semibold disabled:opacity-40">
                <Dna size={15} /> Analyze & build Creative DNA
              </button>
            </div>
          </div>

          <div className="anim-up anim-d1 panel h-fit p-5">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.24em] text-mute">Brief preview</div>
            <dl className="space-y-3 text-[13px]">
              {([
                ["Project", brief.name],
                ["Location", brief.location],
                ["Type", brief.propertyType],
                ["Price", brief.price],
                ["Audience", brief.audience],
                ["Amenities", brief.amenities],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-widest text-faint">{k}</dt>
                  <dd className={cx("min-w-0", v ? "text-cream/90" : "text-faint/60")}>{v || "—"}</dd>
                </div>
              ))}
            </dl>
            {images[0] && (
              <div className="mt-5 overflow-hidden rounded-xl hairline">
                <img src={images[0].url} alt="cover" className="aspect-[16/9] w-full object-cover" />
              </div>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="anim-up panel mx-auto max-w-xl p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold hairline">
              <Dna size={18} />
            </div>
            <div>
              <div className="font-display text-lg">Extracting Creative DNA</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">{brief.name}</div>
            </div>
          </div>
          <div className="space-y-3.5">
            {ANALYSIS.map((l, i) => (
              <div key={l} className={cx("flex items-center gap-3 text-[13.5px]", i < analysisStep ? "text-sage" : i === analysisStep ? "text-cream" : "text-faint/60")}>
                {i < analysisStep ? <Check size={14} strokeWidth={3} /> : i === analysisStep ? <Loader2 size={14} className="spin-slow text-gold" /> : <CircleDashed size={14} />}
                {l}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
