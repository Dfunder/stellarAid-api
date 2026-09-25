/**
 * Cached lookups for slow-changing reference data: the category taxonomy
 * and artist profiles. Both are read far more often than they change, so a
 * 5-minute cache-aside TTL is a reasonable staleness budget.
 */

import type { ArtistProfile, Category } from '@prisma/client';

import { AppError } from '@/middlewares';
import { prisma } from '@/services';

import { cached } from './cache.service';

const CATEGORY_CACHE_TTL_SECONDS = 5 * 60;
const ARTIST_PROFILE_CACHE_TTL_SECONDS = 5 * 60;

export interface CategoryNode extends Category {
  readonly children: Category[];
}

/** One level of nesting: top-level categories with their direct children. */
export async function listCategories(): Promise<readonly CategoryNode[]> {
  return cached('catalog:categories', CATEGORY_CACHE_TTL_SECONDS, async () => {
    const all = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    const byParent = new Map<string, Category[]>();
    for (const category of all) {
      if (category.parentId === null) {
        continue;
      }
      const siblings = byParent.get(category.parentId) ?? [];
      siblings.push(category);
      byParent.set(category.parentId, siblings);
    }
    return all
      .filter((category) => category.parentId === null)
      .map((category) => ({ ...category, children: byParent.get(category.id) ?? [] }));
  });
}

export async function getArtistProfileByUserId(userId: string): Promise<ArtistProfile> {
  return cached(`catalog:artist-profile:${userId}`, ARTIST_PROFILE_CACHE_TTL_SECONDS, async () => {
    const profile = await prisma.artistProfile.findUnique({ where: { userId } });
    if (profile === null) {
      throw new AppError('NOT_FOUND', 'Artist profile not found');
    }
    return profile;
  });
}
