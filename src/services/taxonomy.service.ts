/**
 * Category and tag taxonomy service.
 *
 * Categories are a one-level tree (parent → children). Tags are a flat,
 * shared vocabulary; artwork tag assignments live on `Artwork.tags` (JSON)
 * rather than a join table, so "sync" just rewrites that array — a tag
 * being referenced there doesn't require a row in the `Tag` table, but
 * `syncArtworkTags` creates one for any name that doesn't already exist so
 * the shared vocabulary stays populated from real usage.
 */

import { AppError } from '@/middlewares';
import { prisma } from '@/services';
import { slugify } from '@/utils';

export interface CategoryNode {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly children: readonly CategoryNode[];
}

export interface TagRecord {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

/** All categories, nested one level (parent → children). */
export async function listCategories(): Promise<CategoryNode[]> {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  const byParent = new Map<string, typeof categories>();
  for (const category of categories) {
    const key = category.parentId ?? '';
    const bucket = byParent.get(key) ?? [];
    bucket.push(category);
    byParent.set(key, bucket);
  }

  function toNode(category: (typeof categories)[number]): CategoryNode {
    const children = byParent.get(category.id) ?? [];
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      children: children.map(toNode),
    };
  }

  return (byParent.get('') ?? []).map(toNode);
}

/**
 * Most recently created/used tags first — a simple, dependency-free proxy
 * for "popular" given tag usage isn't tracked with a counter or a join
 * table (see module doc). A real ranking would need a usage-count column
 * updated from `syncArtworkTags`, which is a larger change left for a
 * follow-up.
 */
export async function listPopularTags(limit: number): Promise<TagRecord[]> {
  return prisma.tag.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
}

export async function createTag(name: string): Promise<TagRecord> {
  const slug = slugify(name);
  if (slug.length === 0) {
    throw new AppError('BAD_REQUEST', 'Tag name must contain at least one letter or digit.');
  }

  const existing = await prisma.tag.findUnique({ where: { slug } });
  if (existing !== null) {
    return existing;
  }

  try {
    return await prisma.tag.create({ data: { name, slug } });
  } catch {
    // Race: another request created the same tag between the check and
    // the insert. Return the now-existing row instead of erroring.
    const raced = await prisma.tag.findUnique({ where: { slug } });
    if (raced !== null) {
      return raced;
    }
    throw new AppError('INTERNAL_ERROR', 'Failed to create tag');
  }
}

/**
 * Replaces an artwork's tag list. Idempotent: syncing the same set twice
 * produces the same result. Any tag name not already in the `Tag` table is
 * created from this first use.
 */
export async function syncArtworkTags(
  userId: string,
  artworkId: string,
  tagNames: readonly string[],
): Promise<readonly string[]> {
  const artwork = await prisma.artwork.findUnique({ where: { id: artworkId } });
  if (artwork === null) {
    throw new AppError('NOT_FOUND', 'Artwork not found');
  }
  if (artwork.userId !== userId) {
    throw new AppError('FORBIDDEN', 'You do not own this artwork');
  }

  // De-duplicate case-insensitively while preserving the caller's casing
  // for the first occurrence of each name.
  const seen = new Set<string>();
  const uniqueNames: string[] = [];
  for (const name of tagNames) {
    const key = name.trim().toLowerCase();
    if (key.length > 0 && !seen.has(key)) {
      seen.add(key);
      uniqueNames.push(name.trim());
    }
  }

  await Promise.all(uniqueNames.map((name) => createTag(name)));

  await prisma.artwork.update({ where: { id: artworkId }, data: { tags: uniqueNames } });

  return uniqueNames;
}
