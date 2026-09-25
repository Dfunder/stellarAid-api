/**
 * Platform stats routes (v1).
 *
 * @openapi
 * /api/v1/stats:
 *   get:
 *     summary: Public platform metrics
 *     description: >
 *       Aggregate counts only — no per-user data. Cached in Redis for an
 *       hour, so values are accurate to within an hour of a change.
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: Platform stats
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlatformStatsResponse'
 */

import { getStats } from '@/controllers';

import { createFeatureRouter } from './router-factory';

export const statsRouter = createFeatureRouter('stats');

statsRouter.get('/', getStats);
