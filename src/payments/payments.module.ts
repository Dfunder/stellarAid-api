import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { StellarService } from './stellar.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentVerificationService } from './payment-verification.service';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, StellarService, PaymentVerificationService],
  exports: [PaymentsService, StellarService],
})
export class PaymentsModule {}
