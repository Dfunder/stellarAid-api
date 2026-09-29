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
 * /api/v1/commissions/{id}/disputes:
 *   post:
 *     summary: Dispute the final delivery of a commission
 *     description: >-
 *       Client only, and only once the commission is DELIVERED. Records the
 *       reason and any evidence, moves the commission to DISPUTED — which
 *       holds escrow, so it can't be completed or cancelled until an admin
 *       resolves the dispute — and notifies every admin.
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
 *             $ref: '#/components/schemas/CreateCommissionDisputeRequest'
 *     responses:
 *       201:
 *         description: Dispute raised
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionDisputeResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller is not the client
 *       404:
 *         description: Commission not found
 *       409:
 *         description: Not delivered yet, or already disputed
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 * /api/v1/commissions/{id}/disputes/resolve:
 *   post:
 *     summary: Resolve a disputed commission
 *     description: >-
 *       Admin only. `RELEASE_TO_ARTIST` completes the commission and pays
 *       the artist, `REFUND_CLIENT` cancels it and refunds the client, and
 *       `REJECT` returns it to DELIVERED. Both parties are notified.
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
 *             required: [decision]
 *             properties:
 *               decision:
 *                 type: string
 *                 enum: [RELEASE_TO_ARTIST, REFUND_CLIENT, REJECT]
 *               resolution: { type: string, maxLength: 2000 }
 *     responses:
 *       200:
 *         description: Resolved dispute and resulting commission
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller is not an admin
 *       404:
 *         description: Commission or dispute not found
 *       409:
 *         description: The dispute has already been resolved
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
import {
  getCommissionById,
  patchCommissionStatus,
  postCommission,
  postCommissionDispute,
  postCommissionDisputeResolution,
} from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import {
  commissionBodySchema,
  commissionDisputeBodySchema,
  commissionDisputeResolveBodySchema,
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

commissionsRouter.post(
  '/:id/disputes',
  authenticate,
  validate({ params: commissionStatusParamsSchema, body: commissionDisputeBodySchema }),
  postCommissionDispute,
);

commissionsRouter.post(
  '/:id/disputes/resolve',
  authenticate,
  validate({ params: commissionStatusParamsSchema, body: commissionDisputeResolveBodySchema }),
  postCommissionDisputeResolution,
);
