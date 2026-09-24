/**
 * Marketplace browse, trending, and recommended controller.
 */

import type { Artwork } from '@prisma/client';
import type { Response } from 'express';

import { catchAsync, getValidated } from '@/middlewares';
import {
  getRecommendedArtworks,
  getTrendingArtworks,
  listPublishedArtworks,
  type ArtworkPage,
} from '@/services';
import type { ApiResponse } from '@/types';
import type { MarketplaceListSchema } from '@/validators';

/** GET /api/v1/marketplace */
export const getMarketplace = catchAsync(
  async (req, res: Response<ApiResponse<ArtworkPage>>) => {
    const { query } = getValidated<unknown, unknown, MarketplaceListSchema>(req);
    const result = await listPublishedArtworks(
      { category: query.category },
      query.page,
      query.limit,
    );
    res.status(200).json({ success: true, data: result });
  },
);

/** GET /api/v1/marketplace/trending */
export const getTrending = catchAsync(
  async (_req, res: Response<ApiResponse<readonly Artwork[]>>) => {
    const items = await getTrendingArtworks();
    res.status(200).json({ success: true, data: items });
  },
);

/** GET /api/v1/marketplace/recommended */
export const getRecommended = catchAsync(
  async (_req, res: Response<ApiResponse<readonly Artwork[]>>) => {
    const items = await getRecommendedArtworks();
    res.status(200).json({ success: true, data: items });
  },
);
