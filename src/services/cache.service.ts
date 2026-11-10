/**
 * Generic Redis cache-aside helper and non-blocking cache invalidation service.
 *
 * Invalidation strategies:
 * 1. **Exact-key invalidation (`invalidateKeys`)**:
 *    Use when the exact cache key(s) affected by a mutation are known
 *    (e.g., `artist:profile:123`). Lowest overhead (single `DEL` call).
 * 2. **Single-namespace invalidation (`invalidateNamespace`)**:
 *    Use when a mutation invalidates all cached queries under one domain
 *    namespace (e.g., `invalidateNamespace('marketplace')`). Uses cursor-based
 *    `SCAN` with `<namespace>:*` and batched `DEL`.
 * 3. **Cross-namespace pattern invalidation (`invalidatePattern`)**:
 *    Use when an entity is cached under multiple namespaces (e.g., an artwork
 *    appearing in `marketplace`, `search`, and `artist` caches) and a targeted
 *    pattern should be evicted across all or selected namespaces without
 *    flushing unrelated keys. Uses cursor-based `SCAN` (never blocking `KEYS`).
 *
 * All operations degrade gracefully to a no-op / direct `fetcher` call when
 * Redis isn't configured.
 */

export interface CacheMetrics {
  hits: number;
  misses: number;
}

/**
 * Minimal Redis client contract required by `cache.service`.
 * Compatible with `ioredis` instances and in-memory test mocks.
 */
export interface CacheRedisClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    expiryMode?: 'EX',
    ttlSeconds?: number,
  ): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  scan(
    cursor: string,
    matchOption: 'MATCH',
    pattern: string,
    countOption: 'COUNT',
    count: number,
  ): Promise<[string, string[]]>;
}

/**
 * How many keys `SCAN`-based invalidation buffers per `DEL` batch.
 * Keeps memory bounded on large keyspaces while minimizing round-trips.
 */
export const INVALIDATE_BATCH_SIZE = 500;

/** `SCAN` cursor used to start and detect completion of an iteration. */
export const SCAN_CURSOR_START = '0';

const metrics = new Map<string, CacheMetrics>();

let activeRedisClient: CacheRedisClient | undefined;

/**
 * Registers or clears the Redis client used by cache operations.
 */
export function setCacheRedisClient(
  client: CacheRedisClient | undefined,
): void {
  activeRedisClient = client;
}

/**
 * Returns the currently configured Redis client, if any.
 */
export function tryGetCacheRedisClient(): CacheRedisClient | undefined {
  return activeRedisClient;
}

function metricsFor(namespace: string): CacheMetrics {
  let entry = metrics.get(namespace);
  if (entry === undefined) {
    entry = { hits: 0, misses: 0 };
    metrics.set(namespace, entry);
  }
  return entry;
}

/**
 * Hit/miss counters recorded so far, per cache namespace.
 */
export function getCacheMetrics(): ReadonlyMap<string, Readonly<CacheMetrics>> {
  return metrics;
}

/**
 * Clears accumulated hit/miss metrics (useful in tests and metric resets).
 */
export function resetCacheMetrics(): void {
  metrics.clear();
}

/**
 * Logs current hit rates per namespace.
 */
export function logCacheMetrics(): void {
  for (const [namespace, { hits, misses }] of metrics) {
    const total = hits + misses;
    const hitRate = total === 0 ? 0 : Math.round((hits / total) * 100);
    console.log(
      `[cache] ${namespace}: ${hits} hits, ${misses} misses (${hitRate}% hit rate)`,
    );
  }
}

function namespaceOf(key: string): string {
  return key.split(':')[0] ?? key;
}

/**
 * Cache-aside read: serve `key` from Redis if present, otherwise call
 * `fetcher`, cache its result for `ttlSeconds`, and return it.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const redis = activeRedisClient;
  if (redis === undefined) {
    return fetcher();
  }

  const namespace = namespaceOf(key);
  const hit = await redis.get(key);
  if (hit !== null) {
    metricsFor(namespace).hits += 1;
    return JSON.parse(hit) as T;
  }

  metricsFor(namespace).misses += 1;
  const value = await fetcher();
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  return value;
}

/**
 * Deletes specific cache keys directly. No-op when Redis isn't configured
 * or when no keys are provided.
 */
export async function invalidateKeys(...keys: string[]): Promise<number> {
  const redis = activeRedisClient;
  const nonEmptyKeys = keys.filter((key) => key.trim().length > 0);
  if (redis === undefined || nonEmptyKeys.length === 0) {
    return 0;
  }
  return redis.del(...nonEmptyKeys);
}

/**
 * Scans Redis using non-blocking cursor-based `SCAN` for a single glob
 * `matchPattern` and deletes matched keys in batches of `INVALIDATE_BATCH_SIZE`.
 */
async function scanAndDeleteSinglePattern(
  redis: CacheRedisClient,
  matchPattern: string,
  seenKeys?: Set<string>,
): Promise<number> {
  let cursor = SCAN_CURSOR_START;
  let batch: string[] = [];
  let deletedCount = 0;

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      matchPattern,
      'COUNT',
      INVALIDATE_BATCH_SIZE,
    );
    cursor = nextCursor;

    for (const key of keys) {
      if (seenKeys !== undefined) {
        if (seenKeys.has(key)) {
          continue;
        }
        seenKeys.add(key);
      }
      batch.push(key);

      if (batch.length >= INVALIDATE_BATCH_SIZE) {
        const toDelete = batch.splice(0, INVALIDATE_BATCH_SIZE);
        deletedCount += await redis.del(...toDelete);
      }
    }
  } while (cursor !== SCAN_CURSOR_START);

  if (batch.length > 0) {
    deletedCount += await redis.del(...batch);
    batch = [];
  }

  return deletedCount;
}

/**
 * Builds the list of Redis `SCAN` glob patterns for `invalidatePattern`.
 *
 * - When `namespaces` is provided and non-empty, scopes `pattern` to each
 *   unique namespace as `<namespace>:<subpattern>`.
 * - When `namespaces` is omitted or empty, matches across all namespaces:
 *   if `pattern` already starts with `*`, uses `[pattern]`; otherwise scans
 *   both `*:<pattern>` (cross-namespace) and `<pattern>` (direct match).
 */
export function buildScanPatterns(
  pattern: string,
  namespaces?: readonly string[],
): string[] {
  const trimmedPattern = pattern.trim();
  if (trimmedPattern.length === 0) {
    return [];
  }

  if (namespaces !== undefined && namespaces.length > 0) {
    const cleanPattern = trimmedPattern.replace(/^\*:?/, '');
    if (cleanPattern.length === 0) {
      return [];
    }

    const uniqueNamespaces = [
      ...new Set(
        namespaces
          .map((ns) => ns.trim().replace(/:+$/, ''))
          .filter((ns) => ns.length > 0),
      ),
    ];

    return uniqueNamespaces.map((ns) => {
      const withoutDuplicatePrefix = cleanPattern.startsWith(`${ns}:`)
        ? cleanPattern.slice(ns.length + 1)
        : cleanPattern;
      return `${ns}:${withoutDuplicatePrefix}`;
    });
  }

  if (trimmedPattern.startsWith('*')) {
    return [trimmedPattern];
  }

  return [`*:${trimmedPattern}`, trimmedPattern];
}

/**
 * Invalidates every cached key under `namespace` (keys formatted as
 * `<namespace>:*`) using non-blocking cursor-based `SCAN` and batched `DEL`.
 */
export async function invalidateNamespace(namespace: string): Promise<number> {
  const redis = activeRedisClient;
  const cleanNamespace = namespace.trim().replace(/:+$/, '');
  if (redis === undefined || cleanNamespace.length === 0) {
    return 0;
  }

  return scanAndDeleteSinglePattern(redis, `${cleanNamespace}:*`);
}

/**
 * Invalidates cached keys matching `pattern` across all namespaces (when
 * `namespaces` is omitted) or across the specified `namespaces` list, using
 * non-blocking `SCAN` iteration and batched `DEL` commands.
 *
 * Examples:
 * - `await invalidatePattern('artwork:42*')` -> invalidates `*:artwork:42*` across all namespaces
 * - `await invalidatePattern('*:user:99:*')` -> invalidates matching keys across all namespaces
 * - `await invalidatePattern('browse:*', ['marketplace', 'search'])` -> invalidates `marketplace:browse:*` and `search:browse:*`
 */
export async function invalidatePattern(
  pattern: string,
  namespaces?: readonly string[],
): Promise<number> {
  const redis = activeRedisClient;
  if (redis === undefined) {
    return 0;
  }

  const scanPatterns = buildScanPatterns(pattern, namespaces);
  if (scanPatterns.length === 0) {
    return 0;
  }

  const seenKeys = scanPatterns.length > 1 ? new Set<string>() : undefined;
  let totalDeleted = 0;

  for (const scanPattern of scanPatterns) {
    totalDeleted += await scanAndDeleteSinglePattern(
      redis,
      scanPattern,
      seenKeys,
    );
  }

  return totalDeleted;
}
