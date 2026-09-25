/**
 * Rate limiting middleware.
 *
 * Protects public endpoints from abuse. Each limiter uses its own in-memory
 * store when no Redis is configured; when `REDIS_URL` is set, a Redis-backed
 * store is used so limits are enforced consistently across multiple
 * instances.
 *
 * Limits:
 * - Global: 100 requests/minute against every route.
 * - Auth:   10 requests/minute.
 * - Password reset: 3 requests/minute.
 *
 * Rate-limit headers (`RateLimit-Limit`, `RateLimit-Remaining`,
 * `RateLimit-Reset`) are present on every response, and over-limit requests
 * get `429` with a `Retry-After` header.
 *
 * Store: each limiter owns its own MemoryStore instance (express-rate-limit
 * forbids sharing one store across limiters). When `REDIS_URL` is set, a
 * single Redis-backed store is used so limits are consistent across
 * instances.
 */

import { Redis } from 'ioredis';
import rateLimit, {
  ipKeyGenerator,
  MemoryStore,
  type Options,
  type RateLimitRequestHandler,
} from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { env } from '@/config';
import { logger } from '@/utils';

let redisClient: Redis | undefined;
let redisStore: RedisStore | undefined;

function getRedisStore(): RedisStore | undefined {
  if (env.redisUrl === undefined) {
    return undefined;
  }
  if (redisStore === undefined) {
    redisClient = new Redis(env.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
    const sendCommand = (...args: string[]): Promise<RedisReply> => {
      const command = args[0] ?? '';
      const rest = args.slice(1);
      return redisClient!.call(command, ...rest) as Promise<RedisReply>;
    };
    redisStore = new RedisStore({ sendCommand });
    redisClient.on('error', (error) => {
      logger.warn('Redis store unavailable, falling back to shared memory store', {
        message: error.message,
      });
    });
  }
  return redisStore;
}

function createRateLimiter(options: {
  name: string;
  windowMs: number;
  limit: number;
  message: string;
}): RateLimitRequestHandler {
  const base: Partial<Options> = {
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown'),
    handler: (_req, res) => {
      const retryAfter = Math.ceil(options.windowMs / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: options.message },
      });
    },
    skip: (_req) => _req.method === 'OPTIONS' || _req.path === '/api/docs',
  };
  // Each limiter needs its own store: express-rate-limit refuses to share a
  // Store instance across limiters (ERR_ERL_STORE_REUSE). Falls back to a
  // fresh per-limiter MemoryStore when no Redis is configured.
  const store = getRedisStore() ?? new MemoryStore();
  return rateLimit({ ...base, store });
}

const ONE_MINUTE = 60 * 1000;

/** 100 requests/minute across the whole API. */
export const globalLimiter: RateLimitRequestHandler = createRateLimiter({
  name: 'global',
  windowMs: ONE_MINUTE,
  limit: 100,
  message: 'Too many requests. Please try again later.',
});

/** 10 requests/minute on authentication endpoints. */
export const authLimiter: RateLimitRequestHandler = createRateLimiter({
  name: 'auth',
  windowMs: ONE_MINUTE,
  limit: 10,
  message: 'Too many authentication attempts. Please try again later.',
});

/** 3 requests/minute on password reset. */
export const passwordResetLimiter: RateLimitRequestHandler = createRateLimiter({
  name: 'password-reset',
  windowMs: ONE_MINUTE,
  limit: 3,
  message: 'Too many password reset attempts. Please try again later.',
});

/** 30 requests/minute on analytics event ingestion (batches, not single events). */
export const analyticsLimiter: RateLimitRequestHandler = createRateLimiter({
  name: 'analytics',
  windowMs: ONE_MINUTE,
  limit: 30,
  message: 'Too many analytics requests. Please try again later.',
});
