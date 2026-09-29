/**
 * Order payment intents.
 *
 * Builds an *unsigned* Stellar payment transaction for an order — the buyer
 * signs it with their own wallet and submits it, so the API never touches a
 * secret key. The transaction moves exactly the order's quoted total
 * (`amount + platformFee`):
 *
 * - `STELLAR_ESCROW_ADDRESS` set: a single payment of the total to the escrow
 *   account. The platform fee is split out of escrow when the order is
 *   released.
 * - otherwise: `amount` goes to the seller's linked wallet and, when
 *   `STELLAR_PLATFORM_FEE_ADDRESS` is set, `platformFee` goes to that account.
 *
 * Building needs the source account's current sequence number, so this service
 * talks to Horizon (read-only).
 */

import {
  Asset as StellarAsset,
  Account,
  BASE_FEE,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import type { Order } from '@prisma/client';

import { env } from '@/config';
import { AppError } from '@/middlewares';
import { prisma } from '@/services';

export interface PaymentIntentDeps {
  /** Overridable for tests; defaults to the global `fetch`. */
  readonly fetchImpl?: typeof fetch;
  /** Overridable clock (ms since epoch); defaults to `Date.now`. */
  readonly now?: () => number;
}

/** A single payment operation inside the intent. */
export interface PaymentIntentLeg {
  /** `ESCROW`, `SELLER` or `PLATFORM_FEE`. */
  readonly kind: 'ESCROW' | 'SELLER' | 'PLATFORM_FEE';
  readonly destination: string;
  readonly amount: string;
  readonly asset: string;
}

export interface OrderPaymentIntent {
  readonly orderId: string;
  /** Unsigned transaction envelope, base64 XDR, for the buyer's wallet to sign. */
  readonly xdr: string;
  readonly networkPassphrase: string;
  /** ISO-8601 instant after which the transaction is rejected by the network. */
  readonly expiresAt: string;
  readonly total: string;
  readonly asset: string;
  /** Where the funds go — the escrow account, or the seller's wallet. */
  readonly destination: string;
  readonly memo: string;
  readonly legs: readonly PaymentIntentLeg[];
  readonly estimatedFee: { readonly stroops: string; readonly xlm: string };
}

const STROOPS_PER_XLM = 10_000_000;
const MEMO_MAX_BYTES = 28;

/** Orders in these states still expect a payment; anything else is settled or dead. */
const PAYABLE_STATUSES = ['PENDING', 'PROCESSING'] as const;

const HORIZON_URL_BY_NETWORK: Record<'testnet' | 'public', string> = {
  testnet: 'https://horizon-testnet.stellar.org',
  public: 'https://horizon.stellar.org',
};

const NETWORK_PASSPHRASE_BY_NETWORK = {
  testnet: Networks.TESTNET,
  public: Networks.PUBLIC,
} as const;

export function horizonUrl(): string {
  return env.stellarHorizonUrl ?? HORIZON_URL_BY_NETWORK[env.stellarNetwork];
}

export function networkPassphrase(): string {
  return NETWORK_PASSPHRASE_BY_NETWORK[env.stellarNetwork];
}

/** Circle's USDC on Stellar is the only issuer the app has a default for, which
 * is exactly what `priceAssetIssuers.USDC` resolves to. */
function assetFor(asset: Order['asset']): StellarAsset {
  return asset === 'XLM'
    ? StellarAsset.native()
    : new StellarAsset(asset, env.priceAssetIssuers[asset]);
}

function isPayable(status: Order['status']): boolean {
  return (PAYABLE_STATUSES as readonly string[]).includes(status);
}

async function fetchSequenceNumber(
  fetchImpl: typeof fetch,
  accountId: string,
  url: string,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(`${url}/accounts/${accountId}`);
  } catch (err) {
    throw new AppError(
      'UNPROCESSABLE_ENTITY',
      'Could not reach Stellar Horizon to build the payment',
      {
        cause: err,
      },
    );
  }
  if (!response.ok) {
    throw new AppError(
      'UNPROCESSABLE_ENTITY',
      response.status === 404
        ? 'Your Stellar account is not funded on this network'
        : 'Could not load your Stellar account from Horizon',
      { details: { status: response.status } },
    );
  }
  const body = (await response.json()) as { readonly sequence?: unknown };
  if (typeof body.sequence !== 'string' || body.sequence.length === 0) {
    throw new AppError(
      'UNPROCESSABLE_ENTITY',
      'Horizon returned an account without a sequence number',
    );
  }
  return body.sequence;
}

/** Where the payment goes: one leg per recipient, plus the primary destination. */
interface PaymentPlan {
  readonly legs: readonly PaymentIntentLeg[];
  /** First leg's destination — the escrow account or the seller's wallet. */
  readonly destination: string;
}

/** Resolves where the money goes, and splits the platform fee out when the
 * payment is not escrowed. */
async function buildPlan(order: Order): Promise<PaymentPlan> {
  const total = order.amount.add(order.platformFee);
  const asset = order.asset;

  if (env.stellarEscrowAddress !== undefined) {
    return {
      legs: [
        {
          kind: 'ESCROW',
          destination: env.stellarEscrowAddress,
          amount: total.toFixed(2),
          asset,
        },
      ],
      destination: env.stellarEscrowAddress,
    };
  }

  const sellerWallet = await prisma.wallet.findUnique({ where: { userId: order.sellerId } });
  if (sellerWallet === null) {
    throw new AppError(
      'UNPROCESSABLE_ENTITY',
      'The seller has no Stellar wallet linked, so the order cannot be paid directly',
    );
  }

  const feeAddress = env.stellarPlatformFeeAddress;
  // With no platform-fee account there is nowhere to send the fee, so the
  // seller receives the gross total in a single payment.
  const splitsFee = feeAddress !== undefined && order.platformFee.greaterThan(0);
  const sellerAmount = splitsFee ? order.amount : total;

  const legs: PaymentIntentLeg[] = [];
  if (sellerAmount.greaterThan(0)) {
    legs.push({
      kind: 'SELLER',
      destination: sellerWallet.publicKey,
      amount: sellerAmount.toFixed(2),
      asset,
    });
  }
  if (splitsFee && feeAddress !== undefined) {
    legs.push({
      kind: 'PLATFORM_FEE',
      destination: feeAddress,
      amount: order.platformFee.toFixed(2),
      asset,
    });
  }

  const [primaryLeg] = legs;
  if (primaryLeg === undefined) {
    throw new AppError('UNPROCESSABLE_ENTITY', 'Order total is zero; there is nothing to pay');
  }
  return { legs, destination: primaryLeg.destination };
}

/**
 * Builds the unsigned payment transaction for an order. Only the buyer may pay,
 * and only while the order is still awaiting payment.
 */
export async function createOrderPaymentIntent(
  orderId: string,
  buyerId: string,
  deps: PaymentIntentDeps = {},
): Promise<OrderPaymentIntent> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now?.() ?? Date.now();

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (order === null) {
    throw new AppError('NOT_FOUND', 'Order not found');
  }
  if (order.buyerId !== buyerId) {
    throw new AppError('FORBIDDEN', 'Only the buyer can pay for this order');
  }
  if (!isPayable(order.status)) {
    throw new AppError('UNPROCESSABLE_ENTITY', `Order is ${order.status} and cannot be paid`);
  }

  if (order.amount.add(order.platformFee).lessThanOrEqualTo(0)) {
    throw new AppError('UNPROCESSABLE_ENTITY', 'Order total is zero; there is nothing to pay');
  }

  const buyerWallet = await prisma.wallet.findUnique({ where: { userId: order.buyerId } });
  if (buyerWallet === null) {
    throw new AppError(
      'UNPROCESSABLE_ENTITY',
      'Link a Stellar wallet before paying for this order',
    );
  }

  const { legs, destination } = await buildPlan(order);
  const asset = assetFor(order.asset);

  const sequence = await fetchSequenceNumber(fetchImpl, buyerWallet.publicKey, horizonUrl());

  const expiresAt = new Date(now + env.paymentIntentTtlSeconds * 1000);
  const memo = order.id.slice(0, MEMO_MAX_BYTES);
  // `fee` is the *per-operation* base fee; the builder scales it by the number
  // of operations to get the transaction's total fee.
  const feeStroops = Number(BASE_FEE) * legs.length;

  const builder = new TransactionBuilder(new Account(buyerWallet.publicKey, sequence), {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(),
    memo: Memo.text(memo),
    timebounds: {
      minTime: Math.floor(now / 1000),
      maxTime: Math.floor(expiresAt.getTime() / 1000),
    },
  });
  for (const leg of legs) {
    builder.addOperation(
      Operation.payment({ destination: leg.destination, asset, amount: leg.amount }),
    );
  }
  const transaction = builder.build();

  return {
    orderId: order.id,
    xdr: transaction.toXDR(),
    networkPassphrase: networkPassphrase(),
    expiresAt: expiresAt.toISOString(),
    total: order.amount.add(order.platformFee).toFixed(2),
    asset: order.asset,
    destination,
    memo,
    legs,
    estimatedFee: {
      stroops: String(feeStroops),
      xlm: (feeStroops / STROOPS_PER_XLM).toFixed(7),
    },
  };
}
