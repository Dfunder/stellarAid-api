/**
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

export async function recordTrendingView(artworkId: string): Promise<void> {
  const redis = tryGetRedisClient();
  if (redis === undefined) {
    return;
  }
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
