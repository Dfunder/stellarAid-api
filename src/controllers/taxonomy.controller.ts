/**
 * Category and tag controller.
 */

import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  createTag,
  listCategories,
  listPopularTags,
  syncArtworkTags,
  type CategoryNode,
  type TagRecord,
} from '@/services';
import type { ApiResponse } from '@/types';
import type {
  ArtworkParamsSchema,
  CreateTagSchema,
  SyncArtworkTagsSchema,
  TagListQuerySchema,
} from '@/validators';

/** GET /api/v1/categories */
export const getCategories = catchAsync(
  async (_req, res: Response<ApiResponse<CategoryNode[]>>) => {
    const categories = await listCategories();
    res.status(200).json({ success: true, data: categories });
  },
);

/** GET /api/v1/tags */
export const getTags = catchAsync(async (req, res: Response<ApiResponse<TagRecord[]>>) => {
  const { query } = getValidated<unknown, unknown, TagListQuerySchema>(req);
  const tags = await listPopularTags(query.limit);
  res.status(200).json({ success: true, data: tags });
});

/** POST /api/v1/tags */
export const postTag = catchAsync(async (req, res: Response<ApiResponse<TagRecord>>) => {
  getAuthUser(req); // authenticated, but any signed-in user may create a tag
  const { body } = getValidated<CreateTagSchema, unknown, unknown>(req);
  const tag = await createTag(body.name);
  res.status(201).json({ success: true, data: tag });
});

/** PUT /api/v1/artworks/:id/tags */
export const putArtworkTags = catchAsync(
  async (req, res: Response<ApiResponse<{ tags: readonly string[] }>>) => {
    const { sub } = getAuthUser(req);
    const { params, body } = getValidated<SyncArtworkTagsSchema, ArtworkParamsSchema, unknown>(
      req,
    );
    const tags = await syncArtworkTags(sub, params.id, body.tags);
    res.status(200).json({ success: true, data: { tags } });
  },
);
