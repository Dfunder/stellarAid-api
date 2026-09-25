/**
 * Shared Redis client for features that need Redis directly (as opposed to
 * the rate limiter's own dedicated client).
 */

import { Redis } from 'ioredis';

import { env } from '@/config';

let client: Redis | undefined;

/** Returns `undefined` when `REDIS_URL` isn't configured — callers degrade
 * to their non-cached behavior rather than fail. */
export function tryGetRedisClient(): Redis | undefined {
  if (env.redisUrl === undefined) {
    return undefined;
  }
  if (client === undefined) {
    client = new Redis(env.redisUrl, { maxRetriesPerRequest: 2 });
  }
  return client;
}
