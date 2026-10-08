/**
 * Application-level in-memory cache and request deduplication.
 * Eliminates redundant database roundtrips and network egress to Neon.
 */

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
  tag?: string;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export const cacheMetrics = {
  hits: 0,
  misses: 0,
  invalidations: 0,
};

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
        cacheStore.set(key, {
          data,
          expiresAt: Date.now() + ttlSeconds * 1000,
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

