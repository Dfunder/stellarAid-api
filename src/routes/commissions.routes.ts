/**
 * Commissions routes (v1).
 *
 * @openapi
 * /api/v1/commissions/{id}/status:
 *   patch:
 *     summary: Move a commission through its status machine
 *     description: >
 *       Advances (or terminates) a commission. The caller must be one of the
 *       two participants — the client who requested the work or the artist
 *       who performs it — and only the transitions listed below are accepted;
 *       anything else is a 409 rather than a silent no-op.
 *
 *       **Status machine**
 *
 *       - `PENDING → ACCEPTED` (artist): takes the job; the escrow for the
 *         agreed `budget`/`asset` is committed.
 *       - `ACCEPTED → IN_PROGRESS` (artist): work has started; the escrow stays
 *         held.
 *       - `IN_PROGRESS → DELIVERED` (artist): submits the deliverable for
 *         review.
 *       - `DELIVERED → IN_PROGRESS` (client): asks for a revision; the escrow
 *         stays held and the artist re-delivers when the changes are in, so
 *         this step can loop.
 *       - `DELIVERED → COMPLETED` (client): accepts; a review is **required**
 *         in the same request (it is stored as a review on the artist) and the
 *         escrowed funds are released to the artist.
 *       - `DELIVERED → DISPUTED` (client): rejects the delivery; funds stay in
 *         escrow until the dispute is resolved.
 *       - `PENDING`/`ACCEPTED`/`IN_PROGRESS` → `CANCELLED` (either party):
 *         walks away before delivery; the escrow is refunded to the client.
 *
 *       Once a commission is `COMPLETED`, `CANCELLED` or `DISPUTED` it is
 *       terminal — later updates are rejected with 409.
 *     tags: [Commissions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Commission id.
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommissionStatusRequest'
 *           examples:
 *             accept:
 *               summary: Artist accepts the request
 *               value: { status: ACCEPTED }
 *             start:
 *               summary: Artist starts working
 *               value: { status: IN_PROGRESS }
 *             deliver:
 *               summary: Artist delivers for review
 *               value: { status: DELIVERED }
 *             complete:
 *               summary: Client accepts and reviews the deliverable
 *               value:
 *                 status: COMPLETED
 *                 review:
 *                   rating: 5
 *                   title: Excellent work
 *                   body: Delivered ahead of the deadline.
 *             dispute:
 *               summary: Client disputes the delivery
 *               value: { status: DISPUTED }
 *             cancel:
 *               summary: Either party cancels before delivery
 *               value: { status: CANCELLED }
 *     responses:
 *       200:
 *         description: Commission updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommissionResponse'
 *             example:
 *               success: true
 *               data:
 *                 id: 3f1c9a4e-5b7d-4c2a-9f0e-1a2b3c4d5e6f
 *                 clientId: 7c2e1b90-2a4f-4d3b-8c5e-0f9a8b7c6d5e
 *                 artistId: 1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d
 *                 title: Album cover illustration
 *                 description: Full-colour cover plus a favicon.
 *                 budget: '250.00'
 *                 asset: USDC
 *                 deadline: '2026-10-31T17:00:00.000Z'
 *                 status: ACCEPTED
 *                 createdAt: '2026-09-29T09:00:00.000Z'
 *                 updatedAt: '2026-09-29T09:05:00.000Z'
 *       400:
 *         description: >
 *           Completing without a review, or sending a review alongside any
 *           status other than COMPLETED.
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
 *         description: Caller is neither the client nor the artist of this commission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: FORBIDDEN
 *                 message: You do not participate in this commission
 *       404:
 *         description: Commission not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: NOT_FOUND
 *                 message: Commission not found
 *       409:
 *         description: Transition not allowed from the commission's current status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               wrongActor:
 *                 summary: Client tries an artist-only step
 *                 value:
 *                   success: false
 *                   error:
 *                     code: CONFLICT
 *                     message: Cannot change commission from PENDING to IN_PROGRESS
 *               alreadyCancelled:
 *                 summary: Cancelling after delivery
 *                 value:
 *                   success: false
 *                   error:
 *                     code: CONFLICT
 *                     message: This commission can no longer be cancelled
 *       422:
 *         $ref: '#/components/responses/ValidationFailed'
 */

import { createFeatureRouter } from './router-factory';
import { patchCommissionStatus } from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import { commissionStatusBodySchema, commissionStatusParamsSchema } from '@/validators';

export const commissionsRouter = createFeatureRouter('commissions');

commissionsRouter.patch(
  '/:id/status',
  authenticate,
  validate({ params: commissionStatusParamsSchema, body: commissionStatusBodySchema }),
  patchCommissionStatus,
);
