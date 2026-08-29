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
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import { CommissionsService } from './commissions.service';
import { CreateCommissionDto } from './dto/create-commission.dto';
import { RoleRateLimit } from '../common/throttling/rate-limit.decorator';
import { SubmitCommissionDto } from './dto/submit-revision.dto';
import { CommissionResponse, CommissionsResponse } from './ro/commissions.ro';

@ApiTags('commissions')
@Controller({ version: '1', path: 'commissions' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Post()
  @Roles(Role.CLIENT)
  @RoleRateLimit({
    ttl: 60000,
    limits: { [Role.CLIENT]: 20, [Role.BUSINESS]: 30 },
    defaultLimit: 10,
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a commission request (client only)' })
  @ApiBody({
    type: CreateCommissionDto,
    examples: {
      a: {
        summary: 'Create a new commission',
        value: {
          artistId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          serviceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          title: 'New Commission',
          description: 'This is a new commission',
          budget: 100,
          deadline: '2022-12-31T23:59:59.999Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Commission created',
    type: CommissionResponse,
  })
  @ApiResponse({ status: 403, description: 'Not a client' })
  @ApiResponse({ status: 404, description: 'Artist not found' })
  async create(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateCommissionDto,
  ) {
    return this.commissionsService.create(user.sub, dto);
  }

  @Patch(':id/accept')
  @Roles(Role.ARTIST)
  @ApiOperation({ summary: 'Accept a commission (artist only)' })
  @ApiResponse({
    status: 200,
    description: 'Commission accepted',
    type: CommissionResponse,
  })
  async accept(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.commissionsService.accept(id, user.sub);
  }

  @Patch(':id/submit')
  @Roles(Role.ARTIST)
  @ApiOperation({ summary: 'Submit a commission for review (artist only)' })
  @ApiBody({
    type: SubmitCommissionDto,
    examples: {
      a: {
        summary: 'Submit a commission for review',
        value: {
          url: 'https://example.com/submission.zip',
          notes: 'Here is the first draft.',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Commission submitted',
    type: CommissionResponse,
  })
  async submit(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: SubmitCommissionDto,
  ) {
    return this.commissionsService.submit(id, user.sub, dto);
  }

  @Patch(':id/approve')
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Approve a commission (client only)' })
  @ApiResponse({
    status: 200,
    description: 'Commission approved',
    type: CommissionResponse,
  })
  async approve(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.commissionsService.approve(id, user.sub);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List own commissions' })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiResponse({
    status: 200,
    description: 'List of commissions',
    type: CommissionsResponse,
  })
  async findAll(
    @CurrentUser() user: { sub: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.commissionsService.findAllForUser(user.sub, page, limit);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'View commission detail (participants only)' })
  @ApiResponse({
    status: 200,
    description: 'Commission details',
    type: CommissionResponse,
  })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  @ApiResponse({ status: 404, description: 'Commission not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.commissionsService.findOne(id, user.sub);
  }
}
