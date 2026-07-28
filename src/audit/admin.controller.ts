import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { GetAuditLogsDto } from './dto/get-audit-logs.dto';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { Role } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private auditService: AuditService) {}

  @Get('audit-logs')
  @Roles(Role.ADMIN)
  async getAuditLogs(@Query() getAuditLogsDto: GetAuditLogsDto) {
    const { userId, action, startDate, endDate, page, limit } = getAuditLogsDto;
    
    const filters = {
      userId,
      action,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    return this.auditService.getAuditLogs(filters, page, limit);
  }
}