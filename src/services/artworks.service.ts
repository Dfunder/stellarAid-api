/**
 * Artwork listing and detail lookup.
 *
 * Listings are the highest-traffic read in the API, so they're cached
 * (cache-aside, 5-minute TTL — the "stale data within a 5-minute window"
 * budget named in the caching issue).
 */

import type { Artwork, ArtworkCategory } from '@prisma/client';

import { AppError } from '@/middlewares';
import { prisma } from '@/services';

import { cached } from './cache.service';

export interface ListArtworksFilters {
  readonly category?: ArtworkCategory;
}

export interface ArtworkPage {
  readonly items: readonly Artwork[];
  readonly page: number;
  readonly limit: number;
  readonly total: number;
}

const LISTING_CACHE_TTL_SECONDS = 5 * 60;

function listingCacheKey(filters: ListArtworksFilters, page: number, limit: number): string {
  return `artworks:list:${JSON.stringify({ filters, page, limit })}`;
}

export async function listPublishedArtworks(
  filters: ListArtworksFilters,
  page: number,
  limit: number,
): Promise<ArtworkPage> {
  return cached(listingCacheKey(filters, page, limit), LISTING_CACHE_TTL_SECONDS, async () => {
    const where = {
      published: true,
      sold: false,
      ...(filters.category !== undefined ? { category: filters.category } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.artwork.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.artwork.count({ where }),
    ]);

    return { items, page, limit, total };
  });
}

export async function getArtworkById(artworkId: string): Promise<Artwork> {
  const artwork = await prisma.artwork.findUnique({ where: { id: artworkId } });
  if (artwork === null) {
    throw new AppError('NOT_FOUND', 'Artwork not found');
  }
  return artwork;
}
