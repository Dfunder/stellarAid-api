import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  createReview,
  deleteReview,
  editReview,
  listReviewsForUsername,
  reportReview,
  toPublicReview,
} from '@/services/reviews.service';
import type { ApiResponse } from '@/types';
import type {
  CreateReviewBodySchema,
  ListReviewsQuerySchema,
  ReportReviewBodySchema,
  UpdateReviewBodySchema,
} from '@/validators/reviews.schemas';

export const getUserReviews = catchAsync(async (req, res: Response) => {
  const { params, query } = getValidated<unknown, { username: string }, ListReviewsQuerySchema>(
    req,
  );
  const result = await listReviewsForUsername(params.username, {
    page: query.page,
    limit: query.limit,
    sort: query.sort,
  });
  res.status(200).json({ success: true, data: result } satisfies ApiResponse<typeof result>);
});

export const postReviewReport = catchAsync(async (req, res: Response) => {
  const { sub } = getAuthUser(req);
  const { params, body } = getValidated<ReportReviewBodySchema, { id: string }, unknown>(req);
  const report = await reportReview(params.id, sub, body);
  res.status(201).json({ success: true, data: report } satisfies ApiResponse<typeof report>);
});

export const postReview = catchAsync(async (req, res: Response) => {
  const { sub } = getAuthUser(req);
  const { body } = getValidated<CreateReviewBodySchema, unknown, unknown>(req);
  const result = await createReview(sub, body);
  res.status(201).json({ success: true, data: result } satisfies ApiResponse<typeof result>);
});

/** PATCH /api/v1/reviews/:id (#833) */
export const patchReview = catchAsync(async (req, res: Response) => {
  const { sub } = getAuthUser(req);
  const { params, body } = getValidated<UpdateReviewBodySchema, { id: string }, unknown>(req);
  const review = await editReview(params.id, sub, body);
  res.status(200).json({
    success: true,
    data: toPublicReview({ ...review, author: null }),
  } satisfies ApiResponse<unknown>);
});

/** DELETE /api/v1/reviews/:id (#833) */
export const removeReview = catchAsync(async (req, res: Response) => {
  const { sub } = getAuthUser(req);
  const { params } = getValidated<unknown, { id: string }, unknown>(req);
  const result = await deleteReview(params.id, sub);
  res.status(200).json({ success: true, data: result } satisfies ApiResponse<typeof result>);
});
