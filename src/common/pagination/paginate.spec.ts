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
});
