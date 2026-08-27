import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PaginationController } from './pagination.controller';
import { PaginationService } from './pagination.service';

@Module({
  imports: [PrismaModule],
  controllers: [PaginationController],
  providers: [PaginationService],
  exports: [PaginationService],
})
export class PaginationModule {}
