/**
 * Saved/favorites controller.
 */

import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  listSavedArtworks,
  toggleArtworkSave,
  type PaginatedResult,
  type SavedArtworkSummary,
  type ToggleSaveResult,
} from '@/services';
import type { ApiResponse } from '@/types';
import type { ArtworkParamsSchema, PaginationSchema } from '@/validators';

/** POST /api/v1/artworks/:id/save and DELETE /api/v1/artworks/:id/save — both toggle. */
export const toggleSave = catchAsync(
  async (req, res: Response<ApiResponse<ToggleSaveResult>>) => {
    const { sub } = getAuthUser(req);
    const { params } = getValidated<unknown, ArtworkParamsSchema, unknown>(req);
    const result = await toggleArtworkSave(sub, params.id);
    res.status(200).json({ success: true, data: result });
  },
);

/** GET /api/v1/users/me/saves */
export const getMySaves = catchAsync(
  async (req, res: Response<ApiResponse<PaginatedResult<SavedArtworkSummary>>>) => {
    const { sub } = getAuthUser(req);
    const { query } = getValidated<unknown, unknown, PaginationSchema>(req);
    const result = await listSavedArtworks(sub, query.page, query.limit);
    res.status(200).json({ success: true, data: result });
  },
);
