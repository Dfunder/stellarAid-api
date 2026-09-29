import type { Response } from 'express';

import { AppError, catchAsync, getAuthUser, getValidated } from '@/middlewares';
import {
  listReportedReviews,
  moderateReviewById,
} from '@/services/reviews.service';
import { prisma } from '@/services/prisma.service';
import type { ApiResponse } from '@/types';
import type {
  ModerateReviewBodySchema,
  ReportedReviewsQuerySchema,
} from '@/validators/reviews.schemas';

async function assertAdmin(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user === null || user.role !== 'ADMIN') {
    throw new AppError('FORBIDDEN', 'Admin access required');
  }
}

/** GET /api/v1/admin/reviews/reported (#834) */
export const getReportedReviews = catchAsync(async (req, res: Response) => {
  const { sub } = getAuthUser(req);
  await assertAdmin(sub);
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
  await assertAdmin(sub);
  const { params, body } = getValidated<
    ModerateReviewBodySchema,
    { id: string },
    unknown
  >(req);
  const result = await moderateReviewById(params.id, sub, body.action, body.note);
  res.status(200).json({ success: true, data: result } satisfies ApiResponse<typeof result>);
});
