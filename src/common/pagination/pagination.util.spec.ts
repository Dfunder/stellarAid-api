import { buildMeta, paginate, toSkipTake } from './pagination.util';

describe('pagination.util', () => {
  describe('toSkipTake', () => {
    it('computes skip/take for a given page', () => {
      expect(toSkipTake(3, 20)).toMatchObject({ skip: 40, take: 20 });
    });

    it('clamps invalid input to safe bounds', () => {
      expect(toSkipTake(0, 0)).toMatchObject({ page: 1, limit: 20, skip: 0 });
      expect(toSkipTake(1, 5000).take).toBe(100);
    });
  });

  describe('buildMeta', () => {
    it('computes totalPages and next/prev flags', () => {
      const meta = buildMeta(45, 2, 20);
      expect(meta).toEqual({
        total: 45,
        page: 2,
        limit: 20,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('handles the first and only page', () => {
      const meta = buildMeta(5, 1, 20);
      expect(meta.hasNext).toBe(false);
      expect(meta.hasPrev).toBe(false);
      expect(meta.totalPages).toBe(1);
    });

    it('handles an empty result set', () => {
      expect(buildMeta(0, 1, 20).totalPages).toBe(0);
    });
  });

  describe('paginate', () => {
    it('wraps data with metadata', () => {
      const res = paginate([{ id: 1 }], 1, 1, 20);
      expect(res.data).toHaveLength(1);
      expect(res.meta.total).toBe(1);
    });
  });
});
