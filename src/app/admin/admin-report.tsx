"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import { money } from "@/lib/utils";

type ReportRecord = {
  id: string;
  createdAt: string;
  type: string;
  status: string;
  name: string;
  property: string;
  metric: string;
  details: string;
};

type ReportTotals = {
  records: number;
  generations: number;
  failures: number;
  costCents: number;
  approvedAssets: number;
};

const today = () => new Date().toISOString().slice(0, 10);

function filterQuery(range: string, type: string, status: string, search: string) {
  const params = new URLSearchParams({ type, status });
  const end = new Date();
  if (range !== "all") {
    const days = Number(range);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    params.set("from", start.toISOString().slice(0, 10));
    params.set("to", today());
  }
  if (search.trim()) params.set("q", search.trim());
  return params.toString();
}

export function AdminReport() {
  const [range, setRange] = useState("30");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [records, setRecords] = useState<ReportRecord[]>([]);
  const [totals, setTotals] = useState<ReportTotals>({ records: 0, generations: 0, failures: 0, costCents: 0, approvedAssets: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const query = filterQuery(range, type, status, deferredSearch);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/admin/report?${query}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { records?: ReportRecord[]; totals?: ReportTotals; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Could not load report.");
        setRecords(data.records ?? []);
        setTotals(data.totals ?? { records: 0, generations: 0, failures: 0, costCents: 0, approvedAssets: 0 });
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name !== "AbortError") setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query]);

  return (
    <section className="anim-up mt-7" aria-labelledby="admin-report-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-gold">Data & exports</div>
          <h2 id="admin-report-title" className="font-display mt-1 text-[23px] font-medium">Operations report</h2>
        </div>
        <a href={`/api/admin/report?${query}&format=csv`} className="btn-gold inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[12px] font-semibold">
          <Download size={14} /> Download filtered CSV
        </a>
      </div>

      <div className="panel p-4 md:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.6fr]">
          <label className="label">
            Date range
            <select value={range} onChange={(event) => setRange(event.target.value)} className="input mt-1.5 w-full">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </label>
          <label className="label">
            Record type
            <select value={type} onChange={(event) => setType(event.target.value)} className="input mt-1.5 w-full">
              <option value="all">All records</option>
              <option value="generation">Generation logs</option>
              <option value="campaign">Campaigns</option>
              <option value="asset">Creative assets</option>
              <option value="property">Properties</option>
            </select>
          </label>
          <label className="label">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="input mt-1.5 w-full">
              <option value="all">All statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="archived">Archived</option>
              <option value="approved">Approved</option>
              <option value="review">In review</option>
              <option value="analyzed">Analyzed</option>
            </select>
          </label>
          <label className="label">
            Search
            <span className="input mt-1.5 flex w-full items-center gap-2">
              <Search size={14} className="shrink-0 text-faint" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Name, model, property…" />
            </span>
          </label>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 border-y border-line py-3 sm:grid-cols-5">
          <ReportMetric label="Filtered records" value={String(totals.records)} />
          <ReportMetric label="Generation runs" value={String(totals.generations)} />
          <ReportMetric label="Failures" value={String(totals.failures)} />
          <ReportMetric label="AI cost" value={money(totals.costCents)} />
          <ReportMetric label="Approved assets" value={String(totals.approvedAssets)} />
        </div>

        <div className="mt-3 overflow-x-auto nice-scroll">
          <table className="w-full min-w-[850px] text-left">
            <thead>
              <tr className="border-b border-line font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
                <th className="py-2.5 pr-3 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Type / status</th>
                <th className="px-3 py-2.5 font-medium">Record</th>
                <th className="px-3 py-2.5 font-medium">Property</th>
                <th className="px-3 py-2.5 font-medium">Insight</th>
                <th className="py-2.5 pl-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {records.map((record) => (
                <tr key={`${record.type}-${record.id}`} className="text-[11px] hover:bg-panel2/50">
                  <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-faint">{new Date(record.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2.5">
                    <div className="capitalize">{record.type}</div>
                    <div className="mt-0.5 font-mono text-[9px] uppercase text-faint">{record.status}</div>
                  </td>
                  <td className="max-w-[190px] truncate px-3 py-2.5 font-medium" title={record.name}>{record.name}</td>
                  <td className="max-w-[150px] truncate px-3 py-2.5 text-mute" title={record.property}>{record.property || "—"}</td>
                  <td className="max-w-[210px] truncate px-3 py-2.5 font-mono text-mute" title={record.metric}>{record.metric}</td>
                  <td className="max-w-[280px] truncate py-2.5 pl-3 text-faint" title={record.details}>{record.details}</td>
                </tr>
              ))}
              {!loading && records.length === 0 && !error && (
                <tr><td colSpan={6} className="py-8 text-center text-[12px] text-faint">No records match these filters.</td></tr>
              )}
            </tbody>
          </table>
          {loading && <p className="py-4 text-center text-[11px] text-faint">Updating report…</p>}
          {error && <p role="alert" className="py-4 text-center text-[11px] text-rust">{error}</p>}
        </div>
      </div>
    </section>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-1">
      <div className="font-mono text-[15px]">{value}</div>
      <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-faint">{label}</div>
    </div>
  );
}