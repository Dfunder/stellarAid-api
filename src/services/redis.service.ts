/**
 * Shared Redis client for features that need Redis directly (as opposed to
 * the rate limiter's own dedicated client).
 */

import { Redis } from 'ioredis';

import { env } from '@/config';
import { AppError } from '@/middlewares';

let client: Redis | undefined;

/** Throws if `REDIS_URL` isn't configured — callers use this for features
 * that require Redis (not ones with a DB/memory fallback). */
export function getRedisClient(): Redis {
  if (env.redisUrl === undefined) {
    throw new AppError('INTERNAL_ERROR', 'Redis is not configured (REDIS_URL missing).');
  }
  if (client === undefined) {
    client = new Redis(env.redisUrl, { maxRetriesPerRequest: 2 });
  }
  return client;
}
