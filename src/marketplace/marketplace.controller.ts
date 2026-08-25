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
import { Roles } from '../auth/decorators/roles.decorators';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import { MarketplaceService } from './marketplace.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { SearchServicesDto } from './dto/search-services.dto';
import { RoleRateLimit } from '../common/throttling/rate-limit.decorator';

@ApiTags('marketplace')
@Controller('marketplace')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Post('services')
  @Roles(Role.ARTIST)
  @RoleRateLimit({
    ttl: 60000,
    limits: { [Role.ARTIST]: 30, [Role.BUSINESS]: 10 },
    defaultLimit: 10,
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'List a new service (artist only)' })
  @ApiResponse({ status: 201, description: 'Service created' })
  @ApiResponse({ status: 403, description: 'Not an artist' })
  async createService(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateServiceDto,
  ) {
    return this.marketplaceService.createService(user.sub, dto);
  }

  @Public()
  @Get('services')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Browse all active services' })
  @ApiResponse({ status: 200, description: 'List of active services' })
  async findAllActive(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.marketplaceService.findAllActive(page, limit);
  }

  @Public()
  @Get('services/search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search and filter services' })
  @ApiResponse({ status: 200, description: 'Paginated search results' })
  async search(@Query() query: SearchServicesDto) {
    return this.marketplaceService.search(query);
  }

  @Public()
  @Get('services/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'View service detail' })
  @ApiResponse({ status: 200, description: 'Service details' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async findOne(@Param('id') id: string) {
    return this.marketplaceService.findOne(id);
  }

  @Public()
  @Get('portfolios/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'View a published portfolio' })
  @ApiResponse({ status: 200, description: 'Portfolio details' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  async findPortfolio(@Param('id') id: string) {
    return this.marketplaceService.findPortfolio(id);
  }

  @Public()
  @Get('featured')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get featured artists and services' })
  @ApiResponse({ status: 200, description: 'Featured content' })
  async getFeatured() {
    return this.marketplaceService.getFeatured();
  }

  @Patch('services/:id')
  @Roles(Role.ARTIST)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a service (owner only)' })
  @ApiResponse({ status: 200, description: 'Service updated' })
  @ApiResponse({ status: 403, description: 'Not the service owner' })
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a service (owner only)' })
  @ApiResponse({ status: 200, description: 'Service deactivated' })
  @ApiResponse({ status: 403, description: 'Not the service owner' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.marketplaceService.deactivate(id, user.sub);
  }
}
