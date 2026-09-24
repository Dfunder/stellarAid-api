/**
 * Artworks controller — CRUD, publishing, and detail lookup.
 */

import type { Artwork } from '@prisma/client';
import type { Response } from 'express';

import { catchAsync, getAuthUser, getOptionalAuthUser, getValidated } from '@/middlewares';
import {
  createArtwork,
  deleteArtwork,
  getArtworkDetail,
  setArtworkPublished,
  updateArtwork,
  type ArtworkDetail,
} from '@/services';
import type { ApiResponse } from '@/types';
import type {
  ArtworkIdParamsSchema,
  ArtworkSchema,
  SetArtworkPublishedSchema,
  UpdateArtworkSchema,
} from '@/validators';

/** POST /api/v1/artworks */
export const postArtwork = catchAsync(async (req, res: Response<ApiResponse<Artwork>>) => {
  const { sub } = getAuthUser(req);
  const { body } = getValidated<ArtworkSchema, unknown, unknown>(req);
  const artwork = await createArtwork(sub, body);
  res.status(201).json({ success: true, data: artwork });
});

/** PATCH /api/v1/artworks/:id */
export const patchArtwork = catchAsync(async (req, res: Response<ApiResponse<Artwork>>) => {
  const { sub } = getAuthUser(req);
  const { params, body } = getValidated<UpdateArtworkSchema, ArtworkIdParamsSchema, unknown>(req);
  const artwork = await updateArtwork(sub, params.id, body);
  res.status(200).json({ success: true, data: artwork });
});

/** PATCH /api/v1/artworks/:id/publish */
export const patchArtworkPublished = catchAsync(
  async (req, res: Response<ApiResponse<Artwork>>) => {
    const { sub } = getAuthUser(req);
    const { params, body } = getValidated<
      SetArtworkPublishedSchema,
      ArtworkIdParamsSchema,
      unknown
    >(req);
    const artwork = await setArtworkPublished(sub, params.id, body.published);
    res.status(200).json({ success: true, data: artwork });
  },
);

/** DELETE /api/v1/artworks/:id */
export const removeArtwork = catchAsync(async (req, res: Response<ApiResponse<null>>) => {
  const { sub } = getAuthUser(req);
  const { params } = getValidated<unknown, ArtworkIdParamsSchema, unknown>(req);
  await deleteArtwork(sub, params.id);
  res.status(204).send();
});

/**
 * GET /api/v1/artworks/:id — public detail lookup. Records a debounced view
 * for the caller when a valid access token is present; anonymous requests
 * still get the full detail payload, just without view tracking.
 */
export const getArtwork = catchAsync(async (req, res: Response<ApiResponse<ArtworkDetail>>) => {
  const { params } = getValidated<unknown, ArtworkIdParamsSchema, unknown>(req);
  const viewer = getOptionalAuthUser(req);
  const detail = await getArtworkDetail(params.id, viewer?.sub);
  res.status(200).json({ success: true, data: detail });
});
