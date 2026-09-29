/**
 * Admin routes (v1).
 *
 * @openapi
 * /api/v1/admin/commissions/disputes:
 *   get:
 *     summary: List commission disputes awaiting a decision
 *     description: >-
 *       Admin only. Defaults to disputes still holding escrow (OPEN/REVIEWING);
 *       pass `status` to inspect resolved or rejected ones. Each row includes
 *       the commission it belongs to so a decision can be made from one
 *       response.
 *     tags: [Commissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [OPEN, REVIEWING, RESOLVED, REJECTED]
 *     responses:
 *       200:
 *         description: Disputes awaiting a decision
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionDisputeListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller is not an admin
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 */

import { createFeatureRouter } from './router-factory';
import { getCommissionDisputes } from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import { commissionDisputeListQuerySchema } from '@/validators';

export const adminRouter = createFeatureRouter('admin');

adminRouter.get(
  '/commissions/disputes',
  authenticate,
  validate({ query: commissionDisputeListQuerySchema }),
  getCommissionDisputes,
);
