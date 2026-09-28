import type { Response } from 'express';

import { catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  listReportedReviews,
  moderateReview,
} from '@/services/review-moderation.service';
import { toReviewResponse } from '@/services/reviews.service';
import type { ApiResponse } from '@/types';
import type {
  ModerateReviewBody,
  ReviewIdParams,
  ReportedReviewsQuery,
} from '@/validators/reviews.schemas';
import { AppError } from '@/middlewares';
import { prisma } from '@/services/prisma.service';

async function assertAdmin(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user === null || user.role !== 'ADMIN') {
    throw new AppError('FORBIDDEN', 'Admin access required');
  }
}

/** GET /api/v1/admin/reviews/reported */
export const getReportedReviews = catchAsync(
  async (req, res: Response<ApiResponse<unknown>>) => {
    const { sub } = getAuthUser(req);
    await assertAdmin(sub);
    const { query } = getValidated<unknown, unknown, ReportedReviewsQuery>(req);
    const result = await listReportedReviews({
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
    res.status(200).json({
      success: true,
      data: {
        total: result.total,
        items: result.items.map((row) => ({
          report: row.report,
          review: toReviewResponse(row.review),
        })),
      },
    });
  },
);

/** PATCH /api/v1/admin/reviews/:id */
export const patchAdminReview = catchAsync(
  async (req, res: Response<ApiResponse<unknown>>) => {
    const { sub } = getAuthUser(req);
    await assertAdmin(sub);
    const { params, body } = getValidated<
      ModerateReviewBody,
      ReviewIdParams,
      unknown
    >(req);
    const result = await moderateReview(params.id, sub, body.action, body.note);
    res.status(200).json({
      success: true,
      data: {
        review: toReviewResponse(result.review),
        reportsUpdated: result.reportsUpdated,
      },
    });
  },
);
