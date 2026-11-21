import { parsePageRequest, takeForPage, toPage } from './paginate';

describe('pagination', () => {
  it('clamps limit and offset', () => {
    expect(parsePageRequest({ limit: '1000', offset: '-4' })).toEqual({
      limit: 100,
      offset: 0,
    });
    expect(parsePageRequest({})).toEqual({ limit: 20, offset: 0 });
  });

  it('reports hasNext using the extra row', () => {
    const request = { limit: 2, offset: 0 };
    expect(takeForPage(request)).toBe(3);
    expect(toPage([1, 2, 3], request)).toMatchObject({
      items: [1, 2],
      hasNext: true,
    });
    expect(toPage([1, 2], request).hasNext).toBe(false);
  });

  describe('metadata', () => {
    it('describes the first page explicitly, with null for what does not apply', () => {
      expect(toPage([1, 2, 3], { limit: 2, offset: 0 })).toEqual({
        items: [1, 2],
        limit: 2,
        offset: 0,
        count: 2,
        hasNext: true,
        hasPrevious: false,
        nextOffset: 2,
        previousOffset: null,
        total: null,
      });
    });

    it('describes a middle page, including the documented example', () => {
      expect(
        toPage([{ id: 'c3' }, { id: 'c4' }, { id: 'c5' }], {
          limit: 2,
          offset: 2,
        }),
      ).toMatchObject({
        count: 2,
        hasNext: true,
        hasPrevious: true,
        nextOffset: 4,
        previousOffset: 0,
        total: null,
      });
      expect(
        toPage(
          [{ id: 'c3' }, { id: 'c4' }],
          { limit: 2, offset: 2 },
          { total: 5 },
        ),
      ).toEqual({
        items: [{ id: 'c3' }, { id: 'c4' }],
        limit: 2,
        offset: 2,
        count: 2,
        hasNext: true,
        hasPrevious: true,
        nextOffset: 4,
        previousOffset: 0,
        total: 5,
      });
    });

    it('describes the last page and never goes below offset 0 going back', () => {
      expect(toPage([5], { limit: 2, offset: 1 })).toMatchObject({
        count: 1,
        hasNext: false,
        hasPrevious: true,
        nextOffset: null,
        previousOffset: 0,
      });
    });

    it('describes an empty result', () => {
      expect(toPage([], { limit: 20, offset: 0 }, { total: 0 })).toEqual({
        items: [],
        limit: 20,
        offset: 0,
        count: 0,
        hasNext: false,
        hasPrevious: false,
        nextOffset: null,
        previousOffset: null,
        total: 0,
      });
    });

    it('derives hasNext from total when one is supplied', () => {
      expect(
        toPage([1, 2], { limit: 2, offset: 0 }, { total: 2 }).hasNext,
      ).toBe(false);
      expect(
        toPage([1, 2], { limit: 2, offset: 0 }, { total: 3 }).hasNext,
      ).toBe(true);
    });

    it('rejects an invalid total', () => {
      const request = { limit: 2, offset: 0 };
      expect(() => toPage([], request, { total: -1 })).toThrow(RangeError);
      expect(() => toPage([], request, { total: 1.5 })).toThrow(RangeError);
      expect(() => toPage([], request, { total: Number.NaN })).toThrow(
        RangeError,
      );
    });

    it('always exposes the same set of fields', () => {
      const keys = [
        'count',
        'hasNext',
        'hasPrevious',
        'items',
        'limit',
        'nextOffset',
        'offset',
        'previousOffset',
        'total',
      ];
      const request = { limit: 2, offset: 4 };
      expect(Object.keys(toPage([1], request)).sort()).toEqual(keys);
      expect(Object.keys(toPage([1], request, { total: 5 })).sort()).toEqual(
        keys,
      );
    });
  });
});
