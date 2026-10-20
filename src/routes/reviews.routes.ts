/**
 * Reviews routes (v1) — list, report, create, update, delete (#832–#835).
 *
 * @openapi
 * /api/v1/reviews:
 *   post:
 *     summary: Create a review
 *     tags: [Reviews]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, description: Review fields for a completed order or commission. }
 *     responses:
 *       201:
 *         description: Review created
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 * /api/v1/reviews/{id}:
 *   patch:
 *     summary: Update a review
 *     tags: [Reviews]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, description: Fields to update on the review. }
 *     responses:
 *       200:
 *         description: Review updated
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 *   delete:
 *     summary: Delete a review
 *     tags: [Reviews]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Review deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 * /api/v1/reviews/{id}/report:
 *   post:
 *     summary: Report a review
 *     tags: [Reviews]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, description: Report reason and optional details. }
 *     responses:
 *       201:
 *         description: Review report created
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 */

import { createFeatureRouter } from './router-factory';
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
