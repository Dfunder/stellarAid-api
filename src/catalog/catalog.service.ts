import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SaveSearchDto, SearchServicesDto } from './dto/search.dto';
import { CachingService } from '../caching/caching.service';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cachingService: CachingService,
  ) {}

  private buildWhere(dto: SearchServicesDto): Prisma.ServiceWhereInput {
    const where: Prisma.ServiceWhereInput = { isActive: true };

    if (dto.q) {
      where.OR = [
        { title: { contains: dto.q, mode: 'insensitive' } },
        { description: { contains: dto.q, mode: 'insensitive' } },
        { category: { contains: dto.q, mode: 'insensitive' } },
      ];
    }
    if (dto.category) where.category = dto.category;
    if (dto.minPrice !== undefined || dto.maxPrice !== undefined) {
      where.priceUsdc = {
        ...(dto.minPrice !== undefined && { gte: dto.minPrice }),
        ...(dto.maxPrice !== undefined && { lte: dto.maxPrice }),
      };
    }
    if (dto.maxDeliveryDays !== undefined) {
      where.deliveryDays = { lte: dto.maxDeliveryDays };
    }
    const artistFilter: Prisma.ArtistWhereInput = {};
    if (dto.minRating !== undefined) {
      artistFilter.averageRating = { gte: dto.minRating };
    }
    if (dto.location) {
      artistFilter.location = { contains: dto.location, mode: 'insensitive' };
    }
    if (Object.keys(artistFilter).length > 0) where.artist = artistFilter;

    return where;
  }

  private buildOrderBy(
    dto: SearchServicesDto,
  ): Prisma.ServiceOrderByWithRelationInput {
    const order = dto.order ?? 'desc';
    switch (dto.sortBy) {
      case 'price':
        return { priceUsdc: order };
      case 'rating':
        return { artist: { averageRating: order } };
      case 'newest':
        return { createdAt: order };
      case 'relevance':
      default:
        // Relevance proxy: highest-rated, most-reviewed artists first.
        return { artist: { averageRating: 'desc' } };
    }
  }

  /** Advanced service search with filters, sorting, ranking, and pagination. */
  async searchServices(dto: SearchServicesDto, userId?: string) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const where = this.buildWhere(dto);

    const [total, data] = await this.prisma.$transaction([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        orderBy: this.buildOrderBy(dto),
        skip: (page - 1) * limit,
        take: limit,
        include: {
          artist: {
            select: {
              id: true,
              averageRating: true,
              totalReviews: true,
              location: true,
              isVerified: true,
            },
          },
        },
      }),
    ]);

    if (dto.q) {
      await this.prisma.searchQuery.create({
        data: { term: dto.q.toLowerCase().trim(), userId, resultCount: total },
      });
    }

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Autocomplete suggestions drawn from service titles and categories. */
  async suggestions(prefix: string) {
    if (!prefix || prefix.trim().length === 0) return { suggestions: [] };

    const cacheKey = `suggestions:${prefix}`;
    const cachedSuggestions = await this.cachingService.get(cacheKey);
    if (cachedSuggestions) {
      return cachedSuggestions;
    }

    const services = await this.prisma.service.findMany({
      where: {
        isActive: true,
        OR: [
          { title: { contains: prefix, mode: 'insensitive' } },
          { category: { contains: prefix, mode: 'insensitive' } },
        ],
      },
      select: { title: true, category: true },
      take: 20,
    });
    const set = new Set<string>();
    for (const s of services) {
      set.add(s.title);
      set.add(s.category);
    }
    const suggestions = {
      suggestions: Array.from(set)
        .filter((s) => s.toLowerCase().includes(prefix.toLowerCase()))
        .slice(0, 10),
    };

    await this.cachingService.set(cacheKey, suggestions, 3600); // Cache for 1 hour
    return suggestions;
  }

  /** Aggregate search analytics: most frequent terms. */
  async analytics() {
    const grouped = await this.prisma.searchQuery.groupBy({
      by: ['term'],
      _count: true,
      orderBy: { _count: { term: 'desc' } },
      take: 20,
    });
    const total = await this.prisma.searchQuery.count();
    return {
      totalSearches: total,
      topTerms: grouped.map((g) => ({ term: g.term, count: g._count })),
    };
  }

  // --- Saved searches ------------------------------------------------------

  async saveSearch(userId: string, dto: SaveSearchDto) {
    return this.prisma.savedSearch.create({
      data: {
        userId,
        name: dto.name,
        query: (dto.query ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async listSavedSearches(userId: string) {
    return this.prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteSavedSearch(userId: string, id: string) {
    const saved = await this.prisma.savedSearch.findUnique({ where: { id } });
    if (!saved || saved.userId !== userId) {
      throw new NotFoundException('Saved search not found');
    }
    await this.prisma.savedSearch.delete({ where: { id } });
    return { deleted: true };
  }

  async runSavedSearch(userId: string, id: string) {
    const saved = await this.prisma.savedSearch.findUnique({ where: { id } });
    if (!saved || saved.userId !== userId) {
      throw new NotFoundException('Saved search not found');
    }
    return this.searchServices(
      (saved.query as SearchServicesDto) ?? {},
      userId,
    );
  }
}
