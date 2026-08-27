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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/sync/jwt.auth.guard';
import { RolesGuard } from '../auth/sync/roles.guard';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { ServiceCategoriesService } from './service-categories.service';

@ApiTags('service-categories')
@Controller({ version: '1', path: 'categories' })
export class ServiceCategoriesController {
  constructor(private readonly categoriesService: ServiceCategoriesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get the category hierarchy tree' })
  async tree() {
    return this.categoriesService.tree();
  }

  @Get('trending')
  @Public()
  @ApiOperation({ summary: 'Trending categories by active service count' })
  async trending() {
    return this.categoriesService.trending();
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Category analytics (admin)' })
  async analytics() {
    return this.categoriesService.analytics();
  }

  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'Get a category by slug' })
  async findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Get(':slug/services')
  @Public()
  @ApiOperation({ summary: 'Browse services in a category' })
  async browse(
    @Param('slug') slug: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.categoriesService.browse(
      slug,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a category (admin)' })
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a category (admin)' })
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a category (admin)' })
  async remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
