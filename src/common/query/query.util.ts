import { BadRequestException } from '@nestjs/common';

export type SortOrder = 'asc' | 'desc';

/**
 * Parse a `field:dir,field2:dir2` sort string into a Prisma-compatible
 * multi-field orderBy array, validating fields against an allow-list (#611).
 */
export function parseSort(
  sort: string | undefined,
  allowed: readonly string[],
): Array<Record<string, SortOrder>> {
  if (!sort) return [];
  const orderBy: Array<Record<string, SortOrder>> = [];
  for (const clause of sort
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const [field, dirRaw] = clause.split(':').map((p) => p.trim());
    if (!allowed.includes(field)) {
      throw new BadRequestException(
        `Cannot sort by '${field}'. Allowed: ${allowed.join(', ')}`,
      );
    }
    const dir = (dirRaw ?? 'asc').toLowerCase();
    if (dir !== 'asc' && dir !== 'desc') {
      throw new BadRequestException(
        `Invalid sort direction '${dirRaw ?? ''}' for '${field}'`,
      );
    }
    orderBy.push({ [field]: dir });
  }
  return orderBy;
}

/** Build a numeric range filter from optional min/max bounds (#612). */
export function rangeFilter(
  min?: number,
  max?: number,
): { gte?: number; lte?: number } | undefined {
  if (min === undefined && max === undefined) return undefined;
  return {
    ...(min !== undefined && { gte: min }),
    ...(max !== undefined && { lte: max }),
  };
}

/** Case-insensitive "contains" filter helper (#612). */
export function containsFilter(
  value?: string,
): { contains: string; mode: 'insensitive' } | undefined {
  if (!value) return undefined;
  return { contains: value, mode: 'insensitive' };
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  offset: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Standardised pagination metadata for list responses (#613). */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const totalPages = Math.ceil(total / safeLimit);
  return {
    total,
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}
