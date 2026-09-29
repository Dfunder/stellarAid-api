/**
 * Orders routes (v1).
 *
 * @openapi
 * /api/v1/orders:
 *   post:
 *     summary: Create an order (initiate a purchase)
 *     description: >
 *       Prices the order off the artwork's listed price/asset plus the
 *       platform fee. Sellers cannot buy their own artwork (403). Pass
 *       `idempotencyKey` to make retried requests safe — a repeat with the
 *       same key returns the original order instead of creating a second
 *       one; without it, a duplicate purchase attempt for the same artwork
 *       is still rejected (409) while an order is pending/processing/completed.
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrderRequest'
 *     responses:
 *       201:
 *         description: Order created (or, with a repeated idempotencyKey, the original order)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Cannot purchase your own artwork
 *       404:
 *         description: Artwork not found
 *       409:
 *         description: An order for this artwork already exists
 *       422:
 *         description: Artwork is not available for purchase, or has no price set
 * /api/v1/orders/{id}/payment-intent:
 *   post:
 *     summary: Generate an unsigned Stellar payment-intent XDR
 *     description: >
 *       Builds the payment (or Soroban escrow invocation) for an order and
 *       returns the unsigned XDR for the buyer's wallet to sign. The amount
 *       is the order's quoted total (amount + platform fee); the transaction
 *       expires after `PAYMENT_INTENT_TTL_SECONDS` (5 minutes by default).
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Unsigned XDR plus a fee estimate and summary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Only the buyer can pay for this order
 *       404:
 *         description: Order not found
 *       409:
 *         description: Order is completed/refunded/failed and can no longer be paid
 *       422:
 *         description: The buyer has no linked Stellar wallet, or it could not be loaded
 */

import { postOrder, postOrderPaymentIntent } from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import { orderBodySchema, orderPaymentIntentParamsSchema } from '@/validators';

import { createFeatureRouter } from './router-factory';

export const ordersRouter = createFeatureRouter('orders');

ordersRouter.post('/', authenticate, validate({ body: orderBodySchema }), postOrder);
ordersRouter.post(
  '/:id/payment-intent',
  authenticate,
  validate({ params: orderPaymentIntentParamsSchema }),
  postOrderPaymentIntent,
);
