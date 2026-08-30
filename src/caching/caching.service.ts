import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CachingService {
  constructor(@Inject('RedisClient') private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serializedValue = JSON.stringify(value);
    if (ttl) {
      await this.redis.set(key, serializedValue, 'EX', ttl);
    } else {
      await this.redis.set(key, serializedValue);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
