import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PrismaModule, PaymentsModule],
  providers: [AuditService],
  controllers: [AdminController],
  exports: [AuditService],
})
export class AuditModule {}