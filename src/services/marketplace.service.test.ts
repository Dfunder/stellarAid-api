/**
 * Marketplace service logic tests: trending ranking, search ranking,
 * browse-result caching, and price conversion accuracy.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/middlewares';

const { prismaMock, redisMock, tryGetRedisClientMock } = vi.hoisted(() => {
  const prisma = {
    artwork: { findMany: vi.fn() },
    artistProfile: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  };
  const redis = {
    get: vi.fn(),
    set: vi.fn(),
    zincrby: vi.fn(),
    zrevrange: vi.fn(),
  };
  return { prismaMock: prisma, redisMock: redis, tryGetRedisClientMock: vi.fn() };
});

vi.mock('@/services', () => ({ prisma: prismaMock }));
vi.mock('./redis.service', () => ({ tryGetRedisClient: tryGetRedisClientMock }));

import { browseArtworks, listTrendingArtworks } from './marketplace.service';
import { convertAmount, getRate } from './price-conversion.service';
import { searchArtworks } from './search.service';

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('trending algorithm', () => {
  it('ranks results by trending score, not database row order', async () => {
    tryGetRedisClientMock.mockReturnValue(redisMock);
    redisMock.zrevrange.mockResolvedValue(['artwork-2', 'artwork-1']);
    prismaMock.artwork.findMany.mockResolvedValue([
      { id: 'artwork-1', title: 'A' },
      { id: 'artwork-2', title: 'B' },
    ]);

    const result = await listTrendingArtworks();

    expect(result.map((artwork) => artwork.id)).toEqual(['artwork-2', 'artwork-1']);
  });

  it('falls back to featured artworks when nothing has a trending score yet', async () => {
    tryGetRedisClientMock.mockReturnValue(redisMock);
    redisMock.zrevrange.mockResolvedValue([]);
    const featured = [{ id: 'artwork-3' }];
    prismaMock.artwork.findMany.mockResolvedValue(featured);

    const result = await listTrendingArtworks();

    expect(result).toEqual(featured);
  });

  it('falls back to featured artworks when redis is not configured', async () => {
    tryGetRedisClientMock.mockReturnValue(undefined);
    const featured = [{ id: 'artwork-4' }];
    prismaMock.artwork.findMany.mockResolvedValue(featured);

    const result = await listTrendingArtworks();

    expect(result).toEqual(featured);
  });
});

describe('search ranking', () => {
  it('preserves the rank order Postgres returns and paginates via an offset cursor', async () => {
    tryGetRedisClientMock.mockReturnValue(undefined);
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

    const page = await searchArtworks('sunset', {}, undefined, 2);

    expect(page.items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(page.nextCursor).not.toBeNull();
  });

  it('falls back to a plain browse for an empty query, without touching search ranking', async () => {
    tryGetRedisClientMock.mockReturnValue(undefined);
    prismaMock.artwork.findMany.mockResolvedValue([]);

    const page = await searchArtworks('   ', {}, undefined, 20);

    expect(page.items).toEqual([]);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('browse caching behavior', () => {
  it('serves a cache hit without querying the database', async () => {
    tryGetRedisClientMock.mockReturnValue(redisMock);
    const cachedPage = { items: [{ id: 'cached' }], nextCursor: null };
    redisMock.get.mockResolvedValue(JSON.stringify(cachedPage));

    const page = await browseArtworks({}, 'newest', undefined, 20);

    expect(page).toEqual(cachedPage);
    expect(prismaMock.artwork.findMany).not.toHaveBeenCalled();
  });

  it('queries the database on a cache miss and writes the result back', async () => {
    tryGetRedisClientMock.mockReturnValue(redisMock);
    redisMock.get.mockResolvedValue(null);
    prismaMock.artwork.findMany.mockResolvedValue([{ id: 'fresh' }]);

    const page = await browseArtworks({}, 'newest', undefined, 20);

    expect(page.items).toEqual([{ id: 'fresh' }]);
    expect(redisMock.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'EX', 30);
  });

  it('bypasses caching entirely when redis is not configured', async () => {
    tryGetRedisClientMock.mockReturnValue(undefined);
    prismaMock.artwork.findMany.mockResolvedValue([]);

    await browseArtworks({}, 'newest', undefined, 20);

    expect(prismaMock.artwork.findMany).toHaveBeenCalled();
    expect(redisMock.set).not.toHaveBeenCalled();
  });
});

describe('price conversion accuracy', () => {
  it('computes the mid price from the best bid/ask and caches it', async () => {
    tryGetRedisClientMock.mockReturnValue(redisMock);
    redisMock.get.mockResolvedValue(null);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ bids: [{ price: '0.10' }], asks: [{ price: '0.12' }] }),
    }) as unknown as typeof fetch;

    const rate = await getRate('XLM', 'USDC');

    expect(rate).toBeCloseTo(0.11);
    expect(redisMock.set).toHaveBeenCalled();
  });

  it('serves a cached rate without calling the DEX again', async () => {
    tryGetRedisClientMock.mockReturnValue(redisMock);
    redisMock.get.mockResolvedValue('0.5');
    global.fetch = vi.fn() as unknown as typeof fetch;

    const rate = await getRate('XLM', 'USDC');

    expect(rate).toBe(0.5);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('converts an amount using the resolved rate', async () => {
    tryGetRedisClientMock.mockReturnValue(undefined);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ bids: [{ price: '2' }], asks: [{ price: '2' }] }),
    }) as unknown as typeof fetch;

    const result = await convertAmount(10, 'XLM', 'USDC');

    expect(result.rate).toBe(2);
    expect(result.amount).toBe(20);
  });

  it('reports no rate, rather than guessing, for an asset with no configured issuer', async () => {
    tryGetRedisClientMock.mockReturnValue(undefined);
    global.fetch = vi.fn() as unknown as typeof fetch;

    const rate = await getRate('NGNT', 'XLM');

    expect(rate).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects conversion with a clear error when no rate is available', async () => {
    tryGetRedisClientMock.mockReturnValue(undefined);
    global.fetch = vi.fn() as unknown as typeof fetch;

    await expect(convertAmount(10, 'NGNT', 'XLM')).rejects.toThrow(AppError);
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
