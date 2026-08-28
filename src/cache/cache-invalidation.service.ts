import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

/**
 * Cache invalidation strategy (#656).
 * - TTL-based expiry per key family
 * - Event-based invalidation via invalidate() / invalidatePattern()
 * - Cache warming via getOrSet()
 * - Cache metrics via getStats()
 */
@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  static readonly TTL = {
    artist: 300,
    service: 300,
    commission: 60,
    payment: 60,
    analytics: 600,
    userProfile: 120,
  } as const;

  private hits = 0;
  private misses = 0;

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  key(namespace: string, id: string, suffix?: string): string {
    return suffix ? `${namespace}:${id}:${suffix}` : `${namespace}:${id}`;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.cache.get<T>(key);
    if (value !== undefined && value !== null) {
      this.hits++;
    } else {
      this.misses++;
    }
    return value ?? undefined;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.cache.set(key, value, ttlSeconds * 1000);
  }

  async invalidate(key: string): Promise<void> {
    await this.cache.del(key);
    this.logger.debug(`Cache invalidated: ${key}`);
  }

  async invalidatePattern(namespace: string): Promise<void> {
    try {
      const store = (this.cache as any).store;
      if (typeof store?.keys === 'function') {
        const allKeys: string[] = await store.keys();
        const matching = allKeys.filter((k: string) => k.startsWith(`${namespace}:`));
        await Promise.all(matching.map((k: string) => this.cache.del(k)));
        this.logger.debug(`Cache invalidated ${matching.length} keys for namespace: ${namespace}`);
      }
    } catch {
      this.logger.warn(`Pattern invalidation not supported for namespace: ${namespace}`);
    }
  }

  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await fetcher();
    await this.set(key, value, ttlSeconds);
    this.logger.debug(`Cache warmed: ${key}`);
    return value;
  }

  getStats() {
    const total = this.hits + this.misses;
    return { hits: this.hits, misses: this.misses, hitRate: total ? (this.hits / total).toFixed(3) : '0.000' };
  }
}
