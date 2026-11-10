import {
  CacheRedisClient,
  INVALIDATE_BATCH_SIZE,
  buildScanPatterns,
  cached,
  getCacheMetrics,
  invalidateKeys,
  invalidateNamespace,
  invalidatePattern,
  resetCacheMetrics,
  setCacheRedisClient,
} from './cache.service';

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

class MockScanRedisClient implements CacheRedisClient {
  private readonly store = new Map<string, string>();
  private readonly slots: string[] = [];
  readonly scanCalls: Array<{
    cursor: string;
    pattern: string;
    count: number;
  }> = [];
  readonly delBatches: string[][] = [];
  private readonly pageSize: number;

  constructor(initialKeys: readonly string[] = [], pageSize = 2) {
    this.pageSize = pageSize;
    for (const key of initialKeys) {
      this.store.set(key, JSON.stringify({ key }));
      this.slots.push(key);
    }
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.store.get(key) ?? null);
  }

  set(key: string, value: string): Promise<string> {
    if (!this.store.has(key)) {
      this.slots.push(key);
    }
    this.store.set(key, value);
    return Promise.resolve('OK');
  }

  del(...keys: string[]): Promise<number> {
    this.delBatches.push(keys);
    let removed = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        removed += 1;
      }
    }
    return Promise.resolve(removed);
  }

  scan(
    cursor: string,
    _matchOption: 'MATCH',
    pattern: string,
    _countOption: 'COUNT',
    count: number,
  ): Promise<[string, string[]]> {
    this.scanCalls.push({ cursor, pattern, count });
    const regex = globToRegExp(pattern);
    const startIndex = Number(cursor);
    const slice = this.slots.slice(startIndex, startIndex + this.pageSize);
    const matched = slice.filter((k) => this.store.has(k) && regex.test(k));
    const nextIndex = startIndex + this.pageSize;
    const nextCursor =
      nextIndex >= this.slots.length ? '0' : String(nextIndex);
    return Promise.resolve([nextCursor, matched]);
  }

  remainingKeys(): string[] {
    return [...this.store.keys()].sort();
  }
}

describe('cache.service SCAN-based pattern invalidation', () => {
  beforeEach(() => {
    resetCacheMetrics();
    setCacheRedisClient(undefined);
  });

  afterEach(() => {
    setCacheRedisClient(undefined);
    resetCacheMetrics();
  });

  describe('buildScanPatterns', () => {
    it('builds cross-namespace glob patterns when namespaces are omitted', () => {
      expect(buildScanPatterns('artwork:42*')).toEqual([
        '*:artwork:42*',
        'artwork:42*',
      ]);
      expect(buildScanPatterns('*:artwork:42*')).toEqual(['*:artwork:42*']);
      expect(buildScanPatterns('   ')).toEqual([]);
    });

    it('builds scoped patterns per unique namespace when namespaces are provided', () => {
      expect(
        buildScanPatterns('artwork:42*', [
          'marketplace',
          'search',
          'marketplace',
        ]),
      ).toEqual(['marketplace:artwork:42*', 'search:artwork:42*']);

      expect(
        buildScanPatterns('*:user:7', ['artist:', 'notifications']),
      ).toEqual(['artist:user:7', 'notifications:user:7']);
    });
  });

  describe('invalidateNamespace', () => {
    it('iterates cursor pages via SCAN and deletes only keys in that namespace', async () => {
      const redis = new MockScanRedisClient(
        [
          'marketplace:featured',
          'marketplace:trending',
          'marketplace:browse:1',
          'search:artwork:1',
          'artist:profile:9',
        ],
        2, // force multi-step SCAN cursor pagination
      );
      setCacheRedisClient(redis);

      const deleted = await invalidateNamespace('marketplace');

      expect(deleted).toBe(3);
      expect(redis.scanCalls.length).toBeGreaterThan(1);
      expect(
        redis.scanCalls.every((c) => c.pattern === 'marketplace:*'),
      ).toBe(true);
      expect(redis.remainingKeys()).toEqual([
        'artist:profile:9',
        'search:artwork:1',
      ]);
    });

    it('batches DEL calls in chunks of INVALIDATE_BATCH_SIZE on large namespaces', async () => {
      const totalKeys = INVALIDATE_BATCH_SIZE * 2 + 120;
      const initialKeys = Array.from(
        { length: totalKeys },
        (_, idx) => `marketplace:item:${idx}`,
      );
      const redis = new MockScanRedisClient(initialKeys, 300);
      setCacheRedisClient(redis);

      const deleted = await invalidateNamespace('marketplace');

      expect(deleted).toBe(totalKeys);
      expect(redis.delBatches.map((b) => b.length)).toEqual([
        INVALIDATE_BATCH_SIZE,
        INVALIDATE_BATCH_SIZE,
        120,
      ]);
      expect(redis.remainingKeys()).toEqual([]);
    });
  });

  describe('invalidatePattern', () => {
    it('invalidates matching keys across all namespaces when namespaces are omitted', async () => {
      const redis = new MockScanRedisClient(
        [
          'marketplace:artwork:42',
          'marketplace:artwork:42:offers',
          'search:artwork:42:page:1',
          'artist:artwork:42',
          'marketplace:artwork:99',
          'search:artwork:99:page:1',
        ],
        2,
      );
      setCacheRedisClient(redis);

      const deleted = await invalidatePattern('artwork:42*');

      expect(deleted).toBe(4);
      expect(redis.remainingKeys()).toEqual([
        'marketplace:artwork:99',
        'search:artwork:99:page:1',
      ]);
    });

    it('invalidates matching keys only within specified namespaces', async () => {
      const redis = new MockScanRedisClient(
        [
          'marketplace:artwork:42',
          'search:artwork:42',
          'artist:artwork:42',
          'recommendations:artwork:42',
        ],
        2,
      );
      setCacheRedisClient(redis);

      const deleted = await invalidatePattern('artwork:42*', [
        'marketplace',
        'search',
      ]);

      expect(deleted).toBe(2);
      expect(redis.remainingKeys()).toEqual([
        'artist:artwork:42',
        'recommendations:artwork:42',
      ]);
    });

    it('supports wildcard-prefixed cross-namespace patterns in a single SCAN pass', async () => {
      const redis = new MockScanRedisClient(
        [
          'marketplace:user:abc:saves',
          'profile:user:abc:details',
          'profile:user:xyz:details',
        ],
        10,
      );
      setCacheRedisClient(redis);

      const deleted = await invalidatePattern('*:user:abc:*');

      expect(deleted).toBe(2);
      expect(redis.scanCalls).toHaveLength(1);
      expect(redis.remainingKeys()).toEqual(['profile:user:xyz:details']);
    });

    it('degrades gracefully when Redis is unconfigured or pattern is blank', async () => {
      await expect(invalidatePattern('artwork:42*')).resolves.toBe(0);
      await expect(invalidateNamespace('marketplace')).resolves.toBe(0);
      await expect(invalidateKeys('a', 'b')).resolves.toBe(0);

      const redis = new MockScanRedisClient(['marketplace:a']);
      setCacheRedisClient(redis);
      await expect(invalidatePattern('   ')).resolves.toBe(0);
      expect(redis.remainingKeys()).toEqual(['marketplace:a']);
    });
  });

  describe('cached & invalidateKeys', () => {
    it('records cache hits/misses and deletes exact keys via invalidateKeys', async () => {
      const redis = new MockScanRedisClient();
      setCacheRedisClient(redis);

      let fetchCalls = 0;
      const fetcher = () => {
        fetchCalls += 1;
        return Promise.resolve({ id: 'art-1', views: fetchCalls });
      };

      const first = await cached('marketplace:art-1', 60, fetcher);
      const second = await cached('marketplace:art-1', 60, fetcher);

      expect(first).toEqual({ id: 'art-1', views: 1 });
      expect(second).toEqual({ id: 'art-1', views: 1 });
      expect(fetchCalls).toBe(1);
      expect(getCacheMetrics().get('marketplace')).toEqual({
        hits: 1,
        misses: 1,
      });

      const deleted = await invalidateKeys('marketplace:art-1');
      expect(deleted).toBe(1);

      const third = await cached('marketplace:art-1', 60, fetcher);
      expect(third).toEqual({ id: 'art-1', views: 2 });
    });
  });
});
