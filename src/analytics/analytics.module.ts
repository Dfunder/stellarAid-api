import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AnalyticsController } from './analytics.controller';
import { PortfolioAnalyticsService } from './portfolio-analytics.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [AnalyticsController],
  providers: [PortfolioAnalyticsService],
  exports: [PortfolioAnalyticsService],
})
export class AnalyticsModule {}
