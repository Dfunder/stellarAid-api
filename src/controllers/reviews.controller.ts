import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  createReview,
  listReviewsForUsername,
  reportReview,
} from '@/services/reviews.service';
import type { ApiResponse } from '@/types';
import type {
  CreateReviewBodySchema,
  ListReviewsQuerySchema,
  ReportReviewBodySchema,
} from '@/validators/reviews.schemas';

export const getUserReviews = catchAsync(async (req, res: Response) => {
  const { params, query } = getValidated<
    unknown,
    { username: string },
    ListReviewsQuerySchema
  >(req);
  const result = await listReviewsForUsername(params.username, {
    page: query.page,
    limit: query.limit,
    sort: query.sort,
  });
  res.status(200).json({ success: true, data: result } satisfies ApiResponse<typeof result>);
});

export const postReviewReport = catchAsync(async (req, res: Response) => {
  const { sub } = getAuthUser(req);
  const { params, body } = getValidated<
    ReportReviewBodySchema,
    { id: string },
    unknown
  >(req);
  const report = await reportReview(params.id, sub, body);
  res.status(201).json({ success: true, data: report } satisfies ApiResponse<typeof report>);
});

export const postReview = catchAsync(async (req, res: Response) => {
  const { sub } = getAuthUser(req);
  const { body } = getValidated<CreateReviewBodySchema, unknown, unknown>(req);
  const review = await createReview(sub, body);
  res.status(201).json({ success: true, data: review } satisfies ApiResponse<typeof review>);
});
