import { Controller, Get, Query, Patch, Param, Body, UseGuards, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AuditService } from './audit.service';
import { GetAuditLogsDto } from './dto/get-audit-logs.dto';
import { GetUsersDto } from './dto/get-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { VerifyArtistDto } from './dto/verify-artist.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { Role, CommissionStatus } from '@prisma/client';

import { PaymentsService } from '../payments/payments.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private auditService: AuditService,
    private paymentsService: PaymentsService
  ) {}

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

  @Get('users')
  @Roles(Role.ADMIN)
  async getUsers(@Query() getUsersDto: GetUsersDto) {
    const { search, role, status, page, limit } = getUsersDto;
    
    const filters = {
      search,
      role,
      status,
    };

    return this.auditService.getUsers(filters, page, limit);
  }

  @Patch('users/:id/status')
  @Roles(Role.ADMIN)
  async updateUserStatus(
    @Param('id') id: string,
    @Body() updateUserStatusDto: UpdateUserStatusDto,
  ) {
    return this.auditService.updateUserStatus(id, updateUserStatusDto.status);
  }

  @Get('artists/pending-verification')
  @Roles(Role.ADMIN)
  async getPendingVerificationArtists(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.getPendingVerificationArtists(page, limit);
  }

  @Patch('artists/:id/verify')
  @Roles(Role.ADMIN)
  async verifyArtist(
    @Param('id') id: string,
    @Body() verifyArtistDto: VerifyArtistDto,
  ) {
    return this.auditService.verifyArtist(id, verifyArtistDto.isVerified);
  }

  @Get('commissions')
  @Roles(Role.ADMIN)
  async getAdminCommissions(
    @Query('status') status?: CommissionStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.getAllCommissions(status, page, limit);
  }

  @Get('commissions/disputed')
  @Roles(Role.ADMIN)
  async getDisputedCommissions(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.getAllCommissions(CommissionStatus.DISPUTED, page, limit);
  }

  @Post('commissions/:id/resolve-dispute')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async resolveCommissionDispute(
    @Param('id') id: string,
    @Body() resolveDisputeDto: ResolveDisputeDto,
  ) {
    return this.paymentsService.resolveDispute(id, resolveDisputeDto);
  }

  @Get('analytics')
  @Roles(Role.ADMIN)
  async getAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.auditService.getAnalytics(fromDate, toDate);
  }
}