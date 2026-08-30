import { Redis } from 'ioredis';

const PENDING_CACHE_TTL_SECONDS = 10;

export async function deduplicate<T>(
  redis: Redis,
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number,
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }

  const pendingKey = `${key}:pending`;
  if (await redis.get(pendingKey)) {
    // Another request is already processing this; wait for it to finish.
    await new Promise((resolve) => setTimeout(resolve, 100));
    return deduplicate(redis, key, fn, ttlSeconds);
  }

  await redis.set(pendingKey, '1', 'EX', PENDING_CACHE_TTL_SECONDS);

  try {
    const result = await fn();
    await redis.set(key, JSON.stringify(result), 'EX', ttlSeconds);
    return result;
  } finally {
    await redis.del(pendingKey);
  }
}
