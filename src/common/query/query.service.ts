import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ServiceListQueryDto } from './query.dto';
import {
  buildPaginationMeta,
  containsFilter,
  parseSort,
  rangeFilter,
} from './query.util';

/** Fields on Service that clients are permitted to sort by. */
const SORTABLE_FIELDS = [
  'priceUsdc',
  'deliveryDays',
  'createdAt',
  'title',
] as const;

/**
 * Demonstrates standardised sorting (#611), filtering (#612), and pagination
 * metadata (#613) over the Service model.
 */
@Injectable()
export class QueryService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(query: ServiceListQueryDto): Prisma.ServiceWhereInput {
    const where: Prisma.ServiceWhereInput = {};
    if (query.category) where.category = query.category;
    const title = containsFilter(query.title);
    if (title) where.title = title;
    const price = rangeFilter(query.minPrice, query.maxPrice);
    if (price) where.priceUsdc = price;
    if (query.maxDeliveryDays !== undefined) {
      where.deliveryDays = { lte: query.maxDeliveryDays };
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }
    return where;
  }

  async listServices(query: ServiceListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildWhere(query);
    const orderBy = parseSort(query.sort, SORTABLE_FIELDS);

    const [total, data] = await this.prisma.$transaction([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        orderBy: orderBy.length > 0 ? orderBy : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }
}
