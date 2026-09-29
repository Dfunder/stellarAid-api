/**
 * Commissions routes (v1).
 *
 * @openapi
 * /api/v1/commissions/{id}/status:
 *   patch:
 *     summary: Transition a commission's status
 *     description: >
 *       Artist transitions (accept/progress/deliver) and client transitions
 *       (complete/dispute) follow the documented state machine. Cancelling
 *       requires a `reason` and is rejected once the commission is delivered.
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
 *         description: Updated commission
 *       409:
 *         description: Illegal transition for the commission's current status
 * /api/v1/commissions/{id}/deliverables:
 *   post:
 *     summary: Submit a deliverable (artist only)
 *     description: >
 *       The assigned artist submits a WIP or FINAL deliverable with an
 *       optional note and attached media ids. A FINAL submission moves the
 *       commission to DELIVERED for client review; the client is notified.
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
 *             required: [type]
 *             properties:
 *               type: { type: string, enum: [WIP, FINAL] }
 *               note: { type: string, maxLength: 2000 }
 *               mediaIds:
 *                 type: array
 *                 maxItems: 20
 *                 items: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Deliverable submitted
 *       403:
 *         description: Only the assigned artist can submit deliverables
 *       409:
 *         description: The commission is not in a submittable state
 * /api/v1/commissions/{id}/deliverables/{deliverableId}:
 *   patch:
 *     summary: Review a submitted deliverable (client only)
 *     description: >
 *       `ACCEPT` completes the commission and releases a funded escrow;
 *       `REQUEST_CHANGES` requires feedback, rejects the deliverable and
 *       increments the revision counter up to `COMMISSION_MAX_REVISIONS`.
 *       The artist is notified either way.
 *     tags: [Commissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: deliverableId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: The reviewed deliverable and updated commission
 *       400:
 *         description: Feedback is required when requesting changes
 *       403:
 *         description: Only the client can review deliverables
 *       404:
 *         description: Commission or deliverable not found
 *       409:
 *         description: Not awaiting review, or the revision cap is reached
 * /api/v1/commissions/{id}/cancel:
 *   post:
 *     summary: Cancel a commission (either party)
 *     description: >
 *       Records the reason, notifies both parties, logs the cancellation in
 *       the commission timeline and refunds a funded escrow. Only valid
 *       before delivery.
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
 *             required: [reason]
 *             properties:
 *               reason: { type: string, minLength: 3, maxLength: 1000 }
 *     responses:
 *       200:
 *         description: Cancellation result (including whether escrow was refunded)
 *       403:
 *         description: Caller does not participate in this commission
 *       404:
 *         description: Commission not found
 *       409:
 *         description: This commission can no longer be cancelled
 */

import { createFeatureRouter } from './router-factory';
import {
  patchCommissionDeliverableReview,
  patchCommissionStatus,
  postCommissionCancel,
  postCommissionDeliverable,
} from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import {
  cancelCommissionBodySchema,
  commissionStatusBodySchema,
  commissionStatusParamsSchema,
  deliverableReviewBodySchema,
  deliverableReviewParamsSchema,
  deliverableSubmissionBodySchema,
} from '@/validators';

export const commissionsRouter = createFeatureRouter('commissions');

commissionsRouter.patch(
  '/:id/status',
  authenticate,
  validate({ params: commissionStatusParamsSchema, body: commissionStatusBodySchema }),
  patchCommissionStatus,
);

commissionsRouter.post(
  '/:id/deliverables',
  authenticate,
  validate({ params: commissionStatusParamsSchema, body: deliverableSubmissionBodySchema }),
  postCommissionDeliverable,
);

commissionsRouter.patch(
  '/:id/deliverables/:deliverableId',
  authenticate,
  validate({ params: deliverableReviewParamsSchema, body: deliverableReviewBodySchema }),
  patchCommissionDeliverableReview,
);

commissionsRouter.post(
  '/:id/cancel',
  authenticate,
  validate({ params: commissionStatusParamsSchema, body: cancelCommissionBodySchema }),
  postCommissionCancel,
);
