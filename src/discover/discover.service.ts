import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PortfolioCategory } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoverPaginationDto } from './dto/discover-pagination.dto';

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

  async getPortfolios(
    category: string,
    pagination: DiscoverPaginationDto,
  ) {
    const portfolioCategory = this.parsePortfolioCategory(category);
    const offset = pagination.offset ?? 0;
    const limit = pagination.limit ?? 10;
    const cacheKey = `discover:portfolios:${portfolioCategory}:${offset}:${limit}`;
    const cached = await this.redisClient.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as Record<string, unknown>;
    }

    const where = { category: portfolioCategory, isPublished: true };
    const [data, total] = await Promise.all([
      this.prisma.portfolio.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          artist: { include: { user: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.portfolio.count({ where }),
    ]);

    const result = { data, total, offset, limit, hasMore: offset + limit < total };
    await this.redisClient.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      CACHE_TTL_SECONDS,
    );

    return result;
  }

  async getServices(category: string, pagination: DiscoverPaginationDto) {
    const offset = pagination.offset ?? 0;
    const limit = pagination.limit ?? 10;
    const cacheKey = `discover:services:${category}:${offset}:${limit}`;
    const cached = await this.redisClient.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as Record<string, unknown>;
    }

    const where = { category, isActive: true };
    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          artist: { include: { user: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.service.count({ where }),
    ]);

    const result = { data, total, offset, limit, hasMore: offset + limit < total };
    await this.redisClient.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      CACHE_TTL_SECONDS,
    );

    return result;
  }

  private parsePortfolioCategory(category: string): PortfolioCategory {
    if (!Object.values(PortfolioCategory).includes(category as PortfolioCategory)) {
      throw new BadRequestException(`Invalid portfolio category: ${category}`);
    }

    return category as PortfolioCategory;
  }
}