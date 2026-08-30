import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import Redis from 'ioredis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { CommissionsModule } from './commissions/commissions.module';
import { PaymentsModule } from './payments/payments.module';
import { WalletModule } from './wallet/wallet.module';
import { SearchModule } from './search/search.module';
import { DiscoverModule } from './discover/discover.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { QueryModule } from './common/query/query.module';
import { VersioningModule } from './versioning/versioning.module';
import { ProjectsModule } from './projects/projects.module';
import { ServiceCategoriesModule } from './service-categories/service-categories.module';
import { PromotionsModule } from './promotions/promotions.module';
import { PaginationModule } from './common/pagination/pagination.module';
import { CatalogModule } from './catalog/catalog.module';
import { FavoritesModule } from './favorites/favorites.module';
import { CommissionRequestsModule } from './commission-requests/commission-requests.module';
import { ProfileModule } from './profile/profile.module';
import { CachingModule } from './caching/caching.module';
import { DisputesModule } from './disputes/disputes.module';
import { EscrowModule } from './escrow/escrow.module';
import { VerificationModule } from './verification/verification.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { ReviewsModule } from './reviews/reviews.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';

import { HealthController } from './health/health.controller';
import { RedisThrottlerStorage } from './common/throttling/redis-throttler.storage';
import { decodeJwt } from './common/throttling/rate-limit.decorator';
import { RequestLoggerInterceptor } from './common/logging/request-logger.interceptor';
import { ETagInterceptor } from './common/http/etag.interceptor';
import { ApiResponseInterceptor } from './common/http/api-response.interceptor';
import { BatchModule } from './batch/batch.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: ['RedisClient'],
      useFactory: (redis: Redis) => ({
        throttlers: [{ ttl: 60000, limit: 100 }],
        storage: new RedisThrottlerStorage(redis),
        getTracker: (req) => {
          const user = req.user as { sub?: string } | undefined;
          const headers = req.headers as { authorization?: string } | undefined;
          return (
            user?.sub ??
            decodeJwt(headers?.authorization)?.sub ??
            (req.ip as string)
          );
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    AuditModule,
    MarketplaceModule,
    CommissionsModule,
    PaymentsModule,
    WalletModule,
    SearchModule,
    DiscoverModule,
    AnalyticsModule,
    QueryModule,
    VersioningModule,
    ProjectsModule,
    ServiceCategoriesModule,
    PromotionsModule,
    PaginationModule,
    CatalogModule,
    FavoritesModule,
    CommissionRequestsModule,
    ProfileModule,
    DisputesModule,
    EscrowModule,
    VerificationModule,
    PortfolioModule,
    ReviewsModule,
    MessagingModule,
    NotificationsModule,
    BatchModule,
    WebhooksModule,
    CachingModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ETagInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
  ],
})
export class AppModule {}
