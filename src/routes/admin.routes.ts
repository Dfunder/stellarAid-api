/**
 * Admin routes (v1) — review moderation (#834).
 */

import { createFeatureRouter } from './router-factory';
import {
  getReportedReviews,
  patchAdminReview,
} from '@/controllers/review-moderation.controller';
import { authenticate, validate } from '@/middlewares';
import {
  moderateReviewBodySchema,
  reportedReviewsQuerySchema,
  reviewIdParamsSchema,
} from '@/validators/reviews.schemas';

export const adminRouter = createFeatureRouter('admin');

adminRouter.get(
  '/reviews/reported',
  authenticate,
  validate({ query: reportedReviewsQuerySchema }),
  getReportedReviews,
);

adminRouter.patch(
  '/reviews/:id',
  authenticate,
  validate({ params: reviewIdParamsSchema, body: moderateReviewBodySchema }),
  patchAdminReview,
);
