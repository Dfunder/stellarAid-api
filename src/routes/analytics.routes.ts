/**
 * Analytics routes (v1).
 *
 * @openapi
 * /api/v1/analytics/events:
 *   post:
 *     summary: Ingest a batch of product-analytics events
 *     description: >
 *       Accepts 1-100 events per request. `properties` is rejected (422)
 *       if it contains a key that looks like PII (email, password, phone,
 *       etc.). Rate limited to 30 requests/minute per IP.
 *     tags: [Analytics]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AnalyticsEventBatchRequest'
 *     responses:
 *       202:
 *         description: Events accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, enum: [true] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     accepted: { type: integer }
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */

import { postAnalyticsEvents } from '@/controllers';
import { analyticsLimiter, validate } from '@/middlewares';
import { analyticsEventBatchSchema } from '@/validators';

import { createFeatureRouter } from './router-factory';

export const analyticsRouter = createFeatureRouter('analytics');

analyticsRouter.post(
  '/events',
  analyticsLimiter,
  validate({ body: analyticsEventBatchSchema }),
  postAnalyticsEvents,
);
