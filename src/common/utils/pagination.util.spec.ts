import { paginate } from './pagination.util';

describe('PaginationUtil', () => {
  it('should paginate items with default page and limit', async () => {
    const mockData = [{ id: 1 }, { id: 2 }];
    const fetch = jest.fn().mockResolvedValue(mockData);
    const count = jest.fn().mockResolvedValue(10);

    const result = await paginate({ fetch, count });

    expect(fetch).toHaveBeenCalledWith({ skip: 0, take: 20 });
    expect(count).toHaveBeenCalled();
    expect(result).toEqual({
      data: mockData,
      meta: {
        total: 10,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    });
  });

  it('should handle custom page and limit numbers and calculate skip correctly', async () => {
    const mockData = [{ id: 21 }, { id: 22 }];
    const fetch = jest.fn().mockResolvedValue(mockData);
    const count = jest.fn().mockResolvedValue(45);

    const result = await paginate({
      page: 3,
      limit: 10,
      fetch,
      count,
    });

    expect(fetch).toHaveBeenCalledWith({ skip: 20, take: 10 });
    expect(result.meta).toEqual({
      total: 45,
      page: 3,
      limit: 10,
      totalPages: 5,
    });
  });

  it('should sanitize negative or string page/limit inputs', async () => {
    const fetch = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);

    const result = await paginate({
      page: '-5',
      limit: '150', // clamped to 100 max
      fetch,
      count,
    });

    expect(fetch).toHaveBeenCalledWith({ skip: 0, take: 100 });
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(100);
  });
});
