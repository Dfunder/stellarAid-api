/**
 * Artwork view-count tracking.
 *
 * Stored in Redis, not the database — an async, debounced counter
 * increment, not a durable analytics record. Debounced to once per user
 * per artwork per hour, matching the "recently viewed" debounce window
 * used elsewhere in this API for the same kind of signal.
 */

import { getRedisClient } from './redis.service';

const DEBOUNCE_TTL_SECONDS = 60 * 60;

function debounceKey(userId: string, artworkId: string): string {
  return `view:debounce:${userId}:${artworkId}`;
}

function viewCountKey(artworkId: string): string {
  return `view:count:${artworkId}`;
}

export interface RecordViewResult {
  readonly recorded: boolean;
}

/** Increments the artwork's view counter unless the same user viewed it
 * within the last hour, in which case it's a silent no-op. */
export async function recordArtworkView(
  userId: string,
  artworkId: string,
): Promise<RecordViewResult> {
  const redis = getRedisClient();
  const wasSet = await redis.set(
    debounceKey(userId, artworkId),
    '1',
    'EX',
    DEBOUNCE_TTL_SECONDS,
    'NX',
  );
  if (wasSet === null) {
    return { recorded: false };
  }

  await redis.incr(viewCountKey(artworkId));
  return { recorded: true };
}

export async function getArtworkViewCount(artworkId: string): Promise<number> {
  const redis = getRedisClient();
  const raw = await redis.get(viewCountKey(artworkId));
  return raw === null ? 0 : Number.parseInt(raw, 10);
}
