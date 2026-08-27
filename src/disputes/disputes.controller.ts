import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import {
  AddEvidenceDto,
  AppealDisputeDto,
  FileDisputeDto,
  QueryDisputeDto,
  RejectDisputeDto,
  ResolveDisputeDto,
} from './dto/dispute.dto';
import { DisputesService } from './disputes.service';

interface AuthUser {
  sub: string;
  role: string;
}

@ApiTags('disputes')
@Controller({ version: '1', path: 'disputes' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'File a dispute for a commission' })
  async file(@CurrentUser() user: AuthUser, @Body() dto: FileDisputeDto) {
    return this.disputesService.file(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List disputes (own, or all for admins)' })
  async list(@CurrentUser() user: AuthUser, @Query() query: QueryDisputeDto) {
    return this.disputesService.list(user.sub, user.role === Role.ADMIN, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a dispute' })
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.disputesService.findOne(user.sub, user.role === Role.ADMIN, id);
  }

  @Patch(':id/evidence')
  @ApiOperation({ summary: 'Attach evidence to a dispute' })
  async addEvidence(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddEvidenceDto,
  ) {
    return this.disputesService.addEvidence(user.sub, id, dto.evidence);
  }

  @Patch(':id/appeal')
  @ApiOperation({ summary: 'Appeal a resolved dispute' })
  async appeal(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AppealDisputeDto,
  ) {
    return this.disputesService.appeal(user.sub, id, dto.note);
  }

  // --- Admin review workflow ----------------------------------------------

  @Patch(':id/review')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Mark a dispute under review (admin)' })
  async review(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.disputesService.review(user.sub, id);
  }

  @Patch(':id/resolve')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Resolve a dispute with an outcome (admin)' })
  async resolve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputesService.resolve(user.sub, id, dto.resolution, dto.note);
  }

  @Patch(':id/reject')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reject a dispute (admin)' })
  async reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RejectDisputeDto,
  ) {
    return this.disputesService.reject(user.sub, id, dto.note);
  }

  @Post('auto-resolve')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Auto-resolve timed-out disputes (admin/cron)' })
  async autoResolve() {
    return this.disputesService.autoResolveTimeouts();
  }
}
