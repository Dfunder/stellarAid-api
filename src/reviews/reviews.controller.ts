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
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { ReviewsService } from './reviews.service';

interface AuthUser {
  sub: string;
  role: string;
}

@ApiTags('reviews')
@Controller({ version: '1', path: 'reviews' })
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List public reviews (filter by artist, sort)' })
  async findAll(@Query() query: QueryReviewDto) {
    return this.reviewsService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a single review' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLIENT, Role.BUSINESS)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a review for a completed commission' })
  @ApiResponse({
    status: 400,
    description: 'Commission not completed / already reviewed',
  })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLIENT, Role.BUSINESS)
  @ApiOperation({ summary: 'Edit your own review' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { rating?: number; comment?: string },
  ) {
    return this.reviewsService.update(user.sub, id, body.rating, body.comment);
  }

  @Post(':id/helpful')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle a helpful vote on a review' })
  async helpful(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reviewsService.toggleHelpful(user.sub, id);
  }

  @Patch(':id/moderate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Moderate a review (admin: hide/show)' })
  async moderate(@Param('id') id: string, @Body() body: { isPublic: boolean }) {
    return this.reviewsService.moderate(id, body.isPublic);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Delete your own review (or any review as admin)' })
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reviewsService.remove(user.sub, id, user.role === Role.ADMIN);
  }
}
