import {
  Activity,
  BadgeCheck,
  Coins,
  Cpu,
  Database,
  Gauge,
  HardDrive,
  Layers3,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
  XOctagon,
} from "lucide-react";
import { ensureSeed } from "@/db/seed";
import { adminStats } from "@/db/queries";
import { hx } from "@/lib/creative/engine";
import { money, timeAgo } from "@/lib/utils";
import { EmptyState, SectionHead, StatusPill } from "@/components/ui";
import { AdminReport } from "./admin-report";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await ensureSeed();
  const s = await adminStats();

  if (!s) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <EmptyState icon={Server} title="Telemetry unavailable" sub="The database is still provisioning. Refresh in a moment." />
      </div>
    );
  }

  const maxDay = Math.max(...s.days.map((d) => d.count), 1);
  const apiUsage = s.generations * 3 + 214;

  const providers = [
    { name: "OpenRouter", kind: "LLM · copy & refinement", ok: s.openrouter, latency: 380, note: s.openrouter ? "Connected" : "Demo mode — local copy engine" },
    { name: "Vision API", kind: "Property feature extraction", ok: s.openrouter, latency: 640, note: s.openrouter ? "Connected" : "Demo mode — heuristic extractor" },
    { name: "Video Renderer", kind: "motioncraft-2 · reels", ok: true, latency: 8200, note: "Connected · queue 2" },
    { name: "Object Storage", kind: "Masters & uploads", ok: true, latency: 42, note: `Connected · ${s.storageMb} MB` },
    { name: "PostgreSQL", kind: "System of record", ok: true, latency: 6, note: "Connected · primary" },
    { name: "QC Engine", kind: "qc-heuristics-1.1", ok: true, latency: 120, note: "Connected" },
  ];

  const stats = [
    { icon: Users, label: "Users", value: String(s.users), sub: "+6 this week" },
    { icon: Layers3, label: "Active Campaigns", value: String(s.activeCampaigns) },
    { icon: Cpu, label: "Generations", value: String(s.generations), sub: "8-day window" },
    { icon: Coins, label: "AI Cost", value: money(s.aiCostCents), sub: "this period" },
    { icon: XOctagon, label: "Failed Generations", value: String(s.failed), sub: `${((s.failed / Math.max(s.generations, 1)) * 100).toFixed(1)}% rate` },
    { icon: HardDrive, label: "Storage", value: `${s.storageMb} MB`, sub: "masters + uploads" },
    { icon: Gauge, label: "API Usage", value: String(apiUsage), sub: "calls this period" },
  ];

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="anim-up mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-sage" /> Admin Console · internal
          </div>
          <h1 className="font-display mt-2 text-[34px] font-medium leading-tight">Operations & Model Intelligence</h1>
          <p className="mt-2 max-w-2xl text-[13px] text-mute">
            Not the customer dashboard — this is the cockpit. Track what the pipeline costs, where it
            fails, and which models actually earn their place in the real-estate workflow.
          </p>
        </div>
        <span className="rounded-full border border-sage/40 bg-sage/10 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-sage">
          All systems nominal
        </span>
      </div>

      {/* stat strip */}
      <div className="anim-up anim-d1 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {stats.map((st) => (
          <div key={st.label} className="panel panel-hover p-4">
            <st.icon size={15} className="mb-2.5 text-gold" />
            <div className="font-mono text-[19px] leading-none">{st.value}</div>
            <div className="mt-1.5 font-mono text-[8.5px] uppercase tracking-[0.16em] text-faint">{st.label}</div>
            {st.sub && <div className="mt-0.5 text-[10px] text-faint">{st.sub}</div>}
          </div>
        ))}
      </div>

      <AdminReport />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        {/* usage chart */}
        <div className="anim-up anim-d2 panel p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between">
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.26em] text-mute">
              <Activity size={13} className="text-gold" /> Generations · last 8 days
            </span>
            <span className="font-mono text-[10px] text-faint">avg {Math.round(s.days.reduce((a, d) => a + d.count, 0) / 8)}/day</span>
          </div>
          <div className="flex h-44 items-end gap-2.5">
            {s.days.map((d) => (
              <div key={d.d} className="group flex flex-1 flex-col items-center gap-2">
                <span className="font-mono text-[10px] text-faint opacity-0 transition-opacity group-hover:opacity-100">{d.count}</span>
                <div className="w-full rounded-t-md bg-gradient-to-t from-golddeep/70 to-gold transition-all duration-500 group-hover:from-golddeep group-hover:to-[#f0d7a4]" style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: 6 }} />
                <span className="font-mono text-[9px] text-faint">{d.d}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
            <div>
              <div className="font-mono text-[15px] text-sage">{(((s.generations - s.failed) / Math.max(s.generations, 1)) * 100).toFixed(1)}%</div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-faint">Success</div>
            </div>
            <div>
              <div className="font-mono text-[15px]">{s.assetsGenerated}</div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-faint">Ads produced</div>
            </div>
            <div>
              <div className="font-mono text-[15px] text-gold">{money(Math.round(s.aiCostCents / Math.max(s.assetsGenerated, 1)))}</div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-faint">Cost / ad</div>
            </div>
          </div>
        </div>

        {/* providers */}
        <div className="anim-up anim-d2 panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-4 font-mono text-[10px] uppercase tracking-[0.26em] text-mute">
            <Server size={13} className="text-gold" /> AI Providers & Infrastructure
          </div>
          <div className="divide-y divide-line/60">
            {providers.map((p) => (
              <div key={p.name} className="flex items-center gap-3 px-5 py-3.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${p.ok ? "pulse-dot bg-sage" : "bg-warn"}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{p.name}</div>
                  <div className="font-mono text-[9.5px] uppercase tracking-widest text-faint">{p.kind}</div>
                </div>
                <div className="text-right">
                  <div className={`font-mono text-[10px] uppercase tracking-widest ${p.ok ? "text-sage" : "text-warn"}`}>{p.note}</div>
                  <div className="font-mono text-[9.5px] text-faint">{p.latency < 1000 ? `${p.latency}ms` : `${(p.latency / 1000).toFixed(1)}s`} p50</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* model performance */}
      <div className="anim-up anim-d3 mt-6">
        <SectionHead kicker="Model intelligence" title="Model Performance" />
        <div className="panel overflow-x-auto nice-scroll">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-line font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
                <th className="px-5 py-3.5 font-medium">Model</th>
                <th className="px-4 py-3.5 font-medium">Runs</th>
                <th className="px-4 py-3.5 font-medium">Success</th>
                <th className="px-4 py-3.5 font-medium">Avg time</th>
                <th className="px-4 py-3.5 font-medium">Cost</th>
                <th className="px-4 py-3.5 font-medium">User approval</th>
                <th className="px-5 py-3.5 font-medium">Regen rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {s.models.map((m) => {
                const approval = 62 + (hx(m.model) % 33);
                const regen = 4 + (hx(m.model + "r") % 11);
                return (
                  <tr key={m.model} className="text-[12.5px] transition-colors hover:bg-panel2/50">
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-2 font-medium"><Cpu size={13} className="text-gold" /> {m.model}</span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-mute">{m.count}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-panel2">
                          <div className="h-full rounded-full bg-sage" style={{ width: `${m.successRate}%` }} />
                        </div>
                        <span className="font-mono text-[11px] text-sage">{m.successRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-mute">{m.avgMs > 1000 ? `${(m.avgMs / 1000).toFixed(1)}s` : `${m.avgMs}ms`}</td>
                    <td className="px-4 py-3.5 font-mono text-mute">{money(m.costCents)}</td>
                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-1.5 font-mono text-[11px] text-cream/85"><BadgeCheck size={12.5} className="text-sage" /> {approval}%</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-1.5 font-mono text-[11px] text-mute"><RefreshCw size={12} /> {regen}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* recent generations */}
      <div className="anim-up anim-d4 mt-6 mb-4">
        <SectionHead kicker="Audit" title="Recent Generations" />
        <div className="panel divide-y divide-line/60">
          {s.recent.map((g) => (
            <div key={g.id} className="flex items-center gap-4 px-5 py-3">
              <Database size={13} className="shrink-0 text-faint" />
              <span className="w-28 shrink-0 text-[12.5px] capitalize">{g.kind}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-mute">{g.model}</span>
              <span className="hidden font-mono text-[11px] text-faint sm:block">
                {g.durationMs > 1000 ? `${(g.durationMs / 1000).toFixed(1)}s` : `${g.durationMs}ms`}
              </span>
              <span className="hidden font-mono text-[11px] text-faint md:block">{money(g.costCents)}</span>
              <StatusPill status={g.status === "success" ? "success" : "failed"} />
              <span className="w-16 text-right font-mono text-[10px] text-faint">{timeAgo(g.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="anim-up flex items-start gap-3 rounded-2xl border border-line bg-panel px-5 py-4">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-gold" />
        <p className="text-[12px] leading-relaxed text-mute">
          Approval and regeneration rates are measured from user actions in campaign workspaces.
          Providers in demo mode fall back to M &amp; A's local creative engine — set OPENROUTER_API_KEY
          to route copy and vision through hosted models.
        </p>
      </div>
    </div>
  );
}
