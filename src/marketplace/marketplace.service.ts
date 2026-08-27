import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { SearchServicesDto } from './dto/search-services.dto';
import {
  BulkCreateServicesDto,
  BulkDeleteServicesDto,
  BulkUpdateServicesDto,
} from './dto/bulk-operations.dto';
import {
  BulkItemResult,
  BulkOperationSummary,
  BulkOperationType,
} from './bulk-operations.types';
import { PortfolioAnalyticsService } from '../analytics/portfolio-analytics.service';
import { paginate } from '../common/utils/pagination.util';
import { chunk } from '../common/utils/object.util';

@Injectable()
export class MarketplaceService {
  /** Items are processed in batches of this size per transaction. */
  private static readonly BULK_BATCH_SIZE = 25;

  /** Bulk operation summaries stay queryable in Redis for 24 hours. */
  private static readonly BULK_OPERATION_TTL_SECONDS = 24 * 60 * 60;

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

    await this.portfolioAnalytics.recordView(
      id,
      portfolio.items.map((item) => item.id),
    );
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
    const updated = await this.applyServiceUpdate(id, artistUserId, dto);

    await this.invalidateSearchCache();

    return updated;
  }

  /** Ownership-checked single-service update shared by single and bulk flows. */
  private async applyServiceUpdate(
    id: string,
    artistUserId: string,
    dto: UpdateServiceDto,
  ) {
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

    return this.prisma.service.update({
      where: { id },
      data: this.toServiceUpdateData(dto),
      include: {
        artist: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
  }

  private toServiceUpdateData(dto: UpdateServiceDto) {
    return {
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
    };
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

  /**
   * Bulk create services for the calling artist. Items are created in
   * batched transactions; a batch failure marks the remaining items as
   * failed instead of aborting the whole request.
   */
  async bulkCreateServices(
    artistUserId: string,
    dto: BulkCreateServicesDto,
  ): Promise<BulkOperationSummary> {
    const artist = await this.requireArtist(artistUserId);
    const startedAt = new Date().toISOString();
    const results: BulkItemResult[] = [];

    for (const batch of chunk(
      dto.services,
      MarketplaceService.BULK_BATCH_SIZE,
    )) {
      const startIndex = results.length;
      try {
        const created = await this.prisma.$transaction(
          batch.map((item) =>
            this.prisma.service.create({
              data: {
                artistId: artist.id,
                title: item.title,
                description: item.description,
                category: item.category,
                priceUsdc: item.priceUsdc,
                deliveryDays: item.deliveryDays,
                revisions: item.revisions,
                features: item.features,
              },
            }),
          ),
        );
        created.forEach((service, offset) => {
          results.push({
            id: service.id,
            index: startIndex + offset,
            status: 'succeeded',
          });
        });
      } catch (error) {
        for (let i = results.length; i < dto.services.length; i += 1) {
          results.push({
            index: i,
            status: 'failed',
            error: this.errorMessage(error),
          });
        }
        break;
      }
    }

    await this.invalidateSearchCache();
    return this.recordBulkOperation('create', startedAt, results);
  }

  /**
   * Bulk update services owned by the calling artist. Each item is
   * validated for existence and ownership; failures are reported per item
   * without affecting the rest of the batch.
   */
  async bulkUpdateServices(
    artistUserId: string,
    dto: BulkUpdateServicesDto,
  ): Promise<BulkOperationSummary> {
    await this.requireArtist(artistUserId);
    const startedAt = new Date().toISOString();
    const results: BulkItemResult[] = [];

    dto.services.forEach((_, index) => {
      results.push({ index, status: 'failed', error: 'Not processed' });
    });

    for (const batch of chunk(
      dto.services.map((item, index) => ({ item, index })),
      MarketplaceService.BULK_BATCH_SIZE,
    )) {
      const existing = await this.prisma.service.findMany({
        where: { id: { in: batch.map(({ item }) => item.id) } },
        include: { artist: true },
      });
      const byId = new Map(existing.map((service) => [service.id, service]));

      const valid: Array<{
        item: (typeof batch)[number]['item'];
        index: number;
      }> = [];
      for (const { item, index } of batch) {
        const service = byId.get(item.id);
        if (!service) {
          results[index] = {
            id: item.id,
            index,
            status: 'failed',
            error: 'Service not found',
          };
        } else if (service.artist.userId !== artistUserId) {
          results[index] = {
            id: item.id,
            index,
            status: 'failed',
            error: 'You can only update your own services',
          };
        } else {
          valid.push({ item, index });
        }
      }

      if (valid.length === 0) {
        continue;
      }

      try {
        await this.prisma.$transaction(
          valid.map(({ item }) =>
            this.prisma.service.update({
              where: { id: item.id },
              data: this.toServiceUpdateData(item),
            }),
          ),
        );
        for (const { item, index } of valid) {
          results[index] = { id: item.id, index, status: 'succeeded' };
        }
      } catch (error) {
        for (const { item, index } of valid) {
          results[index] = {
            id: item.id,
            index,
            status: 'failed',
            error: this.errorMessage(error),
          };
        }
      }
    }

    await this.invalidateSearchCache();
    return this.recordBulkOperation('update', startedAt, results);
  }

  /**
   * Bulk delete services owned by the calling artist. Requires explicit
   * confirmation; items are deleted per batch with per-item status
   * reporting, falling back to individual deletes to isolate failures.
   */
  async bulkDeleteServices(
    artistUserId: string,
    dto: BulkDeleteServicesDto,
  ): Promise<BulkOperationSummary> {
    if (dto.confirm !== true) {
      throw new BadRequestException(
        'Bulk deletion requires "confirm" to be true',
      );
    }
    await this.requireArtist(artistUserId);
    const startedAt = new Date().toISOString();
    const results: BulkItemResult[] = [];

    dto.ids.forEach((_, index) => {
      results.push({ index, status: 'failed', error: 'Not processed' });
    });

    for (const batch of chunk(
      dto.ids.map((id, index) => ({ id, index })),
      MarketplaceService.BULK_BATCH_SIZE,
    )) {
      const existing = await this.prisma.service.findMany({
        where: { id: { in: batch.map(({ id }) => id) } },
        include: { artist: true },
      });
      const byId = new Map(existing.map((service) => [service.id, service]));

      const deletable: Array<{ id: string; index: number }> = [];
      for (const { id, index } of batch) {
        const service = byId.get(id);
        if (!service) {
          results[index] = {
            id,
            index,
            status: 'failed',
            error: 'Service not found',
          };
        } else if (service.artist.userId !== artistUserId) {
          results[index] = {
            id,
            index,
            status: 'failed',
            error: 'You can only delete your own services',
          };
        } else {
          deletable.push({ id, index });
        }
      }

      if (deletable.length === 0) {
        continue;
      }

      try {
        await this.prisma.$transaction(
          deletable.map(({ id }) =>
            this.prisma.service.delete({ where: { id } }),
          ),
        );
        for (const { id, index } of deletable) {
          results[index] = { id, index, status: 'succeeded' };
        }
      } catch {
        // Batch failed wholesale (e.g. a commission still references one
        // of the services); retry individually to isolate the offenders.
        for (const { id, index } of deletable) {
          try {
            await this.prisma.service.delete({ where: { id } });
            results[index] = { id, index, status: 'succeeded' };
          } catch {
            results[index] = {
              id,
              index,
              status: 'failed',
              error: 'Service has related records and cannot be deleted',
            };
          }
        }
      }
    }

    await this.invalidateSearchCache();
    return this.recordBulkOperation('delete', startedAt, results);
  }

  /** Retrieve the tracked summary of a previous bulk operation. */
  async getBulkOperation(operationId: string): Promise<BulkOperationSummary> {
    const raw = await this.redisClient.get(`bulk-operation:${operationId}`);
    if (!raw) {
      throw new NotFoundException('Bulk operation not found or expired');
    }
    return JSON.parse(raw) as BulkOperationSummary;
  }

  private async requireArtist(artistUserId: string) {
    const artist = await this.prisma.artist.findUnique({
      where: { userId: artistUserId },
    });
    if (!artist) {
      throw new ForbiddenException('Only artists can list services');
    }
    return artist;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unexpected error';
  }

  /** Persists the operation summary so its status can be tracked later. */
  private async recordBulkOperation(
    type: BulkOperationType,
    startedAt: string,
    results: BulkItemResult[],
  ): Promise<BulkOperationSummary> {
    const succeeded = results.filter(
      (item) => item.status === 'succeeded',
    ).length;
    const summary: BulkOperationSummary = {
      operationId: randomUUID(),
      type,
      status:
        succeeded === results.length
          ? 'completed'
          : succeeded === 0
            ? 'failed'
            : 'partial',
      total: results.length,
      succeeded,
      failed: results.length - succeeded,
      startedAt,
      completedAt: new Date().toISOString(),
      results,
    };
    await this.redisClient.set(
      `bulk-operation:${summary.operationId}`,
      JSON.stringify(summary),
      'EX',
      MarketplaceService.BULK_OPERATION_TTL_SECONDS,
    );
    return summary;
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
