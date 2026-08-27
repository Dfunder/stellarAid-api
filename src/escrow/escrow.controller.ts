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
import { CreateEscrowDto, EscrowActionDto } from './dto/escrow.dto';
import { EscrowService } from './escrow.service';

interface AuthUser {
  sub: string;
  role: string;
}

@ApiTags('escrow')
@Controller({ version: '1', path: 'escrow' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Hold funds in escrow for a commission (admin)' })
  async hold(@Body() dto: CreateEscrowDto) {
    return this.escrowService.hold(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List escrow holdings for a commission' })
  async list(
    @CurrentUser() user: AuthUser,
    @Query('commissionId') commissionId: string,
  ) {
    return this.escrowService.listForCommission(
      user.sub,
      user.role === Role.ADMIN,
      commissionId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an escrow holding with its audit trail' })
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.escrowService.findOne(user.sub, user.role === Role.ADMIN, id);
  }

  @Get(':id/audit-trail')
  @ApiOperation({ summary: 'Get the escrow audit trail' })
  async audit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.escrowService.auditTrail(
      user.sub,
      user.role === Role.ADMIN,
      id,
    );
  }

  @Patch(':id/release')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Release escrow to the artist (admin)' })
  async release(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: EscrowActionDto,
  ) {
    return this.escrowService.release(user.sub, id, dto.note, dto.txHash);
  }

  @Patch(':id/refund')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Refund escrow to the client (admin)' })
  async refund(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: EscrowActionDto,
  ) {
    return this.escrowService.refund(user.sub, id, dto.note, dto.txHash);
  }

  @Patch(':id/dispute-hold')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Freeze escrow pending dispute (admin)' })
  async disputeHold(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: EscrowActionDto,
  ) {
    return this.escrowService.disputeHold(user.sub, id, dto.note);
  }
}
