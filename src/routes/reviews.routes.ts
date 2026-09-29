/**
 * Reviews routes (v1) — create and report (#831, #835).
 *
 * Listing a user's reviews lives on the users router
 * (`GET /api/v1/users/{username}/reviews`), which owns the username lookup.
 *
 * @openapi
 * /api/v1/reviews:
 *   post:
 *     summary: Review a completed order or commission
 *     description: >
 *       Submits a review for a purchase or commission that has already been
 *       completed. The reviewed artist is derived from the order/commission —
 *       its seller or artist — so only the buyer of that order, or the client
 *       of that commission, can review it, and `targetId` in the body is
 *       ignored. One review is allowed per order and per commission (409 on a
 *       second attempt), and the artist's average rating is recalculated
 *       immediately.
 *     tags: [Reviews]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReviewRequest'
 *           examples:
 *             order:
 *               summary: Review a purchased artwork
 *               value:
 *                 orderId: 3f1c9a4e-5b7d-4c2a-9f0e-1a2b3c4d5e6f
 *                 rating: 5
 *                 title: Excellent work
 *                 body: Matched the description and shipped quickly.
 *             commission:
 *               summary: Review a finished commission
 *               value:
 *                 commissionId: 7c2e1b90-2a4f-4d3b-8c5e-0f9a8b7c6d5e
 *                 rating: 4
 *                 body: Great communication, one revision round.
 *     responses:
 *       201:
 *         description: Review created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReviewResponse'
 *       400:
 *         description: >
 *           Missing `orderId`/`commissionId`, both provided, or the
 *           order/commission is not completed yet.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: { code: BAD_REQUEST, message: You can only review a completed order }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: The caller is not the buyer/client of that order/commission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: { code: FORBIDDEN, message: You can only review your own orders }
 *       404:
 *         description: Order or commission not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: { code: NOT_FOUND, message: Order not found }
 *       409:
 *         description: A review already exists for this order or commission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: { code: CONFLICT, message: A review already exists for this order or commission }
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 */

import { createFeatureRouter } from './router-factory';
import { postReview, postReviewReport } from '@/controllers/reviews.controller';
import { authenticate, validate } from '@/middlewares';
import {
  createReviewBodySchema,
  reportReviewBodySchema,
  reviewIdParamsSchema,
} from '@/validators/reviews.schemas';

export const reviewsRouter = createFeatureRouter('reviews');

reviewsRouter.post('/', authenticate, validate({ body: createReviewBodySchema }), postReview);

reviewsRouter.post(
  '/:id/report',
  authenticate,
  validate({ params: reviewIdParamsSchema, body: reportReviewBodySchema }),
  postReviewReport,
);
