import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PortfolioCategory } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoverPaginationDto } from './dto/pagination.dto';
import { toSkipTake, paginate } from '../common/pagination/pagination.util';

const CACHE_TTL_SECONDS = 300;

@Injectable()
export class DiscoverService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('RedisClient') private readonly redisClient: Redis,
  ) {}

  async getCategories() {
    const cacheKey = 'discover:categories';
    const cached = await this.redisClient.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as Array<{
        category: PortfolioCategory;
        count: number;
      }>;
    }

    const categories = await this.prisma.portfolio.groupBy({
      by: ['category'],
      where: { isPublished: true },
      _count: { _all: true },
      orderBy: { category: 'asc' },
    });
    const result = categories.map(({ category, _count }) => ({
      category,
      count: _count._all,
    }));

    await this.redisClient.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      CACHE_TTL_SECONDS,
    );

    return result;
  }

  async getPortfolios(pagination: DiscoverPaginationDto) {
    const { category, page, limit } = pagination;
    const portfolioCategory = this.parsePortfolioCategory(category);
    const { skip, take } = toSkipTake(page, limit);
    const cacheKey = `discover:portfolios:${portfolioCategory}:${skip}:${take}`;
    const cached = await this.redisClient.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const where = { category: portfolioCategory, isPublished: true };
    const [data, total] = await Promise.all([
      this.prisma.portfolio.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          artist: { include: { user: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.portfolio.count({ where }),
    ]);

    const result = paginate(data, total, page, limit);
    await this.redisClient.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      CACHE_TTL_SECONDS,
    );

    return result;
  }

  async getServices(pagination: DiscoverPaginationDto) {
    const { category, page, limit } = pagination;
    const { skip, take } = toSkipTake(page, limit);
    const cacheKey = `discover:services:${category}:${skip}:${take}`;
    const cached = await this.redisClient.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const where = { category, isActive: true };
    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          artist: { include: { user: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.service.count({ where }),
    ]);

    const result = paginate(data, total, page, limit);
    await this.redisClient.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      CACHE_TTL_SECONDS,
    );

    return result;
  }

  private parsePortfolioCategory(category: string): PortfolioCategory {
    if (
      !Object.values(PortfolioCategory).includes(category as PortfolioCategory)
    ) {
      throw new BadRequestException(`Invalid portfolio category: ${category}`);
    }

    return category as PortfolioCategory;
  }
}
