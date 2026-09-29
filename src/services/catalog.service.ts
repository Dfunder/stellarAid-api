/**
 * Cached lookups for slow-changing reference data. Artist profiles are read
 * far more often than they change, so a 5-minute cache-aside TTL is a
 * reasonable staleness budget. (The category taxonomy is owned by
 * `taxonomy.service`.)
 */

import type { ArtistProfile } from '@prisma/client';

import { AppError } from '@/middlewares';
import { prisma } from '@/services';

import { cached } from './cache.service';

const ARTIST_PROFILE_CACHE_TTL_SECONDS = 5 * 60;

export async function getArtistProfileByUserId(userId: string): Promise<ArtistProfile> {
  return cached(`catalog:artist-profile:${userId}`, ARTIST_PROFILE_CACHE_TTL_SECONDS, async () => {
    const profile = await prisma.artistProfile.findUnique({ where: { userId } });
    if (profile === null) {
      throw new AppError('NOT_FOUND', 'Artist profile not found');
    }
    return profile;
  });
}
