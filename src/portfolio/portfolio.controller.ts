import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { CreatePortfolioItemDto } from './dto/portfolio-item.dto';
import { QueryPortfolioDto } from './dto/query-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { PortfolioService } from './portfolio.service';

@ApiTags('portfolio')
@Controller({ version: '1', path: 'portfolios' })
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List published portfolios (filter + sort + page)' })
  async findAll(@Query() query: QueryPortfolioDto) {
    return this.portfolioService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a single portfolio with its items' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  async findOne(@Param('id') id: string) {
    return this.portfolioService.findOne(id);
  }

  @Post(':id/views')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a view impression for a portfolio' })
  async trackView(@Param('id') id: string) {
    return this.portfolioService.trackView(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a portfolio (artist only)' })
  async create(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreatePortfolioDto,
  ) {
    return this.portfolioService.create(user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @ApiOperation({ summary: 'Update a portfolio' })
  async update(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: UpdatePortfolioDto,
  ) {
    return this.portfolioService.update(user.sub, id, dto);
  }

  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @ApiOperation({ summary: 'Publish a portfolio (make it discoverable)' })
  async publish(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.portfolioService.setVisibility(user.sub, id, true);
  }

  @Patch(':id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @ApiOperation({ summary: 'Unpublish a portfolio (revert to draft)' })
  async unpublish(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
  ) {
    return this.portfolioService.setVisibility(user.sub, id, false);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @ApiOperation({ summary: 'Delete a portfolio' })
  async remove(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.portfolioService.remove(user.sub, id);
  }

  @Post(':id/items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a media item to a portfolio' })
  async addItem(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() dto: CreatePortfolioItemDto,
  ) {
    return this.portfolioService.addItem(user.sub, id, dto);
  }

  @Delete(':id/items/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @ApiOperation({ summary: 'Remove a media item from a portfolio' })
  async removeItem(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.portfolioService.removeItem(user.sub, id, itemId);
  }

  @Get(':id/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @ApiOperation({ summary: 'View tracking analytics for an owned portfolio' })
  async analytics(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
  ) {
    return this.portfolioService.getAnalytics(user.sub, id);
  }
}
