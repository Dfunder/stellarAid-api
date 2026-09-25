/**
 * Integration-style tests chaining multiple service calls together, the way
 * a real request flow would: artwork create → publish → marketplace
 * listing, artwork detail with related data, and portfolio creation →
 * reordering. Prisma is mocked (no real DB/HTTP layer in this codebase —
 * see auth.service.test.ts for the same convention), so these exercise the
 * service-layer contracts end to end rather than true HTTP integration.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/middlewares';

const { prismaMock } = vi.hoisted(() => {
  const prisma = {
    artwork: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    artworkMedia: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    portfolioItem: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    review: {
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { prismaMock: prisma };
});

vi.mock('@/services', () => ({ prisma: prismaMock }));

import { browseArtworks } from './marketplace.service';
import { createPortfolioItem, listPortfolioItems, reorderPortfolioItems } from './portfolios.service';
import { createArtwork, getArtworkDetail, setArtworkPublished } from './artworks.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('artwork lifecycle: create -> media -> publish -> marketplace listing', () => {
  const ownerId = 'user-1';
  const artworkId = 'artwork-1';

  it('an unpublished artwork with no media cannot be published', async () => {
    const created = {
      id: artworkId,
      userId: ownerId,
      title: 'Sunset',
      category: 'DIGITAL_PAINTING',
      published: false,
      sold: false,
    };
    prismaMock.artwork.create.mockResolvedValue(created);

    const artwork = await createArtwork(ownerId, { title: 'Sunset', category: 'DIGITAL_PAINTING' });
    expect(artwork).toEqual(created);

    prismaMock.artwork.findUnique.mockResolvedValue(created);
    prismaMock.artworkMedia.count.mockResolvedValue(0);

    await expect(setArtworkPublished(ownerId, artworkId, true)).rejects.toThrow(AppError);
  });

  it('publishes once media is attached, and the artwork then surfaces in marketplace browse', async () => {
    const unpublished = {
      id: artworkId,
      userId: ownerId,
      title: 'Sunset',
      category: 'DIGITAL_PAINTING',
      published: false,
      sold: false,
    };
    const published = { ...unpublished, published: true };

    prismaMock.artwork.findUnique.mockResolvedValue(unpublished);
    prismaMock.artworkMedia.count.mockResolvedValue(1);
    prismaMock.artwork.update.mockResolvedValue(published);

    const result = await setArtworkPublished(ownerId, artworkId, true);
    expect(result.published).toBe(true);

    prismaMock.artwork.findMany.mockResolvedValue([published]);

    const page = await browseArtworks({}, 'newest', undefined, 20);
    expect(page.items).toEqual([published]);
    expect(page.nextCursor).toBeNull();
    expect(prismaMock.artwork.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ published: true, sold: false }),
      }),
    );
  });
});

describe('marketplace browse: filter composition', () => {
  it('applies category and price range filters to the query', async () => {
    prismaMock.artwork.findMany.mockResolvedValue([]);

    await browseArtworks(
      { category: 'PHOTOGRAPHY', minPrice: 10, maxPrice: 100 },
      'price_asc',
      undefined,
      20,
    );

    expect(prismaMock.artwork.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: 'PHOTOGRAPHY',
          price: { gte: 10, lte: 100 },
        }),
        orderBy: [{ price: 'asc' }, { id: 'asc' }],
      }),
    );
  });
});

describe('artwork detail with related items', () => {
  const artworkId = 'artwork-1';

  it('rejects when the artwork does not exist', async () => {
    prismaMock.artwork.findUnique.mockResolvedValue(null);
    await expect(getArtworkDetail(artworkId, undefined)).rejects.toThrow(AppError);
  });

  it('assembles media ids, related artworks, and the review summary', async () => {
    const artwork = {
      id: artworkId,
      userId: 'artist-1',
      category: 'PHOTOGRAPHY',
      published: true,
    };
    const related = { id: 'artwork-2', userId: 'artist-1', category: 'PHOTOGRAPHY' };

    prismaMock.artwork.findUnique.mockResolvedValue(artwork);
    prismaMock.artworkMedia.findMany.mockResolvedValue([
      { mediaId: 'media-1' },
      { mediaId: 'media-2' },
    ]);
    prismaMock.artwork.findMany.mockResolvedValue([related]);
    prismaMock.review.aggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { rating: 10 },
    });

    const detail = await getArtworkDetail(artworkId, undefined);

    expect(detail.artwork).toEqual(artwork);
    expect(detail.mediaIds).toEqual(['media-1', 'media-2']);
    expect(detail.relatedArtworks).toEqual([related]);
    expect(detail.reviewSummary).toEqual({ averageRating: 4.5, count: 10 });
    expect(prismaMock.artwork.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: 'PHOTOGRAPHY', id: { not: artworkId } }),
      }),
    );
  });
});

describe('portfolio: creation and reordering', () => {
  const userId = 'user-1';

  it('appends new items after the current highest order, then reorders them', async () => {
    prismaMock.portfolioItem.findFirst.mockResolvedValueOnce(null);
    const item1 = { id: 'item-1', userId, title: 'First', order: 0 };
    prismaMock.portfolioItem.create.mockResolvedValueOnce(item1);
    const created1 = await createPortfolioItem(userId, { title: 'First' });
    expect(created1.order).toBe(0);

    prismaMock.portfolioItem.findFirst.mockResolvedValueOnce({ order: 0 });
    const item2 = { id: 'item-2', userId, title: 'Second', order: 1 };
    prismaMock.portfolioItem.create.mockResolvedValueOnce(item2);
    const created2 = await createPortfolioItem(userId, { title: 'Second' });
    expect(created2.order).toBe(1);
    expect(prismaMock.portfolioItem.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ order: 1 }) }),
    );

    prismaMock.portfolioItem.findMany.mockResolvedValueOnce([item1, item2]);
    prismaMock.$transaction.mockResolvedValueOnce(undefined);
    const reorderedList = [
      { ...item2, order: 0 },
      { ...item1, order: 1 },
    ];
    prismaMock.portfolioItem.findMany.mockResolvedValueOnce(reorderedList);

    const reordered = await reorderPortfolioItems(userId, ['item-2', 'item-1']);
    expect(reordered.map((item) => item.id)).toEqual(['item-2', 'item-1']);
  });

  it('rejects a reorder that does not match the caller\'s item ids', async () => {
    prismaMock.portfolioItem.findMany.mockResolvedValueOnce([{ id: 'item-1', userId }]);
    await expect(reorderPortfolioItems(userId, ['item-1', 'someone-elses-item'])).rejects.toThrow(
      AppError,
    );
  });

  it('lists the caller\'s items ordered by position', async () => {
    const items = [
      { id: 'item-1', userId, order: 0 },
      { id: 'item-2', userId, order: 1 },
    ];
    prismaMock.portfolioItem.findMany.mockResolvedValue(items);
    const result = await listPortfolioItems(userId);
    expect(result).toEqual(items);
  });
});
