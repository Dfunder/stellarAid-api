import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CachingModule } from '../caching/caching.module';

@Module({
  imports: [PrismaModule, CachingModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
