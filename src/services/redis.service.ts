/**
 * Shared Redis client for features that need Redis directly (as opposed to
 * the rate limiter's own dedicated client).
 * the rate limiter's own dedicated client, or BullMQ's own connections).
 */

import { Redis } from 'ioredis';

import { env } from '@/config';

let client: Redis | undefined;

/** Returns `undefined` when `REDIS_URL` isn't configured — callers degrade
 * to their non-cached behavior rather than fail. */
export function tryGetRedisClient(): Redis | undefined {
  if (env.redisUrl === undefined) {
    return undefined;
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
