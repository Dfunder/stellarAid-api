import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  listReportedReviews,
  moderateReviewById,
} from '@/services/reviews.service';
import type { ApiResponse } from '@/types';
import type {
  ModerateReviewBodySchema,
  ReportedReviewsQuerySchema,
} from '@/validators/reviews.schemas';

/** GET /api/v1/admin/reviews/reported (#834) */
export const getReportedReviews = catchAsync(async (req, res: Response) => {
  const { query } = getValidated<unknown, unknown, ReportedReviewsQuerySchema>(req);
  const result = await listReportedReviews({
    status: query.status,
    page: query.page,
    limit: query.limit,
  });
  res.status(200).json({ success: true, data: result } satisfies ApiResponse<typeof result>);
});

/** PATCH /api/v1/admin/reviews/:id (#834) */
export const patchAdminReview = catchAsync(async (req, res: Response) => {
  const { sub } = getAuthUser(req);
  const { params, body } = getValidated<
    ModerateReviewBodySchema,
    { id: string },
    unknown
  >(req);
  const result = await moderateReviewById(params.id, sub, body.action, body.note);
  res.status(200).json({ success: true, data: result } satisfies ApiResponse<typeof result>);
});
