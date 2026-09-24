/**
 * Artwork CRUD and publishing-workflow service.
 */

import type { Asset, ArtworkCategory } from '@prisma/client';

import { AppError } from '@/middlewares';
import { prisma } from '@/services';

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
