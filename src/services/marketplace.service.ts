/**
 * Marketplace browse, featured, trending, and recommended surfaces.
 *
 * Browse is the highest-traffic read path in the API, so results are cached
 * (cache-aside, 30s TTL) and degrade to a no-op when Redis isn't configured.
 * Trending/recommended rank by the weighted trending score (see
 * `trending.service`) and are cached for 5 minutes — "trending results
 * update within 5 minutes of activity" is satisfied by that TTL rather than
 * by pushing updates on every signal. `recommended` is popularity-based at
 * MVP (identical ranking to trending, just a separate cached slot) per the
 * issue's own "personalized (or popularity-based at MVP)" scoping —
 * there's no user interaction history modeled yet to personalize against.
 */

import type { Artwork, ArtworkCategory, Asset, Prisma } from '@prisma/client';

import { prisma } from '@/services';

import { cached } from './cache.service';
import { tryGetRedisClient } from './redis.service';
import { getTopTrendingArtworkIds, getTrendingArtworkIds } from './trending.service';

export type MarketplaceSort = 'newest' | 'price_asc' | 'price_desc' | 'popular' | 'rating';

export interface BrowseFilters {
  readonly category?: ArtworkCategory;
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly asset?: Asset;
  readonly verifiedOnly?: boolean;
}

export interface BrowsePage {
  readonly items: readonly Artwork[];
  readonly nextCursor: string | null;
}

const FEATURED_LIMIT = 10;
const TRENDING_LIMIT = 20;
const RECOMMENDED_LIMIT = 20;
const BROWSE_CACHE_TTL_SECONDS = 30;
const RANKING_CACHE_TTL_SECONDS = 5 * 60;

async function verifiedArtistUserIds(): Promise<string[]> {
  const profiles = await prisma.artistProfile.findMany({
    where: { verified: true },
    select: { userId: true },
  });
  return profiles.map((profile) => profile.userId);
}

async function buildWhere(filters: BrowseFilters): Promise<Prisma.ArtworkWhereInput> {
  const where: Prisma.ArtworkWhereInput = {
    published: true,
    sold: false,
  };
  if (filters.category !== undefined) {
    where.category = filters.category;
  }
  if (filters.asset !== undefined) {
    where.asset = filters.asset;
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.price = {
      ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
    };
  }
  if (filters.verifiedOnly === true) {
    where.userId = { in: await verifiedArtistUserIds() };
  }
  return where;
}

/**
 * `popular` and `rating` don't have a backing metric yet (no view/save
 * counter or artist-rating aggregate wired into this query) — both
 * currently alias to `newest` rather than silently returning an
 * unsorted/incorrect ranking. A real implementation needs a stored
 * engagement counter (or a Save-based count, once that model exists) and
 * a Review-rating aggregate joined by artist id.
 */
function orderBy(sort: MarketplaceSort): Prisma.ArtworkOrderByWithRelationInput[] {
  switch (sort) {
    case 'price_asc':
      return [{ price: 'asc' }, { id: 'asc' }];
    case 'price_desc':
      return [{ price: 'desc' }, { id: 'asc' }];
    case 'newest':
    case 'popular':
    case 'rating':
    default:
      return [{ createdAt: 'desc' }, { id: 'asc' }];
  }
}

function browseCacheKey(
  filters: BrowseFilters,
  sort: MarketplaceSort,
  cursor: string | undefined,
  limit: number,
): string {
  return `marketplace:browse:${JSON.stringify({ filters, sort, cursor, limit })}`;
}

export async function browseArtworks(
  filters: BrowseFilters,
  sort: MarketplaceSort,
  cursor: string | undefined,
  limit: number,
): Promise<BrowsePage> {
  const redis = tryGetRedisClient();
  const cacheKey = browseCacheKey(filters, sort, cursor, limit);

  if (redis !== undefined) {
    const cachedPage = await redis.get(cacheKey);
    if (cachedPage !== null) {
      return JSON.parse(cachedPage) as BrowsePage;
    }
  }

  const where = await buildWhere(filters);

  const items = await prisma.artwork.findMany({
    where,
    orderBy: orderBy(sort),
    take: limit + 1,
    ...(cursor !== undefined ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;
  const result: BrowsePage = { items: page, nextCursor };

  if (redis !== undefined) {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', BROWSE_CACHE_TTL_SECONDS);
  }

  return result;
}

/**
 * Curated proxy for "featured": most recently published, unsold artworks.
 * There's no editorial-curation flag or rating aggregate to rank by yet.
 */
export async function listFeaturedArtworks(
  limit: number = FEATURED_LIMIT,
): Promise<readonly Artwork[]> {
  return prisma.artwork.findMany({
    where: { published: true, sold: false },
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
  });
}

async function rankedByTrendingScore(limit: number): Promise<readonly Artwork[]> {
  const ids = await getTopTrendingArtworkIds(limit);
  if (ids.length === 0) {
    return listFeaturedArtworks(limit);
  }

  const artworks = await prisma.artwork.findMany({
    where: { id: { in: [...ids] }, published: true, sold: false },
  });
  const byId = new Map(artworks.map((artwork) => [artwork.id, artwork]));

  return ids
    .map((id) => byId.get(id))
    .filter((artwork): artwork is Artwork => artwork !== undefined);
}

/**
 * Most-viewed published artworks, ranked by the Redis trending score.
 * Falls back to `listFeaturedArtworks` when Redis isn't configured or
 * nothing has been viewed yet, rather than returning an empty list.
 */
export async function listTrendingArtworks(): Promise<readonly Artwork[]> {
  const ids = await getTrendingArtworkIds(TRENDING_LIMIT);
  if (ids.length === 0) {
    return listFeaturedArtworks();
  }

  const artworks = await prisma.artwork.findMany({
    where: { id: { in: [...ids] }, published: true, sold: false },
  });
  const byId = new Map(artworks.map((artwork) => [artwork.id, artwork]));

  return ids
    .map((id) => byId.get(id))
    .filter((artwork): artwork is Artwork => artwork !== undefined);
}

/** Top trending artworks, weighted by recent views/saves/purchases. */
export async function getTrendingArtworks(): Promise<readonly Artwork[]> {
  return cached('marketplace:trending', RANKING_CACHE_TTL_SECONDS, () =>
    rankedByTrendingScore(TRENDING_LIMIT),
  );
}

/** Popularity-based recommendations (MVP — see file doc comment). */
export async function getRecommendedArtworks(): Promise<readonly Artwork[]> {
  return cached('marketplace:recommended', RANKING_CACHE_TTL_SECONDS, () =>
    rankedByTrendingScore(RECOMMENDED_LIMIT),
  );
}
