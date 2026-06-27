import {
  Controller,
  Post,
  Patch,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { SuspendCampaignDto } from './dtos/suspend-campaign.dto';
import { RejectCampaignDto } from './dtos/reject-campaign.dto';
import { FileDisputeDto } from './dtos/file-dispute.dto';
import { SuspendUserDto } from './dtos/suspend-user.dto';
import { ListDisputesDto } from './dtos/list-disputes.dto';
import { ResolveDisputeDto } from './dtos/resolve-dispute.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('campaigns/:id/suspend')
  suspendCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendCampaignDto,
    @Request() req,
  ) {
    return this.adminService.suspendCampaign(id, dto, req.user.sub, req.user.email);
  }

  @Post('campaigns/:id/approve')
  async approveCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    return this.adminService.approveCampaign(id, req.user.sub);
  }

  @Post('campaigns/:id/reject')
  async rejectCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectCampaignDto,
    @Request() req,
  ) {
    return this.adminService.rejectCampaign(id, dto, req.user.sub);
  }

  @Get('stats')
  async getPlatformStats(
    @Query('range') range: '7d' | '30d' | '90d' | 'all' = 'all',
  ) {
    return this.adminService.getPlatformStats(range);
  }

  @Get('audit-log')
  async getAuditLog(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('action') action?: string,
    @Query('adminId') adminId?: string,
  ) {
    return this.adminService.getAuditLog(page, limit, action, adminId);
  }
}

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  async fileDispute(@Request() req, @Body() dto: FileDisputeDto) {
    return this.adminService.fileDispute(req.user.sub, dto);
  // ── Issue #308 ───────────────────────────────────────────────────────────
  }
  
  @Patch('users/:id/suspend')
  suspendUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendUserDto,
    @Request() req,
  ) {
    return this.adminService.suspendUser(id, dto, req.user.sub);
  }

  @Patch('users/:id/unsuspend')
  unsuspendUser(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.adminService.unsuspendUser(id, req.user.sub);
  }

  // ── Issue #303 ───────────────────────────────────────────────────────────

  @Get('disputes')
  listDisputes(@Query() query: ListDisputesDto) {
    return this.adminService.listDisputes(query);
  }

  // ── Issue #304 ───────────────────────────────────────────────────────────

  @Patch('disputes/:id')
  resolveDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveDisputeDto,
    @Request() req,
  ) {
    return this.adminService.resolveDispute(id, dto, req.user.sub);
  }
}
