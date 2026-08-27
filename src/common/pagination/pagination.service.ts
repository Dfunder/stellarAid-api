import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CursorPaginatedResult,
  CursorPaginationQueryDto,
  PaginatedResult,
  PaginationQueryDto,
} from './pagination.dto';
import { paginate, toSkipTake } from './pagination.util';

/**
 * Demonstrates the reusable pagination utilities against the Service model,
 * providing both offset/limit and cursor-based strategies with total counts.
 */
@Injectable()
export class PaginationService {
  constructor(private readonly prisma: PrismaService) {}

  async paginateServices(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const { skip, take, page, limit } = toSkipTake(query.page, query.limit);
    const where = { isActive: true };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return paginate(data, total, page, limit);
  }

  async cursorPaginateServices(
    query: CursorPaginationQueryDto,
  ): Promise<CursorPaginatedResult<unknown>> {
    const limit = Math.min(Math.max(1, query.limit ?? 20), 100);
    const rows = await this.prisma.service.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });
    const hasNext = rows.length > limit;
    const data = hasNext ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasNext && data.length > 0 ? data[data.length - 1].id : null;
    return { data, meta: { limit, nextCursor, hasNext } };
  }
}
