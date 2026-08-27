import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommissionRequestsController } from './commission-requests.controller';
import { CommissionRequestsService } from './commission-requests.service';

@Module({
  imports: [PrismaModule],
  controllers: [CommissionRequestsController],
  providers: [CommissionRequestsService],
  exports: [CommissionRequestsService],
})
export class CommissionRequestsModule {}
