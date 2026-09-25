/**
 * Order creation.
 *
 * Purchasing an artwork creates a PENDING order priced off the artwork's
 * listed price/asset, plus a platform fee. Payment capture, status
 * transitions, and delivery are out of scope here — this only covers the
 * "initiate a purchase" step.
 */

import { Prisma, type Order } from '@prisma/client';

import { env } from '@/config';
import { AppError } from '@/middlewares';
import { prisma } from '@/services';

export interface CreateOrderInput {
  readonly artworkId: string;
  readonly idempotencyKey?: string;
}

export interface OrderSummary {
  readonly order: Order;
  readonly total: string;
}

/** Order statuses that mean "this purchase already exists" — a new attempt
 * for the same buyer/artwork is rejected rather than creating a second
 * order. FAILED/REFUNDED orders don't block a retry. */
const BLOCKING_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED'] as const;

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function toSummary(order: Order): OrderSummary {
  return { order, total: order.amount.add(order.platformFee).toFixed(2) };
}

export async function createOrder(
  buyerId: string,
  input: CreateOrderInput,
): Promise<OrderSummary> {
  const artwork = await prisma.artwork.findUnique({ where: { id: input.artworkId } });
  if (artwork === null) {
    throw new AppError('NOT_FOUND', 'Artwork not found');
  }
  if (artwork.userId === buyerId) {
    throw new AppError('FORBIDDEN', 'You cannot purchase your own artwork');
  }
  if (!artwork.published || artwork.sold) {
    throw new AppError('UNPROCESSABLE_ENTITY', 'Artwork is not available for purchase');
  }
  if (artwork.price === null || artwork.asset === null) {
    throw new AppError('UNPROCESSABLE_ENTITY', 'Artwork has no price set');
  }

  if (input.idempotencyKey !== undefined) {
    const existing = await prisma.order.findUnique({
      where: { buyerId_idempotencyKey: { buyerId, idempotencyKey: input.idempotencyKey } },
    });
    if (existing !== null) {
      return toSummary(existing);
    }
  }

  const duplicate = await prisma.order.findFirst({
    where: { buyerId, artworkId: input.artworkId, status: { in: [...BLOCKING_STATUSES] } },
  });
  if (duplicate !== null) {
    throw new AppError('CONFLICT', 'You already have an order for this artwork');
  }

  const platformFee = artwork.price.mul(env.platformFeeBps).div(10000).toDecimalPlaces(2);

  try {
    const order = await prisma.order.create({
      data: {
        buyerId,
        sellerId: artwork.userId,
        artworkId: artwork.id,
        amount: artwork.price,
        asset: artwork.asset,
        platformFee,
        idempotencyKey: input.idempotencyKey,
      },
    });
    return toSummary(order);
  } catch (err) {
    // A concurrent request with the same idempotency key won the race —
    // return its order instead of failing this one.
    if (input.idempotencyKey !== undefined && isUniqueViolation(err)) {
      const raced = await prisma.order.findUnique({
        where: { buyerId_idempotencyKey: { buyerId, idempotencyKey: input.idempotencyKey } },
      });
      if (raced !== null) {
        return toSummary(raced);
      }
    }
    throw err;
  }
}
