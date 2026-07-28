import { Module } from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { CommissionsController } from './commissions.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CommissionsController],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
