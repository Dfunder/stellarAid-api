/**
 * Public platform stats: aggregate counts only, never anything tied to an
 * individual user (no emails, no per-user breakdowns) — this endpoint is
 * unauthenticated, so nothing here is data that shouldn't be public.
 *
 * Cached in Redis for an hour; a cache miss (or no Redis configured) falls
 * through to computing it fresh.
 */

import { prisma } from '@/services';

import { tryGetRedisClient } from './redis.service';

const CACHE_KEY = 'stats:platform';
const CACHE_TTL_SECONDS = 60 * 60;

export interface PlatformStats {
  readonly totalUsers: number;
  readonly totalArtists: number;
  readonly totalArtworks: number;
  readonly totalSales: number;
  readonly totalVolume: string;
}

async function computePlatformStats(): Promise<PlatformStats> {
  const [totalUsers, totalArtists, totalArtworks, totalSales, volumeAggregate] =
    await Promise.all([
      prisma.user.count(),
      prisma.artistProfile.count(),
      prisma.artwork.count(),
      prisma.order.count({ where: { status: 'COMPLETED' } }),
      prisma.order.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
    ]);

  return {
    totalUsers,
    totalArtists,
    totalArtworks,
    totalSales,
    totalVolume: (volumeAggregate._sum.amount ?? 0).toString(),
  };
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const redis = tryGetRedisClient();
  if (redis === undefined) {
    return computePlatformStats();
  }

  const cached = await redis.get(CACHE_KEY);
  if (cached !== null) {
    return JSON.parse(cached) as PlatformStats;
  }

  const stats = await computePlatformStats();
  await redis.set(CACHE_KEY, JSON.stringify(stats), 'EX', CACHE_TTL_SECONDS);
  return stats;
}
