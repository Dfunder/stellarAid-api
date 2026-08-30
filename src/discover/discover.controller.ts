import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { DiscoverService } from './discover.service';
import { DiscoverPaginationDto } from './dto/pagination.dto';

@ApiTags('discover')
@Controller({ version: '1', path: 'discover' })
export class DiscoverController {
  constructor(private readonly discoverService: DiscoverService) {}

  @Public()
  @Get('categories')
  @ApiOperation({
    summary: 'List active portfolio categories with item counts',
  })
  getCategories() {
    return this.discoverService.getCategories();
  }

  @Public()
  @Get('portfolios')
  @ApiOperation({ summary: 'Browse published portfolios by category' })
  getPortfolios(@Query() pagination: DiscoverPaginationDto) {
    return this.discoverService.getPortfolios(pagination);
  }

  @Public()
  @Get('services')
  @ApiOperation({ summary: 'Browse active services by category' })
  getServices(@Query() pagination: DiscoverPaginationDto) {
    return this.discoverService.getServices(pagination);
  }
}
