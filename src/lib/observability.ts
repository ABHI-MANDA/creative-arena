/**
 * Lightweight in-memory observability for query duration, response sizes, and request counts.
 * Helps identify high-egress endpoints without external overhead or leaking secrets.
 */

import { cacheMetrics } from "./cache";

type MetricRecord = {
  endpoint: string;
  count: number;
  totalDurationMs: number;
  avgDurationMs: number;
  totalRows: number;
  estimatedBytes: number;
  lastExecuted: string;
};

const metricsStore = new Map<string, MetricRecord>();

export function recordDbMetric(
  endpoint: string,
  durationMs: number,
  rowsCount = 1,
  estimatedBytes = 0
) {
  const existing = metricsStore.get(endpoint) ?? {
    endpoint,
    count: 0,
    totalDurationMs: 0,
    avgDurationMs: 0,
    totalRows: 0,
    estimatedBytes: 0,
    lastExecuted: new Date().toISOString(),
  };

  existing.count++;
  existing.totalDurationMs += durationMs;
  existing.avgDurationMs = Math.round(existing.totalDurationMs / existing.count);
  existing.totalRows += rowsCount;
  existing.estimatedBytes += estimatedBytes;
  existing.lastExecuted = new Date().toISOString();

  metricsStore.set(endpoint, existing);
}

export function getTopEndpoints() {
  const all = Array.from(metricsStore.values());

  return {
    byRequestCount: [...all].sort((a, b) => b.count - a.count).slice(0, 10),
    byEstimatedEgress: [...all].sort((a, b) => b.estimatedBytes - a.estimatedBytes).slice(0, 10),
    byTotalDuration: [...all].sort((a, b) => b.totalDurationMs - a.totalDurationMs).slice(0, 10),
    cacheSummary: { ...cacheMetrics },
  };
}

