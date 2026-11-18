export const MAX_SEARCH_OFFSET = 10_000;

/** Bound the pagination offset so deep scans cannot be requested. */
export function clampOffset(offset: number): number {
  if (!Number.isFinite(offset) || offset < 0) return 0;
  return Math.min(Math.floor(offset), MAX_SEARCH_OFFSET);
}

/**
 * Append a unique column as the final ORDER BY key. Without a tiebreaker rows
 * with equal sort values can swap places between pages, duplicating or
 * dropping results.
 */
export function withTiebreaker<K extends string>(
  orderBy: Array<Record<string, 'asc' | 'desc'>>,
  tiebreakerColumn: K = 'id' as K,
): Array<Record<string, 'asc' | 'desc'>> {
  const alreadyPresent = orderBy.some((clause) => tiebreakerColumn in clause);
  return alreadyPresent ? orderBy : [...orderBy, { [tiebreakerColumn]: 'asc' }];
}
