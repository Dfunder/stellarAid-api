/**
 * Trending-artwork scoring with configurable exponential half-life time-decay.
 *
 * A Redis sorted set (`trending:artworks`) accumulates a weighted score per
 * artwork (`view`: 1, `save`: 3, `purchase`: 5) while a companion hash
 * (`trending:artworks:updated_at`) tracks the last-updated timestamp (ms)
 * for each member.
 *
 * Time-decay operates in two complementary ways:
 * 1. **Weighted time-factor scoring on write (`recordTrendingSignal`)**:
 *    When a new signal arrives for an artwork, its existing score is first
 *    decayed exponentially according to the elapsed time since its previous
 *    update (`score * 2^(-elapsedMs / halfLifeMs)`) before adding the new
 *    signal weight via `ZINCRBY`.
 * 2. **Periodic or on-read score recomputation (`applyTrendingDecay`)**:
 *    Sweeps the sorted set to decay stale items that have not received recent
 *    signals, pruning entries whose decayed score drops below
 *    `minScoreThreshold` so stale artworks naturally fall out of trending.
 *
 * Degrades gracefully to a no-op / empty result when Redis isn't configured.
 */

export const TRENDING_KEY = 'trending:artworks';
export const TRENDING_UPDATED_AT_KEY = 'trending:artworks:updated_at';
export const TRENDING_LAST_SWEEP_KEY = 'trending:artworks:last_sweep_ms';

/** Default half-life: 24 hours in milliseconds. */
export const DEFAULT_DECAY_HALF_LIFE_MS = 24 * 60 * 60 * 1000;

/** Default minimum score threshold below which decayed entries are pruned. */
export const DEFAULT_MIN_SCORE_THRESHOLD = 0.01;

export type TrendingSignal = 'view' | 'save' | 'purchase';

export const SIGNAL_WEIGHTS: Readonly<Record<TrendingSignal, number>> = {
  view: 1,
  save: 3,
  purchase: 5,
};

export interface TrendingDecayConfig {
  /** Exponential half-life in milliseconds (must be > 0). */
  readonly halfLifeMs: number;
  /** Minimum score threshold; items decaying below this are pruned on sweep. */
  readonly minScoreThreshold: number;
  /** Whether `getTopTrendingArtworkIds` should automatically recompute decay before reading. */
  readonly recomputeOnRead: boolean;
}

export interface RecordTrendingSignalOptions {
  /** Override current timestamp (ms since epoch) for deterministic testing. */
  readonly nowMs?: number;
  /** Override configured half-life (ms) for this signal update. */
  readonly halfLifeMs?: number;
}

export interface ApplyTrendingDecayOptions {
  /** Override current timestamp (ms since epoch). */
  readonly nowMs?: number;
  /** Override configured half-life (ms). */
  readonly halfLifeMs?: number;
  /** Override minimum score threshold for pruning stale entries. */
  readonly minScoreThreshold?: number;
}

export interface GetTrendingOptions {
  /** When true, runs `applyTrendingDecay` prior to reading top entries. */
  readonly recomputeDecay?: boolean;
  /** Current timestamp (ms) forwarded when `recomputeDecay` is enabled. */
  readonly nowMs?: number;
  /** Half-life (ms) forwarded when `recomputeDecay` is enabled. */
  readonly halfLifeMs?: number;
}

export interface DecayRecomputationResult {
  readonly processedCount: number;
  readonly updatedCount: number;
  readonly prunedCount: number;
  readonly halfLifeMs: number;
  readonly timestampMs: number;
}

/**
 * Minimal Redis client contract required by the trending service.
 * Compatible with `ioredis` instances as well as in-memory test doubles.
 */
export interface TrendingRedisClient {
  zincrby(
    key: string,
    increment: number | string,
    member: string,
  ): Promise<string | number>;
  zrevrange(key: string, start: number, stop: number): Promise<string[]>;
  zscore?(key: string, member: string): Promise<string | null>;
  zrange?(
    key: string,
    start: number,
    stop: number,
    withScores?: 'WITHSCORES',
  ): Promise<string[]>;
  zadd?(
    key: string,
    score: number | string,
    member: string,
  ): Promise<string | number>;
  zrem?(key: string, ...members: string[]): Promise<number>;
  hget?(key: string, field: string): Promise<string | null>;
  hset?(key: string, field: string, value: string): Promise<number>;
  hdel?(key: string, ...fields: string[]): Promise<number>;
  get?(key: string): Promise<string | null>;
  set?(key: string, value: string): Promise<unknown>;
}

export type CacheNamespaceInvalidator = (namespace: string) => Promise<void>;

let activeRedisClient: TrendingRedisClient | undefined;
let activeCacheInvalidator: CacheNamespaceInvalidator | undefined;

function parsePositiveNumberEnv(
  raw: string | undefined,
  fallback: number,
): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildDefaultConfig(): TrendingDecayConfig {
  return {
    halfLifeMs: parsePositiveNumberEnv(
      process.env.TRENDING_DECAY_HALF_LIFE_MS,
      DEFAULT_DECAY_HALF_LIFE_MS,
    ),
    minScoreThreshold: parsePositiveNumberEnv(
      process.env.TRENDING_MIN_SCORE_THRESHOLD,
      DEFAULT_MIN_SCORE_THRESHOLD,
    ),
    recomputeOnRead: process.env.TRENDING_RECOMPUTE_ON_READ === 'true',
  };
}

let decayConfig: TrendingDecayConfig = buildDefaultConfig();

/**
 * Validates that a half-life value is a finite positive number.
 */
function assertValidHalfLife(halfLifeMs: number): void {
  if (!Number.isFinite(halfLifeMs) || halfLifeMs <= 0) {
    throw new RangeError(
      `halfLifeMs must be a positive finite number, received: ${String(halfLifeMs)}`,
    );
  }
}

/**
 * Validates that a minimum score threshold is a finite non-negative number.
 */
function assertValidMinScoreThreshold(minScoreThreshold: number): void {
  if (!Number.isFinite(minScoreThreshold) || minScoreThreshold < 0) {
    throw new RangeError(
      `minScoreThreshold must be a non-negative finite number, received: ${String(minScoreThreshold)}`,
    );
  }
}

/**
 * Updates the active trending time-decay configuration at runtime.
 */
export function configureTrendingDecay(
  partial: Partial<TrendingDecayConfig>,
): TrendingDecayConfig {
  const nextHalfLife = partial.halfLifeMs ?? decayConfig.halfLifeMs;
  const nextThreshold =
    partial.minScoreThreshold ?? decayConfig.minScoreThreshold;

  assertValidHalfLife(nextHalfLife);
  assertValidMinScoreThreshold(nextThreshold);

  decayConfig = {
    halfLifeMs: nextHalfLife,
    minScoreThreshold: nextThreshold,
    recomputeOnRead: partial.recomputeOnRead ?? decayConfig.recomputeOnRead,
  };
  return decayConfig;
}

/**
 * Resets the trending decay configuration back to environment/default values.
 */
export function resetTrendingDecayConfig(): TrendingDecayConfig {
  decayConfig = buildDefaultConfig();
  return decayConfig;
}

/**
 * Returns a snapshot of the current trending decay configuration.
 */
export function getTrendingDecayConfig(): Readonly<TrendingDecayConfig> {
  return { ...decayConfig };
}

/**
 * Registers or clears the Redis client used by trending operations.
 */
export function setTrendingRedisClient(
  client: TrendingRedisClient | undefined,
): void {
  activeRedisClient = client;
}

/**
 * Registers or clears the cache invalidation callback invoked after score updates.
 */
export function setTrendingCacheInvalidator(
  invalidator: CacheNamespaceInvalidator | undefined,
): void {
  activeCacheInvalidator = invalidator;
}

/**
 * Calculates the multiplicative exponential decay factor `2^(-elapsedMs / halfLifeMs)`.
 *
 * - Returns `1` when `elapsedMs <= 0`.
 * - Returns `0.5` when `elapsedMs === halfLifeMs`.
 * - Throws `RangeError` if `halfLifeMs <= 0` or is non-finite.
 */
export function calculateDecayFactor(
  elapsedMs: number,
  halfLifeMs: number = decayConfig.halfLifeMs,
): number {
  assertValidHalfLife(halfLifeMs);
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return 1;
  }
  return Math.pow(2, -elapsedMs / halfLifeMs);
}

/**
 * Computes the decayed value of `rawScore` after `elapsedMs` milliseconds.
 */
export function calculateDecayedScore(
  rawScore: number,
  elapsedMs: number,
  halfLifeMs: number = decayConfig.halfLifeMs,
): number {
  if (!Number.isFinite(rawScore) || rawScore <= 0) {
    return 0;
  }
  return rawScore * calculateDecayFactor(elapsedMs, halfLifeMs);
}

/**
 * Computes the net `ZINCRBY` delta needed to decay `existingScore` over
 * `elapsedMs` and add the new signal's weight.
 *
 * `newScore = existingScore * 2^(-elapsedMs / halfLifeMs) + weight`
 * `delta = newScore - existingScore`
 */
export function calculateTimeWeightedDelta(
  signal: TrendingSignal,
  existingScore: number,
  elapsedMs: number,
  halfLifeMs: number = decayConfig.halfLifeMs,
): number {
  const safeExisting =
    Number.isFinite(existingScore) && existingScore > 0 ? existingScore : 0;
  const decayedExisting = calculateDecayedScore(
    safeExisting,
    elapsedMs,
    halfLifeMs,
  );
  const weight = SIGNAL_WEIGHTS[signal];
  const targetScore = decayedExisting + weight;
  return targetScore - safeExisting;
}

/**
 * Records a weighted trending signal with exponential time-decay applied to any
 * prior accumulated score for `artworkId`, then invalidates the `marketplace`
 * cache namespace.
 */
export async function recordTrendingSignal(
  artworkId: string,
  signal: TrendingSignal,
  options?: RecordTrendingSignalOptions,
): Promise<void> {
  const redis = activeRedisClient;
  if (redis === undefined) {
    return;
  }

  const nowMs = options?.nowMs ?? Date.now();
  const halfLifeMs = options?.halfLifeMs ?? decayConfig.halfLifeMs;
  assertValidHalfLife(halfLifeMs);

  let delta = SIGNAL_WEIGHTS[signal];

  if (typeof redis.zscore === 'function' && typeof redis.hget === 'function') {
    const [rawScoreStr, lastUpdatedStr] = await Promise.all([
      redis.zscore(TRENDING_KEY, artworkId),
      redis.hget(TRENDING_UPDATED_AT_KEY, artworkId),
    ]);

    if (rawScoreStr !== null) {
      const existingScore = Number(rawScoreStr);
      const lastUpdatedMs =
        lastUpdatedStr !== null ? Number(lastUpdatedStr) : nowMs;
      const elapsedMs =
        Number.isFinite(lastUpdatedMs) && nowMs > lastUpdatedMs
          ? nowMs - lastUpdatedMs
          : 0;

      delta = calculateTimeWeightedDelta(
        signal,
        existingScore,
        elapsedMs,
        halfLifeMs,
      );
    }
  }

  await redis.zincrby(TRENDING_KEY, delta, artworkId);

  if (typeof redis.hset === 'function') {
    await redis.hset(TRENDING_UPDATED_AT_KEY, artworkId, String(nowMs));
  }

  if (activeCacheInvalidator !== undefined) {
    await activeCacheInvalidator('marketplace');
  }
}

/**
 * Parses `ZRANGE key 0 -1 WITHSCORES` flat array output `[member1, score1, ...]`
 * into `[member, numericScore]` tuples.
 */
function parseWithScores(
  flat: readonly string[],
): Array<readonly [string, number]> {
  const entries: Array<readonly [string, number]> = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const member = flat[i];
    const score = Number(flat[i + 1]);
    if (member !== undefined && Number.isFinite(score)) {
      entries.push([member, score]);
    }
  }
  return entries;
}

/**
 * Periodically (or on-read) recomputes all trending scores in Redis using
 * exponential half-life decay, pruning stale artworks whose score falls below
 * `minScoreThreshold`.
 */
export async function applyTrendingDecay(
  options?: ApplyTrendingDecayOptions,
): Promise<DecayRecomputationResult> {
  const nowMs = options?.nowMs ?? Date.now();
  const halfLifeMs = options?.halfLifeMs ?? decayConfig.halfLifeMs;
  const minScoreThreshold =
    options?.minScoreThreshold ?? decayConfig.minScoreThreshold;

  assertValidHalfLife(halfLifeMs);
  assertValidMinScoreThreshold(minScoreThreshold);

  const redis = activeRedisClient;
  if (redis === undefined || typeof redis.zrange !== 'function') {
    return {
      processedCount: 0,
      updatedCount: 0,
      prunedCount: 0,
      halfLifeMs,
      timestampMs: nowMs,
    };
  }

  const rawEntries = await redis.zrange(TRENDING_KEY, 0, -1, 'WITHSCORES');
  const entries = parseWithScores(rawEntries);

  if (entries.length === 0) {
    return {
      processedCount: 0,
      updatedCount: 0,
      prunedCount: 0,
      halfLifeMs,
      timestampMs: nowMs,
    };
  }

  const fallbackSweepStr =
    typeof redis.get === 'function'
      ? await redis.get(TRENDING_LAST_SWEEP_KEY)
      : null;
  const fallbackTimestampMs =
    fallbackSweepStr !== null && Number.isFinite(Number(fallbackSweepStr))
      ? Number(fallbackSweepStr)
      : nowMs;

  let updatedCount = 0;
  let prunedCount = 0;

  for (const [artworkId, currentScore] of entries) {
    const lastUpdatedStr =
      typeof redis.hget === 'function'
        ? await redis.hget(TRENDING_UPDATED_AT_KEY, artworkId)
        : null;
    const referenceMs =
      lastUpdatedStr !== null && Number.isFinite(Number(lastUpdatedStr))
        ? Number(lastUpdatedStr)
        : fallbackTimestampMs;

    const elapsedMs = Math.max(0, nowMs - referenceMs);
    const decayedScore = calculateDecayedScore(
      currentScore,
      elapsedMs,
      halfLifeMs,
    );

    if (decayedScore < minScoreThreshold) {
      if (typeof redis.zrem === 'function') {
        await redis.zrem(TRENDING_KEY, artworkId);
      }
      if (typeof redis.hdel === 'function') {
        await redis.hdel(TRENDING_UPDATED_AT_KEY, artworkId);
      }
      prunedCount += 1;
      continue;
    }

    if (elapsedMs > 0) {
      if (typeof redis.zadd === 'function') {
        await redis.zadd(TRENDING_KEY, decayedScore, artworkId);
      } else {
        await redis.zincrby(
          TRENDING_KEY,
          decayedScore - currentScore,
          artworkId,
        );
      }
      updatedCount += 1;
    }

    if (typeof redis.hset === 'function') {
      await redis.hset(TRENDING_UPDATED_AT_KEY, artworkId, String(nowMs));
    }
  }

  if (typeof redis.set === 'function') {
    await redis.set(TRENDING_LAST_SWEEP_KEY, String(nowMs));
  }

  if ((updatedCount > 0 || prunedCount > 0) && activeCacheInvalidator) {
    await activeCacheInvalidator('marketplace');
  }

  return {
    processedCount: entries.length,
    updatedCount,
    prunedCount,
    halfLifeMs,
    timestampMs: nowMs,
  };
}

/**
 * Artwork ids ordered by decayed trending score, highest first.
 * Empty if Redis isn't configured, `limit <= 0`, or nothing has a score yet.
 */
export async function getTopTrendingArtworkIds(
  limit: number,
  options?: GetTrendingOptions,
): Promise<readonly string[]> {
  if (!Number.isFinite(limit) || limit <= 0) {
    return [];
  }

  const redis = activeRedisClient;
  if (redis === undefined) {
    return [];
  }

  const shouldRecompute = options?.recomputeDecay ?? decayConfig.recomputeOnRead;
  if (shouldRecompute) {
    await applyTrendingDecay({
      nowMs: options?.nowMs,
      halfLifeMs: options?.halfLifeMs,
    });
  }

  return redis.zrevrange(TRENDING_KEY, 0, Math.floor(limit) - 1);
}
