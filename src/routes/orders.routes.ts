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
 *     summary: Build a payment intent (unsigned Stellar transaction) for an order
 *     description: >-
 *       Buyer only. Builds the Stellar payment that settles the order and
 *       returns it as an *unsigned* XDR envelope for the buyer's wallet to
 *       sign and submit — the API never holds a secret key.
 *
 *
 *       The transaction pays exactly the order's quoted total
 *       (`amount + platformFee`). With `STELLAR_ESCROW_ADDRESS` configured the
 *       whole total goes to that escrow account; otherwise it goes to the
 *       seller's linked wallet, with the platform fee split out to
 *       `STELLAR_PLATFORM_FEE_ADDRESS` when that is configured too.
 *
 *
 *       The transaction is time-bounded: the returned XDR stops being valid
 *       after `PAYMENT_INTENT_TTL_SECONDS` (default 300s / 5 minutes). Build a
 *       new intent to get a fresh sequence number and time bound.
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
 *         description: Unsigned payment transaction, ready for the buyer to sign
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentIntentResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller is not the buyer of this order
 *       404:
 *         description: Order not found
 *       422:
 *         description: >-
 *           The order is not payable, a party has no linked wallet, or Horizon
 *           could not be reached
 */

import { postOrder, postOrderPaymentIntent } from '@/controllers';
import { authenticate, validate } from '@/middlewares';
import { orderBodySchema, paymentParamsSchema } from '@/validators';

import { createFeatureRouter } from './router-factory';

export const ordersRouter = createFeatureRouter('orders');

ordersRouter.post('/', authenticate, validate({ body: orderBodySchema }), postOrder);

// Payment intent (#764): the buyer's unsigned Stellar transaction for an order.
ordersRouter.post(
  '/:id/payment-intent',
  authenticate,
  validate({ params: paymentParamsSchema }),
  postOrderPaymentIntent,
);
