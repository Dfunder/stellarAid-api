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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import { Deprecated } from '../common/decorators/deprecated.decorator';
import { MarketplaceService } from './marketplace.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { SearchServicesDto } from './dto/search-services.dto';
import {
  BulkCreateServicesDto,
  BulkDeleteServicesDto,
  BulkUpdateServicesDto,
} from './dto/bulk-operations.dto';
import { RoleRateLimit } from '../common/throttling/rate-limit.decorator';
import {
  FeaturedContentResponse,
  PortfolioResponse,
  ServiceResponse,
  ServicesResponse,
} from './ro/marketplace.ro';

@ApiTags('marketplace')
@Controller({ version: '1', path: 'marketplace' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Post('services')
  @Roles(Role.ARTIST)
  @ApiBearerAuth('bearer')
  @RoleRateLimit({
    ttl: 60000,
    limits: { [Role.ARTIST]: 30, [Role.BUSINESS]: 10 },
    defaultLimit: 10,
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'List a new service (artist only)',
    description: 'Create a freelance creative service listing with pricing, category, and deliverables.',
  })
  @ApiBody({
    type: CreateServiceDto,
    examples: {
      a: {
        summary: 'Create a new service',
        value: {
          title: '3D Character Sculpting',
          description: 'High-poly and game-ready 3D character models',
          price: 150,
          category: 'ART',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Service created successfully',
    type: ServiceResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid input payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden - Artist role required' })
  async createService(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateServiceDto,
  ) {
    return this.marketplaceService.createService(user.sub, dto);
  }

  @Public()
  @Get('services')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Browse all active services',
    description: 'Retrieve a paginated list of all publicly listed active services on the marketplace.',
  })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20, description: 'Items per page (default: 20)' })
  @ApiResponse({
    status: 200,
    description: 'List of active services',
    type: ServicesResponse,
  })
  async findAllActive(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.marketplaceService.findAllActive(page, limit);
  }

  @Post('services/bulk')
  @Roles(Role.ARTIST)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Bulk create services (artist only)',
    description: 'Create multiple service listings in a single atomic batch operation.',
  })
  @ApiBody({ type: BulkCreateServicesDto })
  @ApiResponse({ status: 201, description: 'Bulk creation job queued or completed' })
  @ApiResponse({ status: 400, description: 'Invalid batch payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden - Artist role required' })
  @Deprecated('2028-01-01T00:00:00Z', '/v2/services/bulk')
  async bulkCreateServices(
    @CurrentUser() user: { sub: string },
    @Body() dto: BulkCreateServicesDto,
  ) {
    return this.marketplaceService.bulkCreateServices(user.sub, dto);
  }

  @Patch('services/bulk')
  @Roles(Role.ARTIST)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk update owned services (artist only)',
    description: 'Update pricing, descriptions, or availability for multiple owned services at once.',
  })
  @ApiBody({ type: BulkUpdateServicesDto })
  @ApiResponse({ status: 200, description: 'Bulk update operation summary' })
  @ApiResponse({ status: 400, description: 'Invalid batch update payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden - Artist role required' })
  async bulkUpdateServices(
    @CurrentUser() user: { sub: string },
    @Body() dto: BulkUpdateServicesDto,
  ) {
    return this.marketplaceService.bulkUpdateServices(user.sub, dto);
  }

  @Delete('services/bulk')
  @Roles(Role.ARTIST)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk delete owned services (requires confirm: true)',
    description: 'Batch remove or deactivate multiple service listings.',
  })
  @ApiBody({ type: BulkDeleteServicesDto })
  @ApiResponse({ status: 200, description: 'Bulk deletion operation summary' })
  @ApiResponse({ status: 400, description: 'Missing deletion confirmation or invalid IDs' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden - Artist role required' })
  async bulkDeleteServices(
    @CurrentUser() user: { sub: string },
    @Body() dto: BulkDeleteServicesDto,
  ) {
    return this.marketplaceService.bulkDeleteServices(user.sub, dto);
  }

  @Get('services/bulk-operations/:operationId')
  @Roles(Role.ARTIST)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get the status of a bulk operation',
    description: 'Query execution progress, completed counts, and any failures for a batch operation.',
  })
  @ApiParam({ name: 'operationId', description: 'Bulk operation task UUID', example: 'job-uuid-1234' })
  @ApiResponse({ status: 200, description: 'Bulk operation status and summary' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden - Artist role required' })
  @ApiResponse({ status: 404, description: 'Operation not found or expired' })
  async getBulkOperation(@Param('operationId') operationId: string) {
    return this.marketplaceService.getBulkOperation(operationId);
  }

  @Public()
  @Get('services/search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search and filter services',
    description: 'Full-text query search with category, minPrice, maxPrice filtering and sorting.',
  })
  @ApiQuery({ name: 'query', type: String, required: false, description: 'Search keywords' })
  @ApiQuery({ name: 'category', type: String, required: false, description: 'Service category' })
  @ApiQuery({ name: 'minPrice', type: Number, required: false, description: 'Minimum price filter' })
  @ApiQuery({ name: 'maxPrice', type: Number, required: false, description: 'Maximum price filter' })
  @ApiQuery({ name: 'sortBy', type: String, required: false, description: 'Sort field (price, rating, createdAt)' })
  @ApiQuery({ name: 'sortOrder', type: String, required: false, enum: ['asc', 'desc'], description: 'Sort direction' })
  @ApiQuery({ name: 'page', type: Number, required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', type: Number, required: false, description: 'Results per page' })
  @ApiResponse({
    status: 200,
    description: 'Paginated search results',
    type: ServicesResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  async search(@Query() query: SearchServicesDto) {
    return this.marketplaceService.search(query);
  }

  @Public()
  @Get('services/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'View service detail',
    description: 'Fetch detailed service listing info, pricing tiers, and artist profile.',
  })
  @ApiParam({ name: 'id', description: 'Service UUID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({
    status: 200,
    description: 'Detailed service information',
    type: ServiceResponse,
  })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async findOne(@Param('id') id: string) {
    return this.marketplaceService.findOne(id);
  }

  @Public()
  @Get('portfolios/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'View a published portfolio',
    description: 'Fetch published portfolio showcase by ID with attached services.',
  })
  @ApiParam({ name: 'id', description: 'Portfolio UUID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({
    status: 200,
    description: 'Portfolio details with associated services',
    type: PortfolioResponse,
  })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  async findPortfolio(@Param('id') id: string) {
    return this.marketplaceService.findPortfolio(id);
  }

  @Public()
  @Get('featured')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get featured artists and services',
    description: 'Retrieve curated spotlight services and top-rated portfolios.',
  })
  @ApiResponse({
    status: 200,
    description: 'Curated featured content for discovery',
    type: FeaturedContentResponse,
  })
  async getFeatured() {
    return this.marketplaceService.getFeatured();
  }

  @Patch('services/:id')
  @Roles(Role.ARTIST)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a service (owner only)',
    description: 'Update pricing, title, description, or category for an existing owned service.',
  })
  @ApiParam({ name: 'id', description: 'Service UUID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiBody({
    type: UpdateServiceDto,
    examples: {
      a: {
        summary: 'Update a service',
        value: {
          title: 'Updated 3D Character Sculpting',
          description: 'Updated description with extra turnaround options',
          price: 175,
          category: 'DESIGN',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Service updated successfully',
    type: ServiceResponse,
  })
  @ApiResponse({ status: 400, description: 'Invalid update payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not the service owner or not an artist' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateServiceDto,
  ) {
    return this.marketplaceService.update(id, user.sub, dto);
  }

  @Delete('services/:id')
  @Roles(Role.ARTIST)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate a service (owner only)',
    description: 'Deactivate an active service listing so it is removed from marketplace search.',
  })
  @ApiParam({ name: 'id', description: 'Service UUID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({
    status: 200,
    description: 'Service deactivated successfully',
    type: ServiceResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not the service owner or not an artist' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.marketplaceService.deactivate(id, user.sub);
  }
}