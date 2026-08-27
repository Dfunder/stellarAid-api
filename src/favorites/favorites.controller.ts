import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import { AddFavoriteDto } from './dto/favorite.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@Controller({ version: '1', path: 'favorites' })
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a service to favourites' })
  async add(@CurrentUser() user: { sub: string }, @Body() dto: AddFavoriteDto) {
    return this.favoritesService.add(user.sub, dto.serviceId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'List my favourites' })
  async list(@CurrentUser() user: { sub: string }) {
    return this.favoritesService.list(user.sub);
  }

  @Post('check-price-drops')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check favourites for price drops and notify' })
  async checkPriceDrops(@CurrentUser() user: { sub: string }) {
    return this.favoritesService.checkPriceDrops(user.sub);
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Most-favourited services (admin)' })
  async analytics() {
    return this.favoritesService.analytics();
  }

  @Get('shared/:userId')
  @Public()
  @ApiOperation({ summary: 'View a shareable wishlist by user id' })
  async shared(@Param('userId') userId: string) {
    return this.favoritesService.sharedList(userId);
  }

  @Delete(':serviceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Remove a service from favourites' })
  async remove(
    @CurrentUser() user: { sub: string },
    @Param('serviceId') serviceId: string,
  ) {
    return this.favoritesService.remove(user.sub, serviceId);
  }
}
