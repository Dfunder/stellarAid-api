import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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

import { HealthController } from './health/health.controller';
import { RedisThrottlerStorage } from './common/throttling/redis-throttler.storage';
import { decodeJwt } from './common/throttling/rate-limit.decorator';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: ['RedisClient'],
      useFactory: (redis: Redis) => ({
        throttlers: [{ ttl: 60000, limit: 100 }],
        storage: new RedisThrottlerStorage(redis),
        getTracker: (req) =>
          req.user?.sub || decodeJwt(req.headers.authorization)?.sub || req.ip,
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
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}