/**
 * Per-user "recently viewed" artwork tracking, stored in Redis (not the
 * database — an ephemeral, debounced signal, not a durable record).
 *
 * Also feeds the trending score (a view is a trending signal) — recording
 * a view does both in one call so callers don't have to remember to wire
 * up both separately.
 */

import type { Artwork } from '@prisma/client';

import { prisma } from '@/services';

import { recordTrendingSignal } from './trending.service';
import { tryGetRedisClient } from './redis.service';

const DEBOUNCE_TTL_SECONDS = 60 * 60;
const MAX_RECENTLY_VIEWED = 50;

function debounceKey(userId: string, artworkId: string): string {
  return `recently-viewed:debounce:${userId}:${artworkId}`;
}

function listKey(userId: string): string {
  return `recently-viewed:list:${userId}`;
}

export interface RecordViewResult {
  readonly recorded: boolean;
}

/**
 * Records a view for "recently viewed" and trending, debounced to once per
 * user per artwork per hour. A no-op (never throws) when Redis isn't
 * configured.
 */
export async function recordArtworkView(
  userId: string,
  artworkId: string,
): Promise<RecordViewResult> {
  const redis = tryGetRedisClient();
  if (redis === undefined) {
    return { recorded: false };
  }

  const wasSet = await redis.set(
    debounceKey(userId, artworkId),
    '1',
    'EX',
    DEBOUNCE_TTL_SECONDS,
    'NX',
  );
  if (wasSet === null) {
    return { recorded: false };
  }

  const key = listKey(userId);
  await redis.zadd(key, Date.now(), artworkId);
  await redis.zremrangebyrank(key, 0, -(MAX_RECENTLY_VIEWED + 1));
  await recordTrendingSignal(artworkId, 'view');

  return { recorded: true };
}

export interface RecentlyViewedPage {
  readonly items: readonly Artwork[];
  readonly page: number;
  readonly limit: number;
  readonly total: number;
}

/** Most-recently-viewed first. Empty when Redis isn't configured. */
export async function listRecentlyViewed(
  userId: string,
  page: number,
  limit: number,
): Promise<RecentlyViewedPage> {
  const redis = tryGetRedisClient();
  if (redis === undefined) {
    return { items: [], page, limit, total: 0 };
  }

  const key = listKey(userId);
  const total = await redis.zcard(key);
  const start = (page - 1) * limit;
  const ids = await redis.zrevrange(key, start, start + limit - 1);
  if (ids.length === 0) {
    return { items: [], page, limit, total };
  }

  const artworks = await prisma.artwork.findMany({ where: { id: { in: [...ids] } } });
  const byId = new Map(artworks.map((artwork) => [artwork.id, artwork]));
  const items = ids
    .map((id) => byId.get(id))
    .filter((artwork): artwork is Artwork => artwork !== undefined);

  return { items, page, limit, total };
}
