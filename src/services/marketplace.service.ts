/**
 * Trending and recommended artwork surfaces.
 *
 * Both rank by the same weighted trending score (see `trending.service`)
 * and are cached for 5 minutes — "trending results update within 5 minutes
 * of activity" is satisfied by that TTL rather than by pushing updates on
 * every signal. `recommended` is popularity-based at MVP (identical
 * ranking to trending, just a separate cached slot) per the issue's own
 * "personalized (or popularity-based at MVP)" scoping — there's no user
 * interaction history modeled yet to personalize against.
 */

import type { Artwork } from '@prisma/client';

import { prisma } from '@/services';

import { cached } from './cache.service';
import { getTopTrendingArtworkIds } from './trending.service';

const TRENDING_LIMIT = 20;
const RECOMMENDED_LIMIT = 20;
const RANKING_CACHE_TTL_SECONDS = 5 * 60;

async function listFeaturedArtworks(limit: number): Promise<readonly Artwork[]> {
  return prisma.artwork.findMany({
    where: { published: true, sold: false },
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
  });
}

async function rankedByTrendingScore(limit: number): Promise<readonly Artwork[]> {
  const ids = await getTopTrendingArtworkIds(limit);
  if (ids.length === 0) {
    return listFeaturedArtworks(limit);
  }

  const artworks = await prisma.artwork.findMany({
    where: { id: { in: [...ids] }, published: true, sold: false },
  });
  const byId = new Map(artworks.map((artwork) => [artwork.id, artwork]));

  return ids.map((id) => byId.get(id)).filter((artwork): artwork is Artwork => artwork !== undefined);
}

/** Top 20 trending artworks, weighted by recent views/saves/purchases. */
export async function getTrendingArtworks(): Promise<readonly Artwork[]> {
  return cached('marketplace:trending', RANKING_CACHE_TTL_SECONDS, () =>
    rankedByTrendingScore(TRENDING_LIMIT),
  );
}

/** Popularity-based recommendations (MVP — see file doc comment). */
export async function getRecommendedArtworks(): Promise<readonly Artwork[]> {
  return cached('marketplace:recommended', RANKING_CACHE_TTL_SECONDS, () =>
    rankedByTrendingScore(RECOMMENDED_LIMIT),
  );
}
