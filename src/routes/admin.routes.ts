/**
 * Admin routes (v1) — review moderation #834.
 */

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

import { createFeatureRouter } from './router-factory';

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
