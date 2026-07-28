import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import { CommissionsService } from './commissions.service';
import { CreateCommissionDto } from './dto/create-commission.dto';

@ApiTags('commissions')
@Controller('commissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Post()
  @Roles(Role.CLIENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a commission request (client only)' })
  @ApiResponse({ status: 201, description: 'Commission created' })
  @ApiResponse({ status: 403, description: 'Not a client' })
  @ApiResponse({ status: 404, description: 'Artist not found' })
  async create(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateCommissionDto,
  ) {
    return this.commissionsService.create(user.sub, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List own commissions' })
  @ApiResponse({ status: 200, description: 'List of commissions' })
  async findAll(@CurrentUser() user: { sub: string }) {
    return this.commissionsService.findAllForUser(user.sub);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'View commission detail (participants only)' })
  @ApiResponse({ status: 200, description: 'Commission details' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  @ApiResponse({ status: 404, description: 'Commission not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.commissionsService.findOne(id, user.sub);
  }
}
