const DEFAULT_FRESHNESS_MS = 30_000;
const MAX_ENTRIES = 32;

type CacheEntry<T = unknown> = {
  data?: T;
  error?: unknown;
  promise?: Promise<T>;
  updatedAt: number;
  lastUsedAt: number;
  tags: Set<string>;
};

const cache = new Map<string, CacheEntry>();

export type ResourceCacheOptions = {
  freshForMs?: number;
  force?: boolean;
  tags?: readonly string[];
};

export function readResourceCache<T>(
  key: string,
  freshForMs = DEFAULT_FRESHNESS_MS,
): { data?: T; error?: unknown; fresh: boolean } {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return { fresh: false };
  entry.lastUsedAt = Date.now();
  return {
    data: entry.data,
    error: entry.error,
    fresh: Date.now() - entry.updatedAt <= freshForMs,
  };
}

export function loadResourceCache<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
  {
    freshForMs = DEFAULT_FRESHNESS_MS,
    force = false,
    tags = [],
  }: ResourceCacheOptions = {},
): Promise<T> {
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (!force && existing?.data !== undefined && isFresh(existing, freshForMs)) {
    existing.lastUsedAt = Date.now();
    return Promise.resolve(existing.data);
  }
  if (!force && existing?.error && isFresh(existing, freshForMs)) {
    return Promise.reject(existing.error);
  }
  if (!force && existing?.promise) return existing.promise;

  const controller = new AbortController();
  const entry: CacheEntry<T> = existing ?? {
    updatedAt: 0,
    lastUsedAt: Date.now(),
    tags: new Set(),
  };
  tags.forEach((tag) => entry.tags.add(tag));
  entry.lastUsedAt = Date.now();
  entry.error = undefined;

  const promise = Promise.resolve()
    .then(() => loader(controller.signal))
    .then(
      (data) => {
        entry.data = data;
        entry.error = undefined;
        entry.updatedAt = Date.now();
        entry.lastUsedAt = Date.now();
        entry.promise = undefined;
        cache.set(key, entry);
        evictLeastRecentlyUsed();
        return data;
      },
      (error: unknown) => {
        entry.error = error;
        entry.updatedAt = Date.now();
        entry.lastUsedAt = Date.now();
        entry.promise = undefined;
        cache.set(key, entry);
        evictLeastRecentlyUsed();
        throw error;
      },
    );
  entry.promise = promise;
  cache.set(key, entry);
  return promise;
}

export function prefetchResource<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
  options?: Omit<ResourceCacheOptions, "force">,
) {
  return loadResourceCache(key, loader, options);
}

export function writeResourceCache<T>(
  key: string,
  data: T,
  tags: readonly string[] = [],
) {
  cache.set(key, {
    data,
    updatedAt: Date.now(),
    lastUsedAt: Date.now(),
    tags: new Set(tags),
  });
  evictLeastRecentlyUsed();
}

export function invalidateResourceTags(...tags: string[]) {
  const targets = new Set(tags);
  for (const [key, entry] of cache) {
    if ([...entry.tags].some((tag) => targets.has(tag))) cache.delete(key);
  }
}

export function clearResourceCache() {
  cache.clear();
}

function isFresh(entry: CacheEntry, freshForMs: number) {
  return Date.now() - entry.updatedAt <= freshForMs;
}

function evictLeastRecentlyUsed() {
  if (cache.size <= MAX_ENTRIES) return;
  const candidates = [...cache.entries()]
    .filter(([, entry]) => !entry.promise)
    .sort(([, left], [, right]) => left.lastUsedAt - right.lastUsedAt);
  while (cache.size > MAX_ENTRIES && candidates.length) {
    cache.delete(candidates.shift()![0]);
  }
}
