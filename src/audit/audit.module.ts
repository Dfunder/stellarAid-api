import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AuditService],
  controllers: [AdminController],
  exports: [AuditService],
})
export class AuditModule {}