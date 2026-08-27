import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { SearchServicesDto } from './dto/search-services.dto';
import { PortfolioAnalyticsService } from '../analytics/portfolio-analytics.service';
import { paginate } from '../common/utils/pagination.util';

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('RedisClient') private readonly redisClient: Redis,
    private readonly portfolioAnalytics: PortfolioAnalyticsService,
  ) {}

  async findPortfolio(id: string) {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id, isPublished: true },
      include: {
        items: { orderBy: { order: 'asc' } },
        artist: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    await this.portfolioAnalytics.recordView(id, portfolio.items.map((item) => item.id));
    return portfolio;
  }
// create a new service listing
  async createService(artistUserId: string, dto: CreateServiceDto) {
    const artist = await this.prisma.artist.findUnique({
      where: { userId: artistUserId },
    });

    if (!artist) {
      throw new ForbiddenException('Only artists can list services');
    }

    const service = await this.prisma.service.create({
      data: {
        artistId: artist.id,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        priceUsdc: dto.priceUsdc,
        deliveryDays: dto.deliveryDays,
        revisions: dto.revisions,
        features: dto.features,
      },
      include: {
        artist: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    await this.invalidateSearchCache();

    return service;
  }

  async findAllActive(page?: number | string, limit?: number | string) {
    return paginate({
      page,
      limit,
      fetch: ({ skip, take }) =>
        this.prisma.service.findMany({
          where: { isActive: true },
          skip,
          take,
          include: {
        artist: {
          include: {
            user: { select: { id: true, name: true } },
            reviews: { select: { rating: true } },
          },
        },
          },
          orderBy: { createdAt: 'desc' },
        }),
      count: () => this.prisma.service.count({ where: { isActive: true } }),
    });
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        artist: {
          include: {
            user: { select: { id: true, name: true } },
            reviews: {
              select: { rating: true, comment: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }

  async update(id: string, artistUserId: string, dto: UpdateServiceDto) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { artist: true },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (service.artist.userId !== artistUserId) {
      throw new ForbiddenException('You can only update your own services');
    }

    const updated = await this.prisma.service.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && {
          description: dto.description,
        }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.priceUsdc !== undefined && { priceUsdc: dto.priceUsdc }),
        ...(dto.deliveryDays !== undefined && {
          deliveryDays: dto.deliveryDays,
        }),
        ...(dto.revisions !== undefined && { revisions: dto.revisions }),
        ...(dto.features !== undefined && { features: dto.features }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        artist: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    await this.invalidateSearchCache();

    return updated;
  }

  async deactivate(id: string, artistUserId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { artist: true },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    if (service.artist.userId !== artistUserId) {
      throw new ForbiddenException('You can only deactivate your own services');
    }

    const deactivated = await this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });

    await this.invalidateSearchCache();

    return deactivated;
  }

  async search(dto: SearchServicesDto) {
    const cacheKey = this.buildSearchCacheKey(dto);
    const cached = await this.redisClient.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as Record<string, unknown>;
    }

    const where: Record<string, unknown> = { isActive: true };

    if (dto.q) {
      where.OR = [
        { title: { contains: dto.q, mode: 'insensitive' } },
        { description: { contains: dto.q, mode: 'insensitive' } },
      ];
    }

    if (dto.category) {
      where.category = dto.category;
    }

    if (dto.minPrice !== undefined || dto.maxPrice !== undefined) {
      const priceFilter: Record<string, number> = {};
      if (dto.minPrice !== undefined) priceFilter.gte = dto.minPrice;
      if (dto.maxPrice !== undefined) priceFilter.lte = dto.maxPrice;
      where.priceUsdc = priceFilter;
    }

    if (dto.deliveryDays !== undefined) {
      where.deliveryDays = { lte: dto.deliveryDays };
    }

    let orderBy: Record<string, string>;
    switch (dto.sortBy) {
      case 'price-asc':
        orderBy = { priceUsdc: 'asc' };
        break;
      case 'price-desc':
        orderBy = { priceUsdc: 'desc' };
        break;
      case 'top-rated':
        orderBy = { createdAt: 'desc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    const result = await paginate({
      page: dto.page,
      limit: dto.limit,
      fetch: ({ skip, take }) =>
        this.prisma.service.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          artist: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
        }),
      count: () => this.prisma.service.count({ where }),
    });

    const isUnfiltered =
      !dto.q &&
      !dto.category &&
      dto.minPrice === undefined &&
      dto.maxPrice === undefined &&
      dto.deliveryDays === undefined;

    if (isUnfiltered) {
      await this.redisClient.set(cacheKey, JSON.stringify(result), 'EX', 300);
    }

    return result;
  }

  async getFeatured() {
    const cacheKey = 'marketplace:featured';
    const cached = await this.redisClient.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as Record<string, unknown>;
    }

    const [topArtists, topServices] = await Promise.all([
      this.prisma.artist.findMany({
        where: { isVerified: true },
        orderBy: { averageRating: 'desc' },
        take: 6,
        include: {
          user: { select: { id: true, name: true } },
          services: { where: { isActive: true }, take: 3 },
        },
      }),
      this.prisma.service.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          artist: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      }),
    ]);

    const result = { topArtists, topServices };

    await this.redisClient.set(cacheKey, JSON.stringify(result), 'EX', 3600);

    return result;
  }

  private buildSearchCacheKey(dto: SearchServicesDto): string {
    const parts = [
      'marketplace:search',
      dto.q ?? '',
      dto.category ?? '',
      dto.minPrice?.toString() ?? '',
      dto.maxPrice?.toString() ?? '',
      dto.deliveryDays?.toString() ?? '',
      dto.sortBy ?? '',
      dto.page?.toString() ?? '1',
      dto.limit?.toString() ?? '20',
    ];
    return parts.join(':');
  }

  private async invalidateSearchCache(): Promise<void> {
    const keys = await this.redisClient.keys('marketplace:search*');
    if (keys.length > 0) {
      await this.redisClient.del(...keys);
    }
    await this.redisClient.del('marketplace:featured');
  }
}
