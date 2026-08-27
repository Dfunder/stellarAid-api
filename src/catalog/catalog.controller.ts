import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { CatalogService } from './catalog.service';
import { SaveSearchDto, SearchServicesDto } from './dto/search.dto';

@ApiTags('catalog')
@Controller({ version: '1', path: 'catalog' })
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('search')
  @Public()
  @ApiOperation({
    summary: 'Advanced service search (filter, sort, rank, page)',
  })
  async search(@Query() dto: SearchServicesDto) {
    return this.catalogService.searchServices(dto);
  }

  @Get('suggestions')
  @Public()
  @ApiOperation({ summary: 'Search suggestions / autocomplete' })
  async suggestions(@Query('q') q: string) {
    return this.catalogService.suggestions(q ?? '');
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Search analytics: top terms (admin)' })
  async analytics() {
    return this.catalogService.analytics();
  }

  // --- Saved searches ------------------------------------------------------

  @Post('saved-searches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Save a search filter set' })
  async save(@CurrentUser() user: { sub: string }, @Body() dto: SaveSearchDto) {
    return this.catalogService.saveSearch(user.sub, dto);
  }

  @Get('saved-searches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'List my saved searches' })
  async listSaved(@CurrentUser() user: { sub: string }) {
    return this.catalogService.listSavedSearches(user.sub);
  }

  @Post('saved-searches/:id/run')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run a saved search' })
  async runSaved(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
  ) {
    return this.catalogService.runSavedSearch(user.sub, id);
  }

  @Delete('saved-searches/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Delete a saved search' })
  async deleteSaved(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
  ) {
    return this.catalogService.deleteSavedSearch(user.sub, id);
  }
}
