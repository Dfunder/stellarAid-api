import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { CachingService } from './caching.service';

@Module({
  imports: [RedisModule],
  providers: [CachingService],
  exports: [CachingService],
})
export class CachingModule {}
