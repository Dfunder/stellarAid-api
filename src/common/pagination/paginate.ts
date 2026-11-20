export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PageRequest {
  limit: number;
  offset: number;
}

export interface Page<T> {
  items: T[];
  limit: number;
  offset: number;
  hasNext: boolean;
}

function toInt(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) ? n : fallback;
}

/** Parse untrusted `limit`/`offset` query values into bounded numbers. */
export function parsePageRequest(query: {
  limit?: unknown;
  offset?: unknown;
}): PageRequest {
  const limit = Math.min(
    Math.max(toInt(query.limit, DEFAULT_PAGE_SIZE), 1),
    MAX_PAGE_SIZE,
  );
  const offset = Math.max(toInt(query.offset, 0), 0);
  return { limit, offset };
}

/**
 * Fetch `limit + 1` rows from the data source, then pass them here: the extra
 * row tells us whether another page exists without a COUNT query.
 */
export function toPage<T>(rows: T[], request: PageRequest): Page<T> {
  return {
    items: rows.slice(0, request.limit),
    limit: request.limit,
    offset: request.offset,
    hasNext: rows.length > request.limit,
  };
}

/** Value to pass as the data source's `take` so `toPage` can detect hasNext. */
export function takeForPage(request: PageRequest): number {
  return request.limit + 1;
}
