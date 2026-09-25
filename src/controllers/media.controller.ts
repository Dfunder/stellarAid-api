/**
 * Media controller.
 */

import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  confirmMediaUpload,
  getMediaRecord,
  presignMediaUpload,
  type MediaRecord,
  type PresignUploadResult,
} from '@/services';
import type { ApiResponse } from '@/types';
import type { MediaIdParamsSchema, PresignUploadSchema } from '@/validators';

/** POST /api/v1/media/presign */
export const presignUpload = catchAsync(
  async (req, res: Response<ApiResponse<PresignUploadResult>>) => {
    const { sub } = getAuthUser(req);
    const { body } = getValidated<PresignUploadSchema, unknown, unknown>(req);
    const result = await presignMediaUpload(sub, body);
    res.status(201).json({ success: true, data: result });
  },
);

/** POST /api/v1/media/:id/complete */
export const completeUpload = catchAsync(
  async (req, res: Response<ApiResponse<MediaRecord>>) => {
    const { sub } = getAuthUser(req);
    const { params } = getValidated<unknown, MediaIdParamsSchema, unknown>(req);
    const media = await confirmMediaUpload(sub, params.id);
    res.status(200).json({ success: true, data: media });
  },
);

/** GET /api/v1/media/:id */
export const getMedia = catchAsync(async (req, res: Response<ApiResponse<MediaRecord>>) => {
  const { params } = getValidated<unknown, MediaIdParamsSchema, unknown>(req);
  const media = await getMediaRecord(params.id);
  res.status(200).json({ success: true, data: media });
});
