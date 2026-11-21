export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PageRequest {
  limit: number;
  offset: number;
}

/**
 * Standard list response. Every field is always present, so clients and
 * assistive technology never have to guess whether a field was omitted or is
 * not applicable. "Not applicable" is always an explicit `null`.
 *
 * Field meanings:
 * - `items`: the rows on this page, at most `limit` of them.
 * - `limit`: the maximum number of items requested for this page.
 * - `offset`: how many items were skipped before the first item on this page.
 * - `count`: the number of items on this page (`items.length`).
 * - `hasNext`: true when at least one more item exists after this page.
 * - `hasPrevious`: true when `offset` is greater than 0.
 * - `nextOffset`: the `offset` to request for the next page, or `null` when
 *   `hasNext` is false.
 * - `previousOffset`: the `offset` to request for the previous page, or `null`
 *   when `hasPrevious` is false.
 * - `total`: the number of items across all pages, or `null` when the data
 *   source did not compute it (counting can be expensive, so it is optional).
 *
 * Example response for `GET /api/v1/campaigns?limit=2&offset=2`, where the
 * source has 5 matching campaigns and a total was computed:
 *
 * ```json
 * {
 *   "items": [{ "id": "c3" }, { "id": "c4" }],
 *   "limit": 2,
 *   "offset": 2,
 *   "count": 2,
 *   "hasNext": true,
 *   "hasPrevious": true,
 *   "nextOffset": 4,
 *   "previousOffset": 0,
 *   "total": 5
 * }
 * ```
 */
export interface Page<T> {
  items: T[];
  limit: number;
  offset: number;
  count: number;
  hasNext: boolean;
  hasPrevious: boolean;
  nextOffset: number | null;
  previousOffset: number | null;
  total: number | null;
}

export interface PageOptions {
  /** Total number of items across all pages, when the data source counted. */
  total?: number;
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
 * row tells us whether another page exists without a COUNT query. If the data
 * source also computed a total, pass it as `options.total` and `hasNext` is
 * derived from it instead.
 *
 * @throws RangeError when `options.total` is not a non-negative integer.
 */
export function toPage<T>(
  rows: T[],
  request: PageRequest,
  options: PageOptions = {},
): Page<T> {
  const { total } = options;
  if (total !== undefined && (!Number.isInteger(total) || total < 0)) {
    throw new RangeError('total must be a non-negative integer');
  }

  const items = rows.slice(0, request.limit);
  const hasNext =
    total === undefined
      ? rows.length > request.limit
      : request.offset + items.length < total;
  const hasPrevious = request.offset > 0;

  return {
    items,
    limit: request.limit,
    offset: request.offset,
    count: items.length,
    hasNext,
    hasPrevious,
    nextOffset: hasNext ? request.offset + items.length : null,
    previousOffset: hasPrevious
      ? Math.max(request.offset - request.limit, 0)
      : null,
    total: total ?? null,
  };
}

/** Value to pass as the data source's `take` so `toPage` can detect hasNext. */
export function takeForPage(request: PageRequest): number {
  return request.limit + 1;
}
