import { PaginatedResult, PaginationMeta } from './pagination.dto';

/** Normalise page/limit into safe bounds and a Prisma skip/take pair. */
export function toSkipTake(
  page = 1,
  limit = 20,
  maxLimit = 100,
): { skip: number; take: number; page: number; limit: number } {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const safeLimit = Math.min(Math.max(1, Math.floor(limit) || 20), maxLimit);
  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
    page: safePage,
    limit: safeLimit,
  };
}

/** Build standardised pagination metadata for an offset/limit response. */
export function buildMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/** Wrap a data array + total into a standardised paginated result. */
export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return { data, meta: buildMeta(total, page, limit) };
}
