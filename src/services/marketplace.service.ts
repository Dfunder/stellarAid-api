/**
 * Marketplace browse service.
 *
 * Only published, unsold artworks are ever surfaced here — this is a
 * discovery surface, not an owner-management one (see `artworks.service`
 * for that).
 */

import type { Artwork, ArtworkCategory, Asset, Prisma } from '@prisma/client';

import { prisma } from '@/services';

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

async function verifiedArtistUserIds(): Promise<string[]> {
  const profiles = await prisma.artistProfile.findMany({
    where: { verified: true },
    select: { userId: true },
  });
  return profiles.map((p) => p.userId);
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
 * unsorted/incorrect ranking.
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

export async function browseArtworks(
  filters: BrowseFilters,
  sort: MarketplaceSort,
  cursor: string | undefined,
  limit: number,
): Promise<BrowsePage> {
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

  return { items: page, nextCursor };
}

/**
 * Curated proxy for "featured": most recently published, unsold artworks.
 * There's no editorial-curation flag or rating aggregate to rank by yet.
 */
export async function listFeaturedArtworks(): Promise<readonly Artwork[]> {
  return prisma.artwork.findMany({
    where: { published: true, sold: false },
    orderBy: [{ createdAt: 'desc' }],
    take: FEATURED_LIMIT,
  });
}
