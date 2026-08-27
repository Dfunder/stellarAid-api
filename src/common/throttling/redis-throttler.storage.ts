import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { ThrottlerStorage } from '@nestjs/throttler';

/** Result shape of a throttler increment (not re-exported by @nestjs/throttler v6). */
type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage['increment']>
>;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(@Inject('RedisClient') private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const redisKey = `throttle:${throttlerName}:${key}`;
    const result = (await this.redis.eval(
      `local hits = redis.call('incr', KEYS[1])
       if hits == 1 then redis.call('pexpire', KEYS[1], ARGV[1]) end
       return { hits, redis.call('pttl', KEYS[1]) }`,
      1,
      redisKey,
      ttl,
    )) as [number, number];
    const totalHits = result[0];
    const timeToExpire = Math.max(0, result[1]);
    const isBlocked = totalHits > limit;

    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire: isBlocked ? blockDuration : 0,
    };
  }
}