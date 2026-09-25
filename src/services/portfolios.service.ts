/**
 * Portfolio item CRUD and ordering service.
 *
 * Portfolio items are a showcase (not for sale) — see `Artwork` for the
 * for-sale counterpart. `order` is a plain integer position, reordered by
 * passing the full ordered id list for the owner's items.
 */

import type { PortfolioItem } from '@prisma/client';

import { AppError } from '@/middlewares';
import { prisma } from '@/services';

export interface CreatePortfolioItemInput {
  readonly title: string;
  readonly description?: string;
  readonly tags?: readonly string[];
}

export interface UpdatePortfolioItemInput {
  readonly title?: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly published?: boolean;
}

async function findOwnedItem(userId: string, itemId: string): Promise<PortfolioItem> {
  const item = await prisma.portfolioItem.findUnique({ where: { id: itemId } });
  if (item === null) {
    throw new AppError('NOT_FOUND', 'Portfolio item not found');
  }
  if (item.userId !== userId) {
    throw new AppError('FORBIDDEN', 'You do not own this portfolio item');
  }
  return item;
}

/** New items are appended after the caller's current highest `order`. */
export async function createPortfolioItem(
  userId: string,
  input: CreatePortfolioItemInput,
): Promise<PortfolioItem> {
  const highest = await prisma.portfolioItem.findFirst({
    where: { userId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });

  return prisma.portfolioItem.create({
    data: {
      userId,
      title: input.title,
      description: input.description,
      tags: input.tags ?? undefined,
      order: (highest?.order ?? -1) + 1,
    },
  });
}

export async function updatePortfolioItem(
  userId: string,
  itemId: string,
  input: UpdatePortfolioItemInput,
): Promise<PortfolioItem> {
  await findOwnedItem(userId, itemId);
  return prisma.portfolioItem.update({
    where: { id: itemId },
    data: {
      title: input.title,
      description: input.description,
      tags: input.tags === undefined ? undefined : input.tags,
      published: input.published,
    },
  });
}

export async function deletePortfolioItem(userId: string, itemId: string): Promise<void> {
  await findOwnedItem(userId, itemId);
  await prisma.portfolioItem.delete({ where: { id: itemId } });
}

export async function listPortfolioItems(userId: string): Promise<readonly PortfolioItem[]> {
  return prisma.portfolioItem.findMany({ where: { userId }, orderBy: { order: 'asc' } });
}

/**
 * Reassigns `order` to match the given id sequence. Every id must already
 * belong to the caller — anything else (missing id, id owned by someone
 * else) rejects the whole reorder rather than applying it partially.
 */
export async function reorderPortfolioItems(
  userId: string,
  orderedIds: readonly string[],
): Promise<readonly PortfolioItem[]> {
  const owned = await prisma.portfolioItem.findMany({ where: { userId } });
  const ownedIds = new Set(owned.map((item) => item.id));

  if (orderedIds.length !== owned.length || !orderedIds.every((id) => ownedIds.has(id))) {
    throw new AppError(
      'BAD_REQUEST',
      'orderedIds must contain exactly the caller\'s portfolio item ids.',
    );
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.portfolioItem.update({ where: { id }, data: { order: index } }),
    ),
  );

  return listPortfolioItems(userId);
}
