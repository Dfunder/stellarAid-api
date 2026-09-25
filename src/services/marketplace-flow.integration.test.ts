/**
 * Integration-style tests chaining multiple service calls together, the way
 * a real request flow would: browse -> search -> filter -> artwork detail,
 * featured/trending, recently-viewed tracking, and save/unsave. Prisma and
 * Redis are mocked (no real DB/HTTP layer in this codebase — see
 * auth.service.test.ts for the same convention), so these exercise the
 * service-layer contracts end to end rather than true HTTP integration.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/middlewares';

const { prismaMock, redisMock, tryGetRedisClientMock } = vi.hoisted(() => {
  const prisma = {
    artwork: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    save: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    $queryRaw: vi.fn(),
  };
  const redis = {
    get: vi.fn(),
    set: vi.fn(),
    zadd: vi.fn(),
    zremrangebyrank: vi.fn(),
    zrevrange: vi.fn(),
    zincrby: vi.fn(),
    zcard: vi.fn(),
    keys: vi.fn().mockResolvedValue([]),
    del: vi.fn(),
  };
  return { prismaMock: prisma, redisMock: redis, tryGetRedisClientMock: vi.fn() };
});

vi.mock('@/services', () => ({ prisma: prismaMock }));
vi.mock('./redis.service', () => ({ tryGetRedisClient: tryGetRedisClientMock }));

import { listPublishedArtworks, getArtworkById } from './artworks.service';
import { searchArtworks } from './search.service';
import { getTrendingArtworks } from './marketplace.service';
import { recordArtworkView, listRecentlyViewed } from './recently-viewed.service';
import { toggleArtworkSave } from './saves.service';

beforeEach(() => {
  vi.clearAllMocks();
  tryGetRedisClientMock.mockReturnValue(redisMock);
  redisMock.keys.mockResolvedValue([]);
});

describe('browse -> search -> filter -> artwork detail', () => {
  const artworkId = 'artwork-1';
  const artwork = { id: artworkId, title: 'Sunset over the bay', category: 'PHOTOGRAPHY' };

  it('carries a consistent artwork through each step of the journey', async () => {
    redisMock.get.mockResolvedValue(null);
    prismaMock.artwork.findMany.mockResolvedValueOnce([artwork]);
    prismaMock.artwork.count.mockResolvedValueOnce(1);

    const browsePage = await listPublishedArtworks({ category: 'PHOTOGRAPHY' }, 1, 20);
    expect(browsePage.items).toEqual([artwork]);

    redisMock.get.mockResolvedValue(null);
    prismaMock.$queryRaw.mockResolvedValueOnce([artwork]);

    const searchPage = await searchArtworks('sunset', { category: 'PHOTOGRAPHY' }, 1, 20);
    expect(searchPage.items).toEqual([artwork]);
    expect(searchPage.items[0]?.id).toBe(browsePage.items[0]?.id);

    prismaMock.artwork.findUnique.mockResolvedValueOnce(artwork);

    const detail = await getArtworkById(searchPage.items[0]!.id);
    expect(detail).toEqual(artwork);
  });

  it('search results are consistent across repeated requests (served from cache)', async () => {
    redisMock.get.mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify([artwork]));
    prismaMock.$queryRaw.mockResolvedValueOnce([artwork]);

    const first = await searchArtworks('sunset', {}, 1, 20);
    const second = await searchArtworks('sunset', {}, 1, 20);

    expect(second.items).toEqual(first.items);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe('trending', () => {
  it('ranks by trending score and falls back to recent artworks when nothing has a score', async () => {
    redisMock.zrevrange.mockResolvedValueOnce(['artwork-2', 'artwork-1']);
    prismaMock.artwork.findMany.mockResolvedValueOnce([
      { id: 'artwork-1' },
      { id: 'artwork-2' },
    ]);
    redisMock.get.mockResolvedValue(null);

    const trending = await getTrendingArtworks();
    expect(trending.map((a) => a.id)).toEqual(['artwork-2', 'artwork-1']);

    redisMock.zrevrange.mockResolvedValueOnce([]);
    const fallback = [{ id: 'artwork-3' }];
    prismaMock.artwork.findMany.mockResolvedValueOnce(fallback);
    redisMock.get.mockResolvedValueOnce(null);

    const trendingFallback = await getTrendingArtworks();
    expect(trendingFallback).toEqual(fallback);
  });
});

describe('recently viewed tracking', () => {
  const userId = 'user-1';
  const artworkId = 'artwork-1';

  it('records a view once, then lists it back for the viewer', async () => {
    redisMock.set.mockResolvedValueOnce('OK');
    const result = await recordArtworkView(userId, artworkId);
    expect(result.recorded).toBe(true);
    expect(redisMock.zadd).toHaveBeenCalledWith(
      `recently-viewed:list:${userId}`,
      expect.any(Number),
      artworkId,
    );

    redisMock.zcard.mockResolvedValueOnce(1);
    redisMock.zrevrange.mockResolvedValueOnce([artworkId]);
    prismaMock.artwork.findMany.mockResolvedValueOnce([{ id: artworkId }]);

    const page = await listRecentlyViewed(userId, 1, 20);
    expect(page.items).toEqual([{ id: artworkId }]);
    expect(page.total).toBe(1);
  });

  it('does not record a second view within the debounce window', async () => {
    redisMock.set.mockResolvedValueOnce(null);
    const result = await recordArtworkView(userId, artworkId);
    expect(result.recorded).toBe(false);
    expect(redisMock.zadd).not.toHaveBeenCalled();
  });
});

describe('save/unsave from marketplace', () => {
  const userId = 'user-1';
  const artworkId = 'artwork-1';

  it('persists the toggled save state across calls', async () => {
    prismaMock.artwork.findUnique.mockResolvedValue({ id: artworkId });

    prismaMock.save.findUnique.mockResolvedValueOnce(null);
    const saved = await toggleArtworkSave(userId, artworkId);
    expect(saved).toEqual({ saved: true });
    expect(prismaMock.save.create).toHaveBeenCalledWith({ data: { userId, artworkId } });

    prismaMock.save.findUnique.mockResolvedValueOnce({ id: 'save-1', userId, artworkId });
    const unsaved = await toggleArtworkSave(userId, artworkId);
    expect(unsaved).toEqual({ saved: false });
    expect(prismaMock.save.delete).toHaveBeenCalledWith({ where: { id: 'save-1' } });
  });

  it('rejects saving an artwork that does not exist', async () => {
    prismaMock.artwork.findUnique.mockResolvedValue(null);
    await expect(toggleArtworkSave(userId, 'missing-artwork')).rejects.toThrow(AppError);
  });
});
