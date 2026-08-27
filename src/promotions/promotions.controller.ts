import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import { CreatePromotionDto } from './dto/promotion.dto';
import { PromotionsService } from './promotions.service';

@ApiTags('promotions')
@Controller({ version: '1', path: 'promotions' })
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('featured')
  @Public()
  @ApiOperation({ summary: 'List currently-featured/promoted services' })
  async featured() {
    return this.promotionsService.listFeatured();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create/schedule a promotion (admin)' })
  async create(@Body() dto: CreatePromotionDto) {
    return this.promotionsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all promotions (admin)' })
  async list() {
    return this.promotionsService.list();
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Promotion analytics (admin)' })
  async analytics() {
    return this.promotionsService.analytics();
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deactivate a promotion (admin)' })
  async deactivate(@Param('id') id: string) {
    return this.promotionsService.deactivate(id);
  }
}
