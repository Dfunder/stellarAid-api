import { clampOffset, MAX_SEARCH_OFFSET, withTiebreaker } from './search-query';

describe('search-query', () => {
  it('clamps offsets', () => {
    expect(clampOffset(-5)).toBe(0);
    expect(clampOffset(1e9)).toBe(MAX_SEARCH_OFFSET);
    expect(clampOffset(Number.NaN)).toBe(0);
  });

  it('appends an id tiebreaker once', () => {
    const once = withTiebreaker([{ createdAt: 'desc' }]);
    expect(once).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
    expect(withTiebreaker(once)).toEqual(once);
  });
});
