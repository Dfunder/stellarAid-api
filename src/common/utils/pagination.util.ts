export interface PaginateQuery<T> {
  page?: number | string;
  limit?: number | string;
  fetch: (args: { skip: number; take: number }) => Promise<T[]>;
  count: () => Promise<number>;
}

export async function paginate<T>(query: PaginateQuery<T>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    query.fetch({ skip, take: limit }),
    query.count(),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
