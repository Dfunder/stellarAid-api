import { Module } from '@nestjs/common';
import { redisClientFactory } from 'src/config/redis.config';

@Module({
  providers: [redisClientFactory],
  exports: ['RedisClient'],
})
export class RedisModule {}
