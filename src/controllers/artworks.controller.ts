/**
 * Artwork detail, view tracking, and save/unsave.
 * Artworks controller — CRUD, publishing, and detail lookup.
 * Artworks controller — CRUD, publishing, and view tracking.
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
import { catchAsync, getAuthUser, getOptionalAuthUser, getValidated } from '@/middlewares';
import {
  createArtwork,
  deleteArtwork,
  getArtworkDetail,
  setArtworkPublished,
  updateArtwork,
  type ArtworkDetail,
import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  createArtwork,
  deleteArtwork,
  recordArtworkView,
  setArtworkPublished,
  updateArtwork,
  type RecordViewResult,
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
/** POST /api/v1/artworks/:id/view */
export const postArtworkView = catchAsync(
  async (req, res: Response<ApiResponse<RecordViewResult>>) => {
    const { sub } = getAuthUser(req);
    const { params } = getValidated<unknown, ArtworkIdParamsSchema, unknown>(req);
    const result = await recordArtworkView(sub, params.id);
    res.status(200).json({ success: true, data: result });
  },
);
