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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
import {
  PaginatedPortfoliosResponse,
  PortfolioAnalyticsResponse,
  PortfolioDetailResponse,
  PortfolioItemResponse,
  PortfolioResponse,
} from './ro/portfolio.ro';

@ApiTags('portfolio')
@Controller({ version: '1', path: 'portfolios' })
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List published portfolios',
    description: 'Retrieve a paginated list of published portfolios with optional category and tag filtering, and sorting.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of matching published portfolios',
    type: PaginatedPortfoliosResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid filter or pagination parameters',
  })
  async findAll(@Query() query: QueryPortfolioDto) {
    return this.portfolioService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get a single portfolio with its items',
    description: 'Fetch detailed information of a portfolio including all attached media items and artist details.',
  })
  @ApiParam({
    name: 'id',
    description: 'Portfolio UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed portfolio with media items',
    type: PortfolioDetailResponse,
  })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  async findOne(@Param('id') id: string) {
    return this.portfolioService.findOne(id);
  }

  @Post(':id/views')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record a view impression for a portfolio',
    description: 'Increment the lifetime view counter and update daily analytics impression counts.',
  })
  @ApiParam({
    name: 'id',
    description: 'Portfolio UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'View impression recorded successfully',
  })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  async trackView(@Param('id') id: string) {
    return this.portfolioService.trackView(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a portfolio (artist only)',
    description: 'Create a new portfolio showcase project for the authenticated artist.',
  })
  @ApiBody({ type: CreatePortfolioDto })
  @ApiResponse({
    status: 201,
    description: 'Portfolio created successfully',
    type: PortfolioResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid input payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden - Artist role required' })
  async create(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreatePortfolioDto,
  ) {
    return this.portfolioService.create(user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Update a portfolio (owner only)',
    description: 'Update project metadata such as title, description, category, tags, or cover image.',
  })
  @ApiParam({
    name: 'id',
    description: 'Portfolio UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiBody({ type: UpdatePortfolioDto })
  @ApiResponse({
    status: 200,
    description: 'Portfolio updated successfully',
    type: PortfolioResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid update payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not the portfolio owner or not an artist' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
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
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Publish a portfolio (make discoverable)',
    description: 'Set portfolio visibility to published, allowing public users to view it in marketplace and explore listings.',
  })
  @ApiParam({
    name: 'id',
    description: 'Portfolio UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio published successfully',
    type: PortfolioResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not the portfolio owner or not an artist' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  async publish(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.portfolioService.setVisibility(user.sub, id, true);
  }

  @Patch(':id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Unpublish a portfolio (revert to draft)',
    description: 'Set portfolio visibility to unpublished / draft mode, hiding it from public discovery.',
  })
  @ApiParam({
    name: 'id',
    description: 'Portfolio UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio unpublished successfully',
    type: PortfolioResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not the portfolio owner or not an artist' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  async unpublish(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
  ) {
    return this.portfolioService.setVisibility(user.sub, id, false);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Delete a portfolio (owner only)',
    description: 'Permanently remove a portfolio and its associated media items.',
  })
  @ApiParam({
    name: 'id',
    description: 'Portfolio UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio deleted successfully',
    type: PortfolioResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not the portfolio owner or not an artist' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  async remove(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.portfolioService.remove(user.sub, id);
  }

  @Post(':id/items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTIST)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a media item to a portfolio',
    description: 'Attach a new media asset, illustration, or artwork render to the portfolio.',
  })
  @ApiParam({
    name: 'id',
    description: 'Portfolio UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiBody({ type: CreatePortfolioItemDto })
  @ApiResponse({
    status: 201,
    description: 'Media item added to portfolio successfully',
    type: PortfolioItemResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid media item payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not the portfolio owner or not an artist' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
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
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Remove a media item from a portfolio',
    description: 'Delete an individual media item from the specified portfolio.',
  })
  @ApiParam({
    name: 'id',
    description: 'Portfolio UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiParam({
    name: 'itemId',
    description: 'Media Item UUID',
    example: 'item-uuid-1234',
  })
  @ApiResponse({
    status: 200,
    description: 'Media item removed successfully',
    type: PortfolioItemResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not the portfolio owner or not an artist' })
  @ApiResponse({ status: 404, description: 'Portfolio or item not found' })
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
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'View tracking analytics for an owned portfolio',
    description: 'Retrieve view impression metrics and daily breakdown for the portfolio.',
  })
  @ApiParam({
    name: 'id',
    description: 'Portfolio UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio tracking analytics data',
    type: PortfolioAnalyticsResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not the portfolio owner or not an artist' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  async analytics(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
  ) {
    return this.portfolioService.getAnalytics(user.sub, id);
  }
}
