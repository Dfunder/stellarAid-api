import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  deleteReview,
  toReviewResponse,
  updateReview,
} from '@/services/reviews.service';
import type { ApiResponse } from '@/types';
import type { ReviewIdParams, UpdateReviewBody } from '@/validators/reviews.schemas';

/** PATCH /api/v1/reviews/:id */
export const patchReview = catchAsync(async (req, res: Response<ApiResponse<unknown>>) => {
  const { sub } = getAuthUser(req);
  const { params, body } = getValidated<UpdateReviewBody, ReviewIdParams, unknown>(req);
  const review = await updateReview(params.id, sub, body);
  res.status(200).json({
    success: true,
    data: toReviewResponse(review),
  });
});

/** DELETE /api/v1/reviews/:id */
export const removeReview = catchAsync(async (req, res: Response<ApiResponse<unknown>>) => {
  const { sub } = getAuthUser(req);
  const { params } = getValidated<unknown, ReviewIdParams, unknown>(req);
  const result = await deleteReview(params.id, sub);
  res.status(200).json({ success: true, data: result });
});
