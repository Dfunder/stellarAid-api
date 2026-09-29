/**
 * Reviews routes (v1) — list, report, create, update, delete (#832–#835).
 */

import { createFeatureRouter } from './router-factory';
import { postReview, postReviewReport } from '@/controllers/reviews.controller';
import {
  getUserReviews,
  patchReview,
  postReview,
  postReviewReport,
  removeReview,
} from '@/controllers/reviews.controller';
import { authenticate, validate } from '@/middlewares';
import {
  createReviewBodySchema,
  reportReviewBodySchema,
  reviewIdParamsSchema,
  updateReviewBodySchema,
} from '@/validators/reviews.schemas';

export const reviewsRouter = createFeatureRouter('reviews');

reviewsRouter.post('/', authenticate, validate({ body: createReviewBodySchema }), postReview);

reviewsRouter.patch(
  '/:id',
  authenticate,
  validate({ params: reviewIdParamsSchema, body: updateReviewBodySchema }),
  patchReview,
);

reviewsRouter.delete(
  '/:id',
  authenticate,
  validate({ params: reviewIdParamsSchema }),
  removeReview,
);

reviewsRouter.post(
  '/:id/report',
  authenticate,
  validate({ params: reviewIdParamsSchema, body: reportReviewBodySchema }),
  postReviewReport,
);

// Note: public list by username is mounted from users/profiles routes if present.
export { getUserReviews, listReviewsParamsSchema, listReviewsQuerySchema };
