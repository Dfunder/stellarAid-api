/**
 * Marketplace browse, trending, and recommended controller.
 * Marketplace browse controller.
 */

import type { Artwork } from '@prisma/client';
import type { Response } from 'express';

import { catchAsync, getValidated } from '@/middlewares';
import {
  getRecommendedArtworks,
  getTrendingArtworks,
  listPublishedArtworks,
  type ArtworkPage,
  browseArtworks,
  listFeaturedArtworks,
  listTrendingArtworks,
  type BrowsePage,
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
  async (req, res: Response<ApiResponse<BrowsePage>>) => {
    const { query } = getValidated<unknown, unknown, MarketplaceListSchema>(req);
    const result = await browseArtworks(
      {
        category: query.category,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        asset: query.asset,
        verifiedOnly: query.verifiedOnly,
      },
      query.sort,
      query.cursor,
      query.limit,
    );
    res.status(200).json({ success: true, data: result });
  },
);

/** GET /api/v1/marketplace/trending */
export const getTrending = catchAsync(
  async (_req, res: Response<ApiResponse<readonly Artwork[]>>) => {
    const items = await getTrendingArtworks();
/** GET /api/v1/marketplace/featured */
export const getFeatured = catchAsync(
  async (_req, res: Response<ApiResponse<readonly Artwork[]>>) => {
    const items = await listFeaturedArtworks();
    res.status(200).json({ success: true, data: items });
  },
);

/** GET /api/v1/marketplace/recommended */
export const getRecommended = catchAsync(
  async (_req, res: Response<ApiResponse<readonly Artwork[]>>) => {
    const items = await getRecommendedArtworks();
/** GET /api/v1/marketplace/trending */
export const getTrending = catchAsync(
  async (_req, res: Response<ApiResponse<readonly Artwork[]>>) => {
    const items = await listTrendingArtworks();
    res.status(200).json({ success: true, data: items });
  },
);
