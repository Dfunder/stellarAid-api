import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

@Module({
  imports: [PrismaModule],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
