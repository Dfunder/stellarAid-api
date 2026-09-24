/**
 * Artwork detail, view tracking, and save/unsave.
 */

import type { Artwork } from '@prisma/client';
import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  getArtworkById,
  recordArtworkView,
  toggleArtworkSave,
  type RecordViewResult,
  type ToggleSaveResult,
} from '@/services';
import type { ApiResponse } from '@/types';
import type { ArtworkIdParamsSchema } from '@/validators';

/** GET /api/v1/artworks/:id */
export const getArtwork = catchAsync(async (req, res: Response<ApiResponse<Artwork>>) => {
  const { params } = getValidated<unknown, ArtworkIdParamsSchema, unknown>(req);
  const artwork = await getArtworkById(params.id);
  res.status(200).json({ success: true, data: artwork });
});

/** POST /api/v1/artworks/:id/view */
export const postArtworkView = catchAsync(
  async (req, res: Response<ApiResponse<RecordViewResult>>) => {
    const { sub } = getAuthUser(req);
    const { params } = getValidated<unknown, ArtworkIdParamsSchema, unknown>(req);
    const result = await recordArtworkView(sub, params.id);
    res.status(200).json({ success: true, data: result });
  },
);

/** POST /api/v1/artworks/:id/save (toggle) */
export const postArtworkSave = catchAsync(
  async (req, res: Response<ApiResponse<ToggleSaveResult>>) => {
    const { sub } = getAuthUser(req);
    const { params } = getValidated<unknown, ArtworkIdParamsSchema, unknown>(req);
    const result = await toggleArtworkSave(sub, params.id);
    res.status(200).json({ success: true, data: result });
  },
);
