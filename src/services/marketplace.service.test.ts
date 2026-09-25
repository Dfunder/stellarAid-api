import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const prisma = {
    artwork: { findMany: vi.fn() },
    artistProfile: { findMany: vi.fn() },
  };
  return { prismaMock: prisma };
});

vi.mock('@/services', () => ({ prisma: prismaMock }));

import { browseArtworks } from './marketplace.service';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.artwork.findMany.mockResolvedValue([]);
});

describe('browseArtworks — filtering', () => {
  it('always scopes to published, unsold artworks', async () => {
    await browseArtworks({}, 'newest', undefined, 20);

    const { where } = prismaMock.artwork.findMany.mock.calls[0]![0];
    expect(where).toMatchObject({ published: true, sold: false });
  });

  it('applies the category filter', async () => {
    await browseArtworks({ category: 'PHOTOGRAPHY' as never }, 'newest', undefined, 20);

    const { where } = prismaMock.artwork.findMany.mock.calls[0]![0];
    expect(where.category).toBe('PHOTOGRAPHY');
  });

  it('applies min/max price as a range filter', async () => {
    await browseArtworks({ minPrice: 10, maxPrice: 100 }, 'newest', undefined, 20);

    const { where } = prismaMock.artwork.findMany.mock.calls[0]![0];
    expect(where.price).toEqual({ gte: 10, lte: 100 });
  });

  it('resolves verifiedOnly to a userId-in-list filter from ArtistProfile', async () => {
    prismaMock.artistProfile.findMany.mockResolvedValue([
      { userId: 'artist-1' },
      { userId: 'artist-2' },
    ]);

    await browseArtworks({ verifiedOnly: true }, 'newest', undefined, 20);

    expect(prismaMock.artistProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { verified: true } }),
    );
    const { where } = prismaMock.artwork.findMany.mock.calls[0]![0];
    expect(where.userId).toEqual({ in: ['artist-1', 'artist-2'] });
  });
});

describe('browseArtworks — sorting', () => {
  it('sorts by price ascending for price_asc', async () => {
    await browseArtworks({}, 'price_asc', undefined, 20);

    const { orderBy } = prismaMock.artwork.findMany.mock.calls[0]![0];
    expect(orderBy[0]).toEqual({ price: 'asc' });
  });

  it('sorts by price descending for price_desc', async () => {
    await browseArtworks({}, 'price_desc', undefined, 20);

    const { orderBy } = prismaMock.artwork.findMany.mock.calls[0]![0];
    expect(orderBy[0]).toEqual({ price: 'desc' });
  });

  it('falls back to newest for popular and rating (no engagement metric yet)', async () => {
    await browseArtworks({}, 'popular', undefined, 20);
    const popularOrder = prismaMock.artwork.findMany.mock.calls[0]![0].orderBy;

    await browseArtworks({}, 'rating', undefined, 20);
    const ratingOrder = prismaMock.artwork.findMany.mock.calls[1]![0].orderBy;

    expect(popularOrder[0]).toEqual({ createdAt: 'desc' });
    expect(ratingOrder[0]).toEqual({ createdAt: 'desc' });
  });
});

describe('browseArtworks — cursor pagination', () => {
  it('requests one extra row and reports nextCursor when there is more', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ id: `a-${i}` }));
    prismaMock.artwork.findMany.mockResolvedValue(rows);

    const result = await browseArtworks({}, 'newest', undefined, 2);

    expect(prismaMock.artwork.findMany.mock.calls[0]![0].take).toBe(3);
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe('a-1');
  });

  it('reports no nextCursor on the last page', async () => {
    prismaMock.artwork.findMany.mockResolvedValue([{ id: 'a-0' }]);

    const result = await browseArtworks({}, 'newest', undefined, 2);

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });
});
