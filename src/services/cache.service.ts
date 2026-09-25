/**
 * Generic Redis cache-aside helper, shared by every read-heavy endpoint
 * that needs caching (artwork listings, category lists, trending,
 * recommended, artist profiles).
 *
 * Degrades to calling `fetcher` directly (no caching, no error) when Redis
 * isn't configured — the same fallback convention as the rest of this
 * codebase's optional-Redis features.
 */

import { tryGetRedisClient } from './redis.service';

export interface CacheMetrics {
  hits: number;
  misses: number;
}

const metrics = new Map<string, CacheMetrics>();

function metricsFor(namespace: string): CacheMetrics {
  let entry = metrics.get(namespace);
  if (entry === undefined) {
    entry = { hits: 0, misses: 0 };
    metrics.set(namespace, entry);
  }
  return entry;
}

/** Hit/miss counters recorded so far, per cache namespace. Read by a
 * metrics/health endpoint or logged periodically — see `logCacheMetrics`. */
export function getCacheMetrics(): ReadonlyMap<string, Readonly<CacheMetrics>> {
  return metrics;
}

/** Logs current hit rates per namespace (console — this codebase has no
 * dedicated structured logger). Call periodically (e.g. from a scheduled
 * job) or on demand; it's side-effect-free otherwise. */
export function logCacheMetrics(): void {
  for (const [namespace, { hits, misses }] of metrics) {
    const total = hits + misses;
    const hitRate = total === 0 ? 0 : Math.round((hits / total) * 100);
    // eslint-disable-next-line no-console
    console.log(`[cache] ${namespace}: ${hits} hits, ${misses} misses (${hitRate}% hit rate)`);
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
  const redis = tryGetRedisClient();
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
 * Invalidates every cached key under `namespace` (keys are always written
 * as `<namespace>:...`). Called after mutations that would otherwise leave
 * a cached read stale until its TTL expires — see `saves.service` and
 * `trending.service` for callers.
 *
 * Uses `KEYS` rather than `SCAN` for simplicity; fine at this data volume,
 * but a production deployment with a large keyspace should switch to a
 * cursor-based `SCAN` to avoid blocking Redis on a big namespace.
 */
export async function invalidateNamespace(namespace: string): Promise<void> {
  const redis = tryGetRedisClient();
  if (redis === undefined) {
    return;
  }
  const keys = await redis.keys(`${namespace}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
