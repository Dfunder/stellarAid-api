import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { SearchService } from './search.service';
import { SearchDto } from './dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Global search across artists, portfolios, and services' })
  @ApiResponse({
    status: 200,
    description: 'Grouped search results',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async search(@Query() query: SearchDto) {
    return this.searchService.search(query);
  }
}
