/**
 * Artwork search controller.
 * Search controller.
 */

import type { Response } from 'express';

import { catchAsync, getValidated } from '@/middlewares';
import { searchArtworks, type SearchPage } from '@/services';
import type { ApiResponse } from '@/types';
import type { SearchQuerySchema } from '@/validators';

/** GET /api/v1/search */
export const getSearch = catchAsync(async (req, res: Response<ApiResponse<SearchPage>>) => {
  const { query } = getValidated<unknown, unknown, SearchQuerySchema>(req);
  const result = await searchArtworks(
    query.q,
    {
      category: query.category,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      asset: query.asset,
    },
    query.cursor,
    query.limit,
  );
  res.status(200).json({ success: true, data: result });
});
