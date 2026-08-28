import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheInvalidationService } from './cache-invalidation.service';

@Module({
  imports: [
    CacheModule.register({
      ttl: 300_000, // 5 min default
      max: 1000,
    }),
  ],
  providers: [CacheInvalidationService],
  exports: [CacheInvalidationService, CacheModule],
})
export class AppCacheModule {}
