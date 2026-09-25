/**
 * Trending-artwork scoring.
 *
 * A single Redis sorted set (`trending:artworks`) accumulates a weighted
 * score per artwork: a view is worth 1 point, a save 3, a purchase 5 —
 * "recent views + saves + purchases weighted", per the issue. There's no
 * time-decay (older activity never loses weight), so this is closer to
 * "most-active overall" than a true recency-weighted trend; a decay pass
 * (e.g. halving scores on a schedule) would be the natural next step, but
 * wasn't implemented without a scheduler already in this codebase to hang
 * it off. Purchases aren't recorded by anything in this codebase yet (no
 * order flow lives in this feature area) — `recordTrendingSignal` accepts
 * `'purchase'` so that hook is ready once one exists.
 *
 * Degrades to a no-op / empty result when Redis isn't configured.
 */

import { invalidateNamespace } from './cache.service';
 * Trending-artwork tracking.
 *
 * A Redis sorted set (`trending:artworks`) scores each artwork by view
 * count; recording a view increments its score. There's no time-decay here
 * — this is a simple "most-viewed" ranking, not a windowed trending
 * algorithm — but it's isolated behind `getTrendingArtworkIds` so a real
 * decay function can replace the scoring later without touching callers.
 *
 * Degrades gracefully (no-op / empty) when Redis isn't configured, since
 * trending is a ranking enhancement, not a feature the API depends on.
 */

import { tryGetRedisClient } from './redis.service';

const TRENDING_KEY = 'trending:artworks';

export type TrendingSignal = 'view' | 'save' | 'purchase';

const SIGNAL_WEIGHTS: Record<TrendingSignal, number> = {
  view: 1,
  save: 3,
  purchase: 5,
};

/** Records a weighted trending signal and invalidates cached
 * trending/recommended results so the next read reflects it. */
export async function recordTrendingSignal(artworkId: string, signal: TrendingSignal): Promise<void> {
export async function recordTrendingView(artworkId: string): Promise<void> {
  const redis = tryGetRedisClient();
  if (redis === undefined) {
    return;
  }
  await redis.zincrby(TRENDING_KEY, SIGNAL_WEIGHTS[signal], artworkId);
  await invalidateNamespace('marketplace');
}

/** Artwork ids ordered by trending score, highest first. Empty if Redis
 * isn't configured or nothing has a score yet. */
export async function getTopTrendingArtworkIds(limit: number): Promise<readonly string[]> {
  await redis.zincrby(TRENDING_KEY, 1, artworkId);
}

/** Artwork ids ordered by view score, highest first. Empty if Redis isn't
 * configured or nothing has been viewed yet. */
export async function getTrendingArtworkIds(limit: number): Promise<readonly string[]> {
  const redis = tryGetRedisClient();
  if (redis === undefined) {
    return [];
  }
  return redis.zrevrange(TRENDING_KEY, 0, limit - 1);
}
