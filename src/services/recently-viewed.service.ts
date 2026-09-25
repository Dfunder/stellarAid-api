/**
 * Recently-viewed tracking.
 *
 * Stored entirely in Redis (a sorted set per user, score = last-viewed
 * timestamp) rather than the database, per the issue's performance
 * requirement — this is high-write, low-durability-need data.
 */

import { AppError } from '@/middlewares';
import { prisma } from '@/services';

import { getRedisClient } from './redis.service';

const DEBOUNCE_TTL_SECONDS = 60 * 60; // once per hour per user per artwork
const MAX_RECENTLY_VIEWED = 50;

function debounceKey(userId: string, artworkId: string): string {
  return `view:debounce:${userId}:${artworkId}`;
}

function viewCountKey(artworkId: string): string {
  return `view:count:${artworkId}`;
function listKey(userId: string): string {
  return `recently-viewed:${userId}`;
}

export interface RecordViewResult {
  readonly recorded: boolean;
}

/** Increments the artwork's view counter unless the same user viewed it
 * within the last hour, in which case it's a silent no-op. */
/** Records a view unless the same user viewed the same artwork within the
 * last hour, in which case it's a silent no-op (not an error). */
export async function recordArtworkView(
  userId: string,
  artworkId: string,
): Promise<RecordViewResult> {
  const artwork = await prisma.artwork.findUnique({ where: { id: artworkId } });
  if (artwork === null) {
    throw new AppError('NOT_FOUND', 'Artwork not found');
  }

  const redis = getRedisClient();
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

  await redis.incr(viewCountKey(artworkId));
  return { recorded: true };
}

export async function getArtworkViewCount(artworkId: string): Promise<number> {
  const redis = getRedisClient();
  const raw = await redis.get(viewCountKey(artworkId));
  return raw === null ? 0 : Number.parseInt(raw, 10);
  const key = listKey(userId);
  await redis.zadd(key, Date.now(), artworkId);
  // Keep only the MAX_RECENTLY_VIEWED highest-scored (most recent) members.
  await redis.zremrangebyrank(key, 0, -(MAX_RECENTLY_VIEWED + 1));

  return { recorded: true };
}

export interface RecentlyViewedPage {
  readonly items: readonly {
    readonly id: string;
    readonly title: string;
    readonly category: string;
    readonly coverMediaId: string | null;
  }[];
  readonly page: number;
  readonly limit: number;
  readonly total: number;
}

export async function listRecentlyViewed(
  userId: string,
  page: number,
  limit: number,
): Promise<RecentlyViewedPage> {
  const redis = getRedisClient();
  const key = listKey(userId);

  const total = await redis.zcard(key);
  const start = (page - 1) * limit;
  const end = start + limit - 1;
  const artworkIds = await redis.zrevrange(key, start, end);

  if (artworkIds.length === 0) {
    return { items: [], page, limit, total };
  }

  const artworks = await prisma.artwork.findMany({ where: { id: { in: artworkIds } } });
  const byId = new Map(artworks.map((a) => [a.id, a]));

  const items = artworkIds
    .map((id) => byId.get(id))
    .filter((a): a is NonNullable<typeof a> => a !== undefined)
    .map((a) => ({
      id: a.id,
      title: a.title,
      category: a.category,
      coverMediaId: a.coverMediaId,
    }));

  return { items, page, limit, total };
}
