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
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import {
  QueryVerificationDto,
  RequestVerificationDto,
  ReviewVerificationDto,
} from './dto/verification.dto';
import { VerificationService } from './verification.service';

@ApiTags('verification')
@Controller({ version: '1', path: 'verification' })
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request verification (email/identity/portfolio)' })
  async request(
    @CurrentUser() user: { sub: string },
    @Body() dto: RequestVerificationDto,
  ) {
    return this.verificationService.request(user.sub, dto.type, dto.evidence);
  }

  @Get('requests/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @ApiOperation({ summary: 'List my verification requests' })
  async mine(@CurrentUser() user: { sub: string }) {
    return this.verificationService.listMine(user.sub);
  }

  @Post('requests/:id/renew')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Renew an approved verification' })
  async renew(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.verificationService.renew(user.sub, id);
  }

  @Get('requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List verification requests (admin)' })
  async list(@Query() query: QueryVerificationDto) {
    return this.verificationService.list(query);
  }

  @Patch('requests/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Approve a verification request (admin)' })
  async approve(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: ReviewVerificationDto,
  ) {
    return this.verificationService.approve(user.sub, id, dto.note);
  }

  @Patch('requests/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reject a verification request (admin)' })
  async reject(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: ReviewVerificationDto,
  ) {
    return this.verificationService.reject(user.sub, id, dto.note);
  }

  @Get('artists/:artistId/badges')
  @Public()
  @ApiOperation({ summary: 'Get an artist verification badges & trust score' })
  async badges(@Param('artistId') artistId: string) {
    return this.verificationService.badges(artistId);
  }

  @Get('artists/:artistId/trust-score')
  @Public()
  @ApiOperation({ summary: 'Recompute and return an artist trust score' })
  async trustScore(@Param('artistId') artistId: string) {
    return this.verificationService.getTrustScore(artistId);
  }
}
