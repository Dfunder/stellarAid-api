/**
 * Artwork save/unsave (bookmarking).
 */

import { AppError } from '@/middlewares';
import { prisma } from '@/services';

import { recordTrendingSignal } from './trending.service';

export interface ToggleSaveResult {
  readonly saved: boolean;
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
export async function toggleArtworkSave(userId: string, artworkId: string): Promise<ToggleSaveResult> {
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
