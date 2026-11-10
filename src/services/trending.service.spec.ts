import {
  DEFAULT_DECAY_HALF_LIFE_MS,
  DEFAULT_MIN_SCORE_THRESHOLD,
  SIGNAL_WEIGHTS,
  TRENDING_KEY,
  TRENDING_LAST_SWEEP_KEY,
  TRENDING_UPDATED_AT_KEY,
  TrendingRedisClient,
  applyTrendingDecay,
  calculateDecayFactor,
  calculateDecayedScore,
  calculateTimeWeightedDelta,
  configureTrendingDecay,
  getTopTrendingArtworkIds,
  getTrendingDecayConfig,
  recordTrendingSignal,
  resetTrendingDecayConfig,
  setTrendingCacheInvalidator,
  setTrendingRedisClient,
} from './trending.service';

class InMemoryTrendingRedis implements TrendingRedisClient {
  private readonly sortedSets = new Map<string, Map<string, number>>();
  private readonly hashes = new Map<string, Map<string, string>>();
  private readonly kv = new Map<string, string>();

  private getSortedSet(key: string): Map<string, number> {
    let set = this.sortedSets.get(key);
    if (!set) {
      set = new Map<string, number>();
      this.sortedSets.set(key, set);
    }
    return set;
  }

  private getHash(key: string): Map<string, string> {
    let hash = this.hashes.get(key);
    if (!hash) {
      hash = new Map<string, string>();
      this.hashes.set(key, hash);
    }
    return hash;
  }

  zincrby(
    key: string,
    increment: number | string,
    member: string,
  ): Promise<string> {
    const set = this.getSortedSet(key);
    const current = set.get(member) ?? 0;
    const next = current + Number(increment);
    set.set(member, next);
    return Promise.resolve(String(next));
  }

  zadd(key: string, score: number | string, member: string): Promise<number> {
    const set = this.getSortedSet(key);
    const isNew = !set.has(member);
    set.set(member, Number(score));
    return Promise.resolve(isNew ? 1 : 0);
  }

  zscore(key: string, member: string): Promise<string | null> {
    const set = this.sortedSets.get(key);
    const val = set?.get(member);
    return Promise.resolve(val !== undefined ? String(val) : null);
  }

  zrem(key: string, ...members: string[]): Promise<number> {
    const set = this.sortedSets.get(key);
    if (!set) {
      return Promise.resolve(0);
    }
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) {
        removed += 1;
      }
    }
    return Promise.resolve(removed);
  }

  zrange(
    key: string,
    start: number,
    stop: number,
    withScores?: 'WITHSCORES',
  ): Promise<string[]> {
    const set = this.sortedSets.get(key);
    if (!set) {
      return Promise.resolve([]);
    }
    const sorted = [...set.entries()].sort((a, b) => a[1] - b[1]);
    const end = stop < 0 ? sorted.length + stop + 1 : stop + 1;
    const slice = sorted.slice(start, end);
    if (withScores === 'WITHSCORES') {
      const flat: string[] = [];
      for (const [member, score] of slice) {
        flat.push(member, String(score));
      }
      return Promise.resolve(flat);
    }
    return Promise.resolve(slice.map(([member]) => member));
  }

  zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    const set = this.sortedSets.get(key);
    if (!set) {
      return Promise.resolve([]);
    }
    const sorted = [...set.entries()].sort((a, b) => b[1] - a[1]);
    const end = stop < 0 ? sorted.length + stop + 1 : stop + 1;
    return Promise.resolve(
      sorted.slice(start, end).map(([member]) => member),
    );
  }

  hget(key: string, field: string): Promise<string | null> {
    const hash = this.hashes.get(key);
    return Promise.resolve(hash?.get(field) ?? null);
  }

  hset(key: string, field: string, value: string): Promise<number> {
    const hash = this.getHash(key);
    const isNew = !hash.has(field);
    hash.set(field, value);
    return Promise.resolve(isNew ? 1 : 0);
  }

  hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = this.hashes.get(key);
    if (!hash) {
      return Promise.resolve(0);
    }
    let deleted = 0;
    for (const field of fields) {
      if (hash.delete(field)) {
        deleted += 1;
      }
    }
    return Promise.resolve(deleted);
  }

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.kv.get(key) ?? null);
  }

  set(key: string, value: string): Promise<string> {
    this.kv.set(key, value);
    return Promise.resolve('OK');
  }

  scoreOf(member: string): number | undefined {
    return this.sortedSets.get(TRENDING_KEY)?.get(member);
  }
}

describe('trending.service time-decay', () => {
  let redis: InMemoryTrendingRedis;
  let invalidatedNamespaces: string[];

  beforeEach(() => {
    redis = new InMemoryTrendingRedis();
    invalidatedNamespaces = [];
    resetTrendingDecayConfig();
    setTrendingRedisClient(redis);
    setTrendingCacheInvalidator((ns) => {
      invalidatedNamespaces.push(ns);
      return Promise.resolve();
    });
  });

  afterEach(() => {
    setTrendingRedisClient(undefined);
    setTrendingCacheInvalidator(undefined);
    resetTrendingDecayConfig();
  });

  describe('decay math & configuration', () => {
    it('uses sensible default decay configuration', () => {
      const config = getTrendingDecayConfig();
      expect(config.halfLifeMs).toBe(DEFAULT_DECAY_HALF_LIFE_MS);
      expect(config.minScoreThreshold).toBe(DEFAULT_MIN_SCORE_THRESHOLD);
      expect(config.recomputeOnRead).toBe(false);
    });

    it('calculates exponential half-life decay factors accurately', () => {
      const halfLifeMs = 3_600_000; // 1 hour
      expect(calculateDecayFactor(0, halfLifeMs)).toBe(1);
      expect(calculateDecayFactor(-500, halfLifeMs)).toBe(1);
      expect(calculateDecayFactor(halfLifeMs, halfLifeMs)).toBeCloseTo(0.5, 6);
      expect(calculateDecayFactor(halfLifeMs * 2, halfLifeMs)).toBeCloseTo(
        0.25,
        6,
      );
      expect(calculateDecayFactor(halfLifeMs * 3, halfLifeMs)).toBeCloseTo(
        0.125,
        6,
      );
    });

    it('computes decayed scores and time-weighted signal deltas', () => {
      const halfLifeMs = 1_000;
      expect(calculateDecayedScore(10, 1_000, halfLifeMs)).toBeCloseTo(5, 6);
      expect(calculateDecayedScore(0, 1_000, halfLifeMs)).toBe(0);
      expect(calculateDecayedScore(-4, 1_000, halfLifeMs)).toBe(0);

      // Existing score 10 after 1 half-life decays to 5, plus save (3) => target 8 => delta -2
      const delta = calculateTimeWeightedDelta('save', 10, 1_000, halfLifeMs);
      expect(delta).toBeCloseTo(-2, 6);
    });

    it('rejects invalid halfLifeMs or minScoreThreshold values', () => {
      expect(() => calculateDecayFactor(100, 0)).toThrow(RangeError);
      expect(() => calculateDecayFactor(100, -10)).toThrow(RangeError);
      expect(() => configureTrendingDecay({ halfLifeMs: 0 })).toThrow(
        RangeError,
      );
      expect(() => configureTrendingDecay({ minScoreThreshold: -1 })).toThrow(
        RangeError,
      );
    });
  });

  describe('recordTrendingSignal with time-decay', () => {
    it('decays an existing artwork score before adding a new signal weight', async () => {
      const halfLifeMs = 60_000; // 1 minute
      configureTrendingDecay({ halfLifeMs });

      const t0 = 1_700_000_000_000;
      await recordTrendingSignal('art-1', 'purchase', { nowMs: t0 });
      expect(redis.scoreOf('art-1')).toBeCloseTo(SIGNAL_WEIGHTS.purchase, 6);

      // After 1 half-life, existing 5 decays to 2.5, plus view (1) = 3.5
      await recordTrendingSignal('art-1', 'view', {
        nowMs: t0 + halfLifeMs,
      });
      expect(redis.scoreOf('art-1')).toBeCloseTo(3.5, 6);
      expect(invalidatedNamespaces).toEqual(['marketplace', 'marketplace']);
    });

    it('ranks recent activity above older activity with higher initial score', async () => {
      const halfLifeMs = 3_600_000; // 1 hour
      configureTrendingDecay({ halfLifeMs });

      const t0 = 1_700_000_000_000;
      // Stale artwork had 2 purchases (score = 10) at t0
      await recordTrendingSignal('stale-art', 'purchase', { nowMs: t0 });
      await recordTrendingSignal('stale-art', 'purchase', { nowMs: t0 });
      expect(redis.scoreOf('stale-art')).toBeCloseTo(10, 6);

      // 3 hours later (3 half-lives), fresh artwork gets 1 save (score = 3)
      const t3Hours = t0 + 3 * halfLifeMs;
      await recordTrendingSignal('fresh-art', 'save', { nowMs: t3Hours });

      // Stale artwork receives a minor view at t3Hours OR decay is recomputed:
      // 10 * 2^(-3) = 1.25 < fresh-art's 3.0
      await applyTrendingDecay({ nowMs: t3Hours });

      expect(redis.scoreOf('stale-art')).toBeCloseTo(1.25, 6);
      expect(redis.scoreOf('fresh-art')).toBeCloseTo(3, 6);

      const topIds = await getTopTrendingArtworkIds(10);
      expect(topIds).toEqual(['fresh-art', 'stale-art']);
    });
  });

  describe('periodic and on-read decay recomputation', () => {
    it('recomputes all scores and prunes entries falling below minScoreThreshold', async () => {
      const halfLifeMs = 10_000;
      configureTrendingDecay({
        halfLifeMs,
        minScoreThreshold: 0.5,
      });

      const t0 = 1_000_000;
      await recordTrendingSignal('art-low', 'view', { nowMs: t0 }); // score = 1
      await recordTrendingSignal('art-high', 'purchase', { nowMs: t0 }); // score = 5

      // After 2 half-lives:
      // art-low = 1 * 0.25 = 0.25 (< 0.5 threshold -> pruned)
      // art-high = 5 * 0.25 = 1.25 (>= 0.5 threshold -> retained)
      const result = await applyTrendingDecay({
        nowMs: t0 + 2 * halfLifeMs,
      });

      expect(result).toEqual({
        processedCount: 2,
        updatedCount: 1,
        prunedCount: 1,
        halfLifeMs,
        timestampMs: t0 + 2 * halfLifeMs,
      });

      expect(redis.scoreOf('art-low')).toBeUndefined();
      expect(await redis.hget(TRENDING_UPDATED_AT_KEY, 'art-low')).toBeNull();
      expect(redis.scoreOf('art-high')).toBeCloseTo(1.25, 6);
      expect(await redis.get(TRENDING_LAST_SWEEP_KEY)).toBe(
        String(t0 + 2 * halfLifeMs),
      );
    });

    it('supports on-read decay recomputation via options or config', async () => {
      const halfLifeMs = 1_000;
      configureTrendingDecay({ halfLifeMs, recomputeOnRead: true });

      const t0 = 50_000;
      await recordTrendingSignal('art-old', 'purchase', { nowMs: t0 }); // 5
      await recordTrendingSignal('art-new', 'save', {
        nowMs: t0 + 2 * halfLifeMs,
      }); // 3 at t0 + 2000

      // Reading at t0 + 2000 triggers recomputeOnRead, decaying art-old from 5 -> 1.25
      const top = await getTopTrendingArtworkIds(5, {
        nowMs: t0 + 2 * halfLifeMs,
      });
      expect(top).toEqual(['art-new', 'art-old']);
      expect(redis.scoreOf('art-old')).toBeCloseTo(1.25, 6);
    });

    it('degrades gracefully when Redis is unconfigured or limit is non-positive', async () => {
      setTrendingRedisClient(undefined);

      await expect(
        recordTrendingSignal('art-1', 'view'),
      ).resolves.toBeUndefined();
      await expect(getTopTrendingArtworkIds(10)).resolves.toEqual([]);
      await expect(applyTrendingDecay({ nowMs: 12345 })).resolves.toEqual({
        processedCount: 0,
        updatedCount: 0,
        prunedCount: 0,
        halfLifeMs: DEFAULT_DECAY_HALF_LIFE_MS,
        timestampMs: 12345,
      });

      setTrendingRedisClient(redis);
      await expect(getTopTrendingArtworkIds(0)).resolves.toEqual([]);
      await expect(getTopTrendingArtworkIds(-5)).resolves.toEqual([]);
    });
  });
});
