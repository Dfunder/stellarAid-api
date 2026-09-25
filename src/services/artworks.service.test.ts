import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/middlewares';

const { prismaMock } = vi.hoisted(() => {
  const prisma = {
    artwork: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    artworkMedia: {
      count: vi.fn(),
    },
  };
  return { prismaMock: prisma };
});

vi.mock('@/services', () => ({ prisma: prismaMock }));

import {
  createArtwork,
  deleteArtwork,
  getArtworkById,
  setArtworkPublished,
  updateArtwork,
} from './artworks.service';

const OWNER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';
const ARTWORK_ID = 'artwork-1';

function makeArtwork(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: ARTWORK_ID,
    userId: OWNER_ID,
    title: 'Sunset',
    description: null,
    category: 'DIGITAL_PAINTING',
    tags: null,
    coverMediaId: null,
    price: null,
    asset: null,
    published: false,
    sold: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createArtwork', () => {
  it('creates an artwork owned by the caller', async () => {
    prismaMock.artwork.create.mockResolvedValue(makeArtwork());

    await createArtwork(OWNER_ID, { title: 'Sunset', category: 'DIGITAL_PAINTING' as never });

    const { data } = prismaMock.artwork.create.mock.calls[0]![0];
    expect(data.userId).toBe(OWNER_ID);
    expect(data.title).toBe('Sunset');
  });

  it('allows duplicate titles — no uniqueness constraint on title', async () => {
    prismaMock.artwork.create.mockResolvedValueOnce(makeArtwork({ id: 'artwork-1' }));
    prismaMock.artwork.create.mockResolvedValueOnce(makeArtwork({ id: 'artwork-2' }));

    const first = await createArtwork(OWNER_ID, {
      title: 'Sunset',
      category: 'DIGITAL_PAINTING' as never,
    });
    const second = await createArtwork(OWNER_ID, {
      title: 'Sunset',
      category: 'DIGITAL_PAINTING' as never,
    });

    expect(first.id).not.toBe(second.id);
    expect(prismaMock.artwork.create).toHaveBeenCalledTimes(2);
  });
});

describe('updateArtwork', () => {
  it('rejects updates from a non-owner', async () => {
    prismaMock.artwork.findUnique.mockResolvedValue(makeArtwork({ userId: OWNER_ID }));

    await expect(
      updateArtwork(OTHER_USER_ID, ARTWORK_ID, { title: 'New title' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prismaMock.artwork.update).not.toHaveBeenCalled();
  });

  it('rejects updates to a missing artwork', async () => {
    prismaMock.artwork.findUnique.mockResolvedValue(null);

    await expect(
      updateArtwork(OWNER_ID, 'missing-id', { title: 'New title' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('updates an artwork owned by the caller', async () => {
    prismaMock.artwork.findUnique.mockResolvedValue(makeArtwork());
    prismaMock.artwork.update.mockResolvedValue(makeArtwork({ title: 'New title' }));

    const updated = await updateArtwork(OWNER_ID, ARTWORK_ID, { title: 'New title' });

    expect(updated.title).toBe('New title');
    expect(prismaMock.artwork.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ARTWORK_ID } }),
    );
  });
});

describe('getArtworkById', () => {
  it('throws NOT_FOUND for a missing artwork', async () => {
    prismaMock.artwork.findUnique.mockResolvedValue(null);

    await expect(getArtworkById('missing-id')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns the artwork when found', async () => {
    prismaMock.artwork.findUnique.mockResolvedValue(makeArtwork());

    const artwork = await getArtworkById(ARTWORK_ID);

    expect(artwork.id).toBe(ARTWORK_ID);
  });
});

describe('setArtworkPublished — publishing workflow', () => {
  it('rejects publishing an artwork with no media', async () => {
    prismaMock.artwork.findUnique.mockResolvedValue(makeArtwork({ published: false }));
    prismaMock.artworkMedia.count.mockResolvedValue(0);

    await expect(setArtworkPublished(OWNER_ID, ARTWORK_ID, true)).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(setArtworkPublished(OWNER_ID, ARTWORK_ID, true)).rejects.toMatchObject({
      code: 'UNPROCESSABLE_ENTITY',
    });
    expect(prismaMock.artwork.update).not.toHaveBeenCalled();
  });

  it('publishes an artwork that has at least one media record', async () => {
    prismaMock.artwork.findUnique.mockResolvedValue(makeArtwork({ published: false }));
    prismaMock.artworkMedia.count.mockResolvedValue(1);
    prismaMock.artwork.update.mockResolvedValue(makeArtwork({ published: true }));

    const result = await setArtworkPublished(OWNER_ID, ARTWORK_ID, true);

    expect(result.published).toBe(true);
  });

  it('allows unpublishing regardless of media count', async () => {
    prismaMock.artwork.findUnique.mockResolvedValue(makeArtwork({ published: true }));
    prismaMock.artwork.update.mockResolvedValue(makeArtwork({ published: false }));

    await setArtworkPublished(OWNER_ID, ARTWORK_ID, false);

    expect(prismaMock.artworkMedia.count).not.toHaveBeenCalled();
    expect(prismaMock.artwork.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { published: false } }),
    );
  });

  it('rejects publishing by a non-owner', async () => {
    prismaMock.artwork.findUnique.mockResolvedValue(makeArtwork({ userId: OWNER_ID }));

    await expect(
      setArtworkPublished(OTHER_USER_ID, ARTWORK_ID, true),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('deleteArtwork', () => {
  it('rejects deleting a missing artwork', async () => {
    prismaMock.artwork.findUnique.mockResolvedValue(null);

    await expect(deleteArtwork(OWNER_ID, 'missing-id')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects deleting an artwork owned by someone else', async () => {
    prismaMock.artwork.findUnique.mockResolvedValue(makeArtwork({ userId: OWNER_ID }));

    await expect(deleteArtwork(OTHER_USER_ID, ARTWORK_ID)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prismaMock.artwork.delete).not.toHaveBeenCalled();
  });

  it('deletes an artwork owned by the caller', async () => {
    prismaMock.artwork.findUnique.mockResolvedValue(makeArtwork());
    prismaMock.artwork.delete.mockResolvedValue(makeArtwork());

    await deleteArtwork(OWNER_ID, ARTWORK_ID);

    expect(prismaMock.artwork.delete).toHaveBeenCalledWith({ where: { id: ARTWORK_ID } });
  });
});
