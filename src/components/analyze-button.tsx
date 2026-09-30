"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dna, Loader2 } from "lucide-react";

export function AnalyzeButton({ propertyId, label = "Run AI Analysis" }: { propertyId: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/properties/${propertyId}/analyze`, { method: "POST" });
        router.refresh();
      }}
      className="btn-gold flex items-center gap-2 rounded-xl px-5 py-2.5 text-[12.5px] font-semibold disabled:opacity-50"
    >
      {busy ? <Loader2 size={14} className="spin-slow" /> : <Dna size={14} />}
      {busy ? "Analyzing…" : label}
    </button>
  );
}
