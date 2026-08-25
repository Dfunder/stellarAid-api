import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { DiscoverPaginationDto } from './dto/discover-pagination.dto';
import { DiscoverService } from './discover.service';

@ApiTags('discover')
@Controller('discover')
export class DiscoverController {
  constructor(private readonly discoverService: DiscoverService) {}

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'List active portfolio categories with item counts' })
  getCategories() {
    return this.discoverService.getCategories();
  }

  @Public()
  @Get('categories/:category/portfolios')
  @ApiOperation({ summary: 'Browse published portfolios by category' })
  getPortfolios(
    @Param('category') category: string,
    @Query() pagination: DiscoverPaginationDto,
  ) {
    return this.discoverService.getPortfolios(category, pagination);
  }

  @Public()
  @Get('categories/:category/services')
  @ApiOperation({ summary: 'Browse active services by category' })
  getServices(
    @Param('category') category: string,
    @Query() pagination: DiscoverPaginationDto,
  ) {
    return this.discoverService.getServices(category, pagination);
  }
}