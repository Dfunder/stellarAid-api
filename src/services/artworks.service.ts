/**
 * Artwork listing and detail lookup.
 *
 * Listings are the highest-traffic read in the API, so they're cached
 * (cache-aside, 5-minute TTL — the "stale data within a 5-minute window"
 * budget named in the caching issue).
 */

import type { Artwork, ArtworkCategory } from '@prisma/client';
 * Artwork CRUD, publishing-workflow, and detail service.
 */

import type { Asset, Artwork, ArtworkCategory } from '@prisma/client';
 * Artwork CRUD and publishing-workflow service.
 */

import type { Asset, ArtworkCategory } from '@prisma/client';

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
import { recordArtworkView } from './recently-viewed.service';

export interface CreateArtworkInput {
  readonly title: string;
  readonly description?: string;
  readonly category: ArtworkCategory;
  readonly tags?: readonly string[];
  readonly price?: number;
  readonly asset?: Asset;
}

export interface UpdateArtworkInput {
  readonly title?: string;
  readonly description?: string;
  readonly category?: ArtworkCategory;
  readonly tags?: readonly string[];
  readonly price?: number;
  readonly asset?: Asset;
}

async function findOwnedArtwork(userId: string, artworkId: string) {
  const artwork = await prisma.artwork.findUnique({ where: { id: artworkId } });
  if (artwork === null) {
    throw new AppError('NOT_FOUND', 'Artwork not found');
  }
  if (artwork.userId !== userId) {
    throw new AppError('FORBIDDEN', 'You do not own this artwork');
  }
  return artwork;
}

/** Duplicate titles are allowed — there's no uniqueness constraint on title. */
export async function createArtwork(userId: string, input: CreateArtworkInput) {
  return prisma.artwork.create({
    data: {
      userId,
      title: input.title,
      description: input.description,
      category: input.category,
      tags: input.tags ?? undefined,
      price: input.price,
      asset: input.asset,
    },
  });
}

export async function updateArtwork(userId: string, artworkId: string, input: UpdateArtworkInput) {
  await findOwnedArtwork(userId, artworkId);
  return prisma.artwork.update({
    where: { id: artworkId },
    data: {
      title: input.title,
      description: input.description,
      category: input.category,
      tags: input.tags === undefined ? undefined : input.tags,
      price: input.price,
      asset: input.asset,
    },
  });
}

export async function getArtworkById(artworkId: string) {
  const artwork = await prisma.artwork.findUnique({ where: { id: artworkId } });
  if (artwork === null) {
    throw new AppError('NOT_FOUND', 'Artwork not found');
  }
  return artwork;
}

/**
 * Flips the published flag. Publishing (false → true) requires at least one
 * attached media record — an artwork with no images shouldn't go live.
 * Unpublishing has no such requirement.
 */
export async function setArtworkPublished(userId: string, artworkId: string, published: boolean) {
  const artwork = await findOwnedArtwork(userId, artworkId);

  if (published && !artwork.published) {
    const mediaCount = await prisma.artworkMedia.count({ where: { artworkId } });
    if (mediaCount === 0) {
      throw new AppError(
        'UNPROCESSABLE_ENTITY',
        'Cannot publish an artwork with no media attached.',
      );
    }
  }

  return prisma.artwork.update({ where: { id: artworkId }, data: { published } });
}

export async function deleteArtwork(userId: string, artworkId: string): Promise<void> {
  await findOwnedArtwork(userId, artworkId);
  await prisma.artwork.delete({ where: { id: artworkId } });
}

export interface ReviewSummary {
  readonly averageRating: number | null;
  readonly count: number;
}

export interface ArtworkDetail {
  readonly artwork: Artwork;
  readonly mediaIds: readonly string[];
  readonly relatedArtworks: readonly Artwork[];
  readonly reviewSummary: ReviewSummary;
}

const RELATED_ARTWORKS_LIMIT = 6;

/**
 * "License" isn't a modeled concept in this schema (no License field/table)
 * — not included here rather than guessed at. Review summary aggregates
 * `Review.rating` where `targetId` is the artwork's owner (the artist),
 * since reviews target sellers, not individual artworks.
 */
export async function getArtworkDetail(
  artworkId: string,
  viewerId: string | undefined,
): Promise<ArtworkDetail> {
  const artwork = await getArtworkById(artworkId);

  const [mediaLinks, relatedArtworks, reviewAggregate] = await Promise.all([
    prisma.artworkMedia.findMany({ where: { artworkId }, orderBy: { sort: 'asc' } }),
    prisma.artwork.findMany({
      where: {
        category: artwork.category,
        published: true,
        id: { not: artworkId },
      },
      orderBy: { createdAt: 'desc' },
      take: RELATED_ARTWORKS_LIMIT,
    }),
    prisma.review.aggregate({
      where: { targetId: artwork.userId },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ]);

  // View-count increment is fire-and-forget (async, debounced per viewer) —
  // detail responses shouldn't wait on it or fail the request if Redis is
  // briefly unavailable.
  if (viewerId !== undefined) {
    void recordArtworkView(viewerId, artworkId).catch(() => undefined);
  }

  return {
    artwork,
    mediaIds: mediaLinks.map((link) => link.mediaId),
    relatedArtworks,
    reviewSummary: {
      averageRating: reviewAggregate._avg.rating,
      count: reviewAggregate._count.rating,
    },
  };
}
