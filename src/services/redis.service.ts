/**
 * Shared Redis client for features that need Redis directly (as opposed to
 * the rate limiter's own dedicated client, or BullMQ's own connections).
 */

import type { ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';

import { env } from '@/config';
import { AppError } from '@/middlewares';

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

/** Throws if `REDIS_URL` isn't configured — callers use this for features
 * that require Redis (not ones with a DB/memory fallback). */
export function getRedisClient(): Redis {
  const existing = tryGetRedisClient();
  if (existing === undefined) {
    throw new AppError('INTERNAL_ERROR', 'Redis is not configured (REDIS_URL missing).');
  }
  return existing;
}

/**
 * Connection for BullMQ queues and workers.
 *
 * Always a fresh client: BullMQ requires `maxRetriesPerRequest: null` on its
 * own connection, which the shared client above deliberately doesn't set.
 *
 * BullMQ bundles its own ioredis major (5.x) while this project depends on
 * ioredis 6.x, so the two `Redis` classes are distinct types to the compiler
 * even though they are the same object at runtime — hence the cast.
 */
export function createBullConnection(): ConnectionOptions {
  const url = env.redisUrl;
  if (url === undefined) {
    throw new AppError('INTERNAL_ERROR', 'Redis is not configured (REDIS_URL missing).');
  }
  return new Redis(url, { maxRetriesPerRequest: null }) as unknown as ConnectionOptions;
}
