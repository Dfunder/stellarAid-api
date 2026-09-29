/**
 * Commissions routes (v1).
 *
 * The full lifecycle (request → accept → deliver → complete/dispute →
 * resolve) and the status machine are documented on the [Commissions tag]
 * (see `swagger.ts`); the operations below cover the request/response
 * contracts, the allowed transitions and the error cases.
 *
 * @openapi
 * /api/v1/commissions:
 *   post:
 *     summary: Request work from an artist
 *     description: >-
 *       Starts the commission flow: creates the commission in `PENDING` and
 *       notifies the artist, all in one transaction. The caller is always the
 *       client, so the body names only `artistId`. A client cannot request
 *       work from themselves (`400`), the recipient must exist (`404`) and
 *       must have the `ARTIST` role (`422`).
 *     tags: [Commissions]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCommissionRequest'
 *           examples:
 *             albumCover:
 *               summary: 250 USDC album cover
 *               value:
 *                 artistId: 3f6c1a9e-8f2b-4c1d-9a7e-2b5c8d4f6a10
 *                 title: Album cover
 *                 description: A painted cover for an upcoming album.
 *                 budget: 250
 *                 asset: USDC
 *                 deadline: '2027-01-01T00:00:00.000Z'
 *     responses:
 *       201:
 *         description: Commission created in PENDING
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionResponse'
 *             example:
 *               success: true
 *               data:
 *                 id: 8d1f4b2c-0a3e-4f5b-8c7d-1e2f3a4b5c6d
 *                 clientId: 5b2e7c41-9d38-4a6f-b0c1-7e8f9a0b1c2d
 *                 artistId: 3f6c1a9e-8f2b-4c1d-9a7e-2b5c8d4f6a10
 *                 title: Album cover
 *                 description: A painted cover for an upcoming album.
 *                 budget: '250.00'
 *                 asset: USDC
 *                 deadline: '2027-01-01T00:00:00.000Z'
 *                 status: PENDING
 *                 createdAt: '2026-09-29T09:00:00.000Z'
 *                 updatedAt: '2026-09-29T09:00:00.000Z'
 *       400:
 *         description: The caller is the requested artist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: BAD_REQUEST
 *                 message: You cannot create a commission for yourself
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: The requested artist does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: { code: NOT_FOUND, message: Artist not found }
 *       422:
 *         description: >-
 *           Validation failed, or the recipient does not have the ARTIST
 *           role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: { code: UNPROCESSABLE_ENTITY, message: The selected user is not an artist }
 * /api/v1/commissions/{id}:
 *   get:
 *     summary: Get a commission with its full timeline
 *     description: >-
 *       Returns the commission, both parties, every deliverable and review,
 *       the dispute if one exists, and a timeline of status changes (oldest
 *       first) built from the append-only `CommissionEvent` audit trail. Only
 *       the client, the artist or an admin can read it; anyone else gets 403.
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
 *             example:
 *               success: false
 *               error:
 *                 code: FORBIDDEN
 *                 message: Only the client, the artist or an admin can view this commission
 *       404:
 *         description: Commission not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: { code: NOT_FOUND, message: Commission not found }
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 * /api/v1/commissions/{id}/cancel:
 *   post:
 *     summary: Cancel a commission
 *     description: >-
 *       Either party may cancel, with a reason the other side sees, while the
 *       commission is `PENDING`, `ACCEPTED` or `IN_PROGRESS`. Once the work
 *       has been delivered it can only be completed or disputed; while a
 *       dispute is open escrow is held, so only an admin resolution may move
 *       it.
 *
 *
 *       A commission is *funded* once a confirmed transaction references it.
 *       When it is, the response reports the refund the client is owed and
 *       carries it in both notifications. The API holds no signing keys, so
 *       the on-chain `refund_client` call is the backend's to make.
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
 *             $ref: '#/components/schemas/CancelCommissionRequest'
 *           examples:
 *             scopeChanged:
 *               summary: The client's plans changed
 *               value:
 *                 reason: The brief changed on our side, we'll come back to this.
 *     responses:
 *       200:
 *         description: Commission cancelled, with the refund it owes (if any)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CancelCommissionResponse'
 *             examples:
 *               unfunded:
 *                 summary: Not funded yet — nothing to refund
 *                 value:
 *                   success: true
 *                   data:
 *                     commission:
 *                       id: 8d1f4b2c-0a3e-4f5b-8c7d-1e2f3a4b5c6d
 *                       status: CANCELLED
 *                     refund:
 *                       required: false
 *                       amount: null
 *                       asset: null
 *               funded:
 *                 summary: Funded — the client is owed a refund
 *                 value:
 *                   success: true
 *                   data:
 *                     commission:
 *                       id: 8d1f4b2c-0a3e-4f5b-8c7d-1e2f3a4b5c6d
 *                       status: CANCELLED
 *                     refund:
 *                       required: true
 *                       amount: '450.00'
 *                       asset: USDC
 *       400:
 *         description: The reason is missing or too long
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: { code: BAD_REQUEST, message: A reason is required to cancel a commission }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller is not a participant of this commission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: { code: FORBIDDEN, message: You do not participate in this commission }
 *       404:
 *         description: Commission not found
 *       409:
 *         description: >-
 *           The commission can no longer be cancelled, or an open dispute
 *           holds escrow
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               tooLate:
 *                 summary: Already delivered
 *                 value:
 *                   success: false
 *                   error:
 *                     code: CONFLICT
 *                     message: This commission can no longer be cancelled (it is DELIVERED)
 *               escrowHeld:
 *                 summary: An open dispute holds escrow
 *                 value:
 *                   success: false
 *                   error:
 *                     code: CONFLICT
 *                     message: This commission has an open dispute; an admin must resolve it first
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: { code: FORBIDDEN, message: Only the client can dispute a commission }
 *       404:
 *         description: Commission not found
 *       409:
 *         description: Not delivered yet, or already disputed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               notDelivered:
 *                 summary: The final delivery hasn't been made
 *                 value:
 *                   success: false
 *                   error:
 *                     code: CONFLICT
 *                     message: A commission can only be disputed on final delivery
 *               alreadyDisputed:
 *                 summary: A dispute is already open on this commission
 *                 value:
 *                   success: false
 *                   error:
 *                     code: CONFLICT
 *                     message: This commission already has a dispute
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: CONFLICT
 *                 message: This dispute has already been resolved
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 * /api/v1/commissions/{id}/status:
 *   patch:
 *     summary: Advance or cancel a commission
 *     description: >-
 *       Moves the commission along its status machine. Artist: `PENDING →`
 *       `ACCEPTED → IN_PROGRESS → DELIVERED`. Client: `DELIVERED → COMPLETED`
 *       (must carry `review`) or `DELIVERED → DISPUTED`. Either party may
 *       `CANCELLED` a commission that hasn't been delivered yet (`PENDING`,
 *       `ACCEPTED` or `IN_PROGRESS`).
 *
 *
 *       Attempting any other transition returns `409` with the current and
 *       requested status in the message:
 *
 *       ```
 *
 *       error.code    = CONFLICT
 *
 *       error.message = Cannot change commission from <current> to <requested>
 *
 *       ```
 *
 *
 *       While a dispute is `OPEN`/`REVIEWING` escrow is held, so a `COMPLETED`
 *       (release) or `CANCELLED` (refund) request is refused with `409` until
 *       an admin resolves the dispute. Each accepted transition appends a row
 *       to the commission's timeline.
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionResponse'
 *       400:
 *         description: >-
 *           `COMPLETED` was requested without the mandatory review, or by a
 *           caller who is not the client
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: BAD_REQUEST
 *                 message: A client review is required to complete a commission
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller is not a participant of this commission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: { code: FORBIDDEN, message: You do not participate in this commission }
 *       404:
 *         description: Commission not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: { code: NOT_FOUND, message: Commission not found }
 *       409:
 *         description: >-
 *           Transition is not allowed from the current status, or canceling
 *           has become impossible
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidTransition:
 *                 summary: Not a legal next status
 *                 value:
 *                   success: false
 *                   error:
 *                     code: CONFLICT
 *                     message: Cannot change commission from PENDING to COMPLETED
 *               notCancellable:
 *                 summary: Too late to cancel
 *                 value:
 *                   success: false
 *                   error:
 *                     code: CONFLICT
 *                     message: This commission can no longer be cancelled
 *               escrowHeld:
 *                 summary: An open dispute holds escrow
 *                 value:
 *                   success: false
 *                   error:
 *                     code: CONFLICT
 *                     message: This commission has an open dispute; an admin must resolve it first
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 */

import { createFeatureRouter } from './router-factory';
import {
  getCommissionById,
  patchCommissionStatus,
  postCommission,
  postCommissionCancellation,
  postCommissionDispute,
  postCommissionDisputeResolution,
} from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import {
  commissionBodySchema,
  commissionCancelBodySchema,
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

// Cancellation (#826): either party, with a reason, before delivery.
commissionsRouter.post(
  '/:id/cancel',
  authenticate,
  validate({ params: commissionStatusParamsSchema, body: commissionCancelBodySchema }),
  postCommissionCancellation,
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
