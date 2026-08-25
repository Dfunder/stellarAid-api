import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { DiscoverController } from './discover.controller';
import { DiscoverService } from './discover.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [DiscoverController],
  providers: [DiscoverService],
})
export class DiscoverModule {}