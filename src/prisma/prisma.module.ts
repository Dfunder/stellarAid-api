import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { QueryLogger } from './query-logger';

@Module({
  providers: [PrismaService, QueryLogger],
  exports: [PrismaService],
})
export class PrismaModule {}
