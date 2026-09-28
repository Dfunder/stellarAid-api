/**
 * Reviews routes (v1) — #833 update/delete.
 */

import { patchReview, removeReview } from '@/controllers/reviews.controller';
import { authenticate, validate } from '@/middlewares';
import {
  reviewIdParamsSchema,
  updateReviewBodySchema,
} from '@/validators/reviews.schemas';

import { createFeatureRouter } from './router-factory';

export const reviewsRouter = createFeatureRouter('reviews');

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
