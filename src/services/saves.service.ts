/**
 * Artwork save/unsave (bookmarking) and the caller's saved-artwork list.
 */

import { AppError } from '@/middlewares';
import { prisma } from '@/services';

import { recordTrendingSignal } from './trending.service';

export interface ToggleSaveResult {
  readonly saved: boolean;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly limit: number;
  readonly total: number;
}

export interface SavedArtworkSummary {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly coverMediaId: string | null;
  readonly savedAt: Date;
}

async function assertArtworkExists(artworkId: string): Promise<void> {
  const artwork = await prisma.artwork.findUnique({
    where: { id: artworkId },
    select: { id: true },
  });
  if (artwork === null) {
    throw new AppError('NOT_FOUND', 'Artwork not found');
  }
}

/** Creates the save if it doesn't exist, deletes it if it does. */
export async function toggleArtworkSave(
  userId: string,
  artworkId: string,
): Promise<ToggleSaveResult> {
  await assertArtworkExists(artworkId);

  const existing = await prisma.save.findUnique({
    where: { userId_artworkId: { userId, artworkId } },
  });

  if (existing !== null) {
    await prisma.save.delete({ where: { id: existing.id } });
    return { saved: false };
  }

  await prisma.save.create({ data: { userId, artworkId } });
  await recordTrendingSignal(artworkId, 'save');
  return { saved: true };
}

export async function isArtworkSaved(userId: string, artworkId: string): Promise<boolean> {
  const existing = await prisma.save.findUnique({
    where: { userId_artworkId: { userId, artworkId } },
  });
  return existing !== null;
}

/** Caller's saved artworks, most recently saved first. */
export async function listSavedArtworks(
  userId: string,
  page: number,
  limit: number,
): Promise<PaginatedResult<SavedArtworkSummary>> {
  const [saves, total] = await Promise.all([
    prisma.save.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { artwork: true },
    }),
    prisma.save.count({ where: { userId } }),
  ]);

  return {
    items: saves.map((save) => ({
      id: save.artwork.id,
      title: save.artwork.title,
      category: save.artwork.category,
      coverMediaId: save.artwork.coverMediaId,
      savedAt: save.createdAt,
    })),
    page,
    limit,
    total,
  };
}
