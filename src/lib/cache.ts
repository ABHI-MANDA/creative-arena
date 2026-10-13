/**
 * Application-level in-memory cache, LRU eviction, and request deduplication.
 * Eliminates redundant database roundtrips and network egress to Neon.
 */

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
  lastAccessed: number;
  tag?: string;
};

const MAX_CACHE_ENTRIES = 400;

const globalForCache = globalThis as typeof globalThis & {
  __arenaCacheStore?: Map<string, CacheEntry<unknown>>;
  __arenaInFlightRequests?: Map<string, Promise<unknown>>;
  __arenaCacheMetrics?: { hits: number; misses: number; invalidations: number; evictions: number };
};

const cacheStore = globalForCache.__arenaCacheStore ?? new Map<string, CacheEntry<unknown>>();
globalForCache.__arenaCacheStore = cacheStore;

const inFlightRequests = globalForCache.__arenaInFlightRequests ?? new Map<string, Promise<unknown>>();
globalForCache.__arenaInFlightRequests = inFlightRequests;

export const cacheMetrics = globalForCache.__arenaCacheMetrics ?? {
  hits: 0,
  misses: 0,
  invalidations: 0,
  evictions: 0,
};
globalForCache.__arenaCacheMetrics = cacheMetrics;

/**
 * Prunes expired entries and enforces max capacity via LRU to prevent memory bloat.
 */
function pruneCacheIfNeeded(): void {
  const now = Date.now();

  // 1. Sweep expired entries
  for (const [key, entry] of cacheStore.entries()) {
    if (entry.expiresAt <= now) {
      cacheStore.delete(key);
    }
  }

  // 2. If still over capacity, evict least recently accessed entries
  while (cacheStore.size >= MAX_CACHE_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of cacheStore.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cacheStore.delete(oldestKey);
      cacheMetrics.evictions++;
    } else {
      break;
    }
  }
}

/**
 * Retrieves data from memory cache or runs the fetcher, deduplicating concurrent calls.
 * @param key Unique cache key
 * @param ttlSeconds Time-to-live in seconds
 * @param fetcher Async function that queries database or executes computation
 * @param tag Optional tag grouping for bulk invalidation (e.g. "properties", "campaigns")
 */
export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
  tag?: string
): Promise<T> {
  const now = Date.now();
  const cached = cacheStore.get(key);

  if (cached && cached.expiresAt > now) {
    cached.lastAccessed = now;
    cacheMetrics.hits++;
    return cached.data as T;
  }

  // Deduplicate simultaneous requests for the same key
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key) as Promise<T>;
  }

  cacheMetrics.misses++;
  const fetchPromise = (async () => {
    try {
      const data = await fetcher();
      if (ttlSeconds > 0) {
        pruneCacheIfNeeded();
        cacheStore.set(key, {
          data,
          expiresAt: Date.now() + ttlSeconds * 1000,
          lastAccessed: Date.now(),
          tag,
        });
      }
      return data;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, fetchPromise);
  return fetchPromise;
}

/**
 * Invalidates cache by tag or key prefix upon mutations.
 */
export function invalidateCache(tagOrPrefix: string): void {
  cacheMetrics.invalidations++;
  for (const [key, entry] of cacheStore.entries()) {
    if (entry.tag === tagOrPrefix || key.startsWith(tagOrPrefix)) {
      cacheStore.delete(key);
    }
  }
}

/**
 * Clears entire cache.
 */
export function clearAllCache(): void {
  cacheStore.clear();
}

/**
 * Returns current memory & hit/miss telemetry for administrative monitoring.
 */
export function getCacheMemoryStats() {
  return {
    entries: cacheStore.size,
    maxEntries: MAX_CACHE_ENTRIES,
    inFlight: inFlightRequests.size,
    ...cacheMetrics,
  };
}
