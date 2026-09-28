/**
 * Reviews routes (v1) — list, report, create (#832, #835).
 */

import { createFeatureRouter } from './router-factory';
import { getUserReviews, postReview, postReviewReport } from '@/controllers/reviews.controller';
import { authenticate, validate } from '@/middlewares';
import {
  createReviewBodySchema,
  listReviewsParamsSchema,
  listReviewsQuerySchema,
  reportReviewBodySchema,
  reviewIdParamsSchema,
} from '@/validators/reviews.schemas';

export const reviewsRouter = createFeatureRouter('reviews');

reviewsRouter.post(
  '/',
  authenticate,
  validate({ body: createReviewBodySchema }),
  postReview,
);

reviewsRouter.post(
  '/:id/report',
  authenticate,
  validate({ params: reviewIdParamsSchema, body: reportReviewBodySchema }),
  postReviewReport,
);
