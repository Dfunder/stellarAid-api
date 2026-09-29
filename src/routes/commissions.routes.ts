/**
 * Commissions routes (v1).
 *
 * @openapi
 * /api/v1/commissions/{id}:
 *   get:
 *     summary: Get a commission with its full timeline
 *     description: >-
 *       Returns the commission, both parties, every deliverable and review,
 *       and a timeline of status changes (oldest first) built from the
 *       append-only `CommissionEvent` audit trail. Only the client, the
 *       artist or an admin can read it; anyone else gets 403.
 *     tags: [Commissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Commission detail with timeline
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionDetailResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller is not a participant of this commission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Commission not found
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 * /api/v1/commissions/{id}/status:
 *   patch:
 *     summary: Advance or cancel a commission
 *     description: >-
 *       Artist: PENDING → ACCEPTED → IN_PROGRESS → DELIVERED. Client:
 *       DELIVERED → COMPLETED (a review is required) or DELIVERED →
 *       DISPUTED. Either party may CANCELLED a commission that hasn't been
 *       delivered yet.
 *     tags: [Commissions]
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
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACCEPTED, IN_PROGRESS, DELIVERED, COMPLETED, DISPUTED, CANCELLED]
 *               review:
 *                 type: object
 *                 required: [rating, body]
 *                 description: Required when status is COMPLETED.
 *                 properties:
 *                   rating: { type: integer, minimum: 1, maximum: 5 }
 *                   title: { type: string, maxLength: 120 }
 *                   body: { type: string, maxLength: 2000 }
 *     responses:
 *       200:
 *         description: Updated commission
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller is not a participant of this commission
 *       404:
 *         description: Commission not found
 *       409:
 *         description: Transition is not allowed from the current status
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 */

import { createFeatureRouter } from './router-factory';
import { getCommissionById, patchCommissionStatus, postCommission } from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import {
  commissionBodySchema,
  commissionStatusBodySchema,
  commissionStatusParamsSchema,
} from '@/validators';

export const commissionsRouter = createFeatureRouter('commissions');

commissionsRouter.post('/', authenticate, validate({ body: commissionBodySchema }), postCommission);

commissionsRouter.get(
  '/:id',
  authenticate,
  validate({ params: commissionStatusParamsSchema }),
  getCommissionById,
);

commissionsRouter.patch(
  '/:id/status',
  authenticate,
  validate({ params: commissionStatusParamsSchema, body: commissionStatusBodySchema }),
  patchCommissionStatus,
);
