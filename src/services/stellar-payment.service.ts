/**
 * Stellar payment intents.
 *
 * Builds an unsigned payment/escrow transaction for an order and returns the
 * XDR for the buyer's wallet to sign. Nothing is submitted here — the
 * frontend signs and submits.
 *
 * - Funds go to the platform escrow account when one is configured,
 *   otherwise straight to the seller's linked wallet.
 * - When `STELLAR_ESCROW_CONTRACT_ID` is set, the payment is a Soroban
 *   contract invocation (`deposit(from, amount)`) instead of a classic
 *   payment.
 * - The transaction carries a time bound so the XDR expires
 *   (`PAYMENT_INTENT_TTL_SECONDS`, 5 minutes by default).
 */

import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import type { Asset as PrismaAsset } from '@prisma/client';

import { env } from '@/config';
import { AppError } from '@/middlewares';
import { prisma } from '@/services';

const STROOPS_PER_UNIT = 10_000_000;
const MEMO_MAX_LENGTH = 28;

/** Order statuses that can still be paid for. */
const PAYABLE_ORDER_STATUSES = ['PENDING', 'PROCESSING'] as const;

export interface PaymentIntentSummary {
  readonly orderId: string;
  readonly amount: string;
  readonly platformFee: string;
  readonly total: string;
  readonly asset: PrismaAsset;
  readonly source: string;
  readonly destination: string | null;
  readonly memo: string;
}

export interface PaymentIntentFeeEstimate {
  readonly stroops: string;
  readonly xlm: string;
}

export interface PaymentIntent {
  readonly xdr: string;
  readonly networkPassphrase: string;
  readonly expiresAt: string;
  readonly feeEstimate: PaymentIntentFeeEstimate;
  readonly escrowContractId: string | null;
  readonly summary: PaymentIntentSummary;
}

/** Injectable seams so the builder is testable without network or real config. */
export interface PaymentIntentDeps {
  readonly now?: () => Date;
  readonly fetchImpl?: typeof fetch;
  readonly escrowAddress?: string;
  readonly escrowContractId?: string;
  readonly networkPassphrase?: string;
  readonly horizonUrl?: string;
}

function defaultNetworkPassphrase(): string {
  return env.stellarNetwork === 'public' ? Networks.PUBLIC : Networks.TESTNET;
}

function defaultHorizonUrl(): string {
  return env.stellarNetwork === 'public'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org';
}

function toStellarAsset(asset: PrismaAsset): Asset {
  if (asset === 'XLM') {
    return Asset.native();
  }
  return new Asset(asset, env.priceAssetIssuers[asset]);
}

async function loadAccountSequence(
  publicKey: string,
  fetchImpl: typeof fetch,
  horizonUrl: string,
): Promise<string> {
  const response = await fetchImpl(`${horizonUrl}/accounts/${publicKey}`);
  if (!response.ok) {
    throw new AppError(
      'UNPROCESSABLE_ENTITY',
      'Could not load the Stellar account for this order (is the wallet funded?).',
    );
  }
  const body = (await response.json()) as { sequence?: string };
  if (body.sequence === undefined) {
    throw new AppError('UNPROCESSABLE_ENTITY', 'Stellar account response had no sequence number.');
  }
  return body.sequence;
}

/**
 * Builds the unsigned payment-intent XDR for an order. The buyer's linked
 * wallet is the transaction source; the amount is the order's quoted total
 * (artwork amount + platform fee), so the XDR matches the quote exactly.
 */
export async function createOrderPaymentIntent(
  orderId: string,
  userId: string,
  deps: PaymentIntentDeps = {},
): Promise<PaymentIntent> {
  const now = deps.now ?? ((): Date => new Date());
  const fetchImpl = deps.fetchImpl ?? fetch;
  const networkPassphrase = deps.networkPassphrase ?? defaultNetworkPassphrase();
  const horizonUrl = deps.horizonUrl ?? defaultHorizonUrl();
  const escrowAddress = deps.escrowAddress ?? env.stellarEscrowAddress;
  const escrowContractId = deps.escrowContractId ?? env.stellarEscrowContractId;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (order === null) {
    throw new AppError('NOT_FOUND', 'Order not found');
  }
  if (order.buyerId !== userId) {
    throw new AppError('FORBIDDEN', 'Only the buyer can pay for this order');
  }
  if (!PAYABLE_ORDER_STATUSES.includes(order.status as (typeof PAYABLE_ORDER_STATUSES)[number])) {
    throw new AppError('CONFLICT', `Order is ${order.status} and can no longer be paid`);
  }

  const amount = order.amount.toFixed(2);
  const platformFee = order.platformFee.toFixed(2);
  const total = order.amount.add(order.platformFee).toFixed(2);

  const [buyerWallet, sellerWallet] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: order.buyerId } }),
    prisma.wallet.findUnique({ where: { userId: order.sellerId } }),
  ]);
  if (buyerWallet === null) {
    throw new AppError('UNPROCESSABLE_ENTITY', 'Link a Stellar wallet before paying for an order');
  }

  // Escrow takes priority; without one configured, pay the seller directly.
  const destination = escrowAddress ?? sellerWallet?.publicKey ?? null;
  if (escrowContractId === undefined && destination === null) {
    throw new AppError(
      'UNPROCESSABLE_ENTITY',
      'No escrow account or seller wallet is configured for this order',
    );
  }

  const source = buyerWallet.publicKey;
  const sequence = await loadAccountSequence(source, fetchImpl, horizonUrl);

  const createdAt = now();
  const maxTime = Math.floor(createdAt.getTime() / 1000) + env.paymentIntentTtlSeconds;
  const memo = order.id.slice(0, MEMO_MAX_LENGTH);

  const builder = new TransactionBuilder(new Account(source, sequence), {
    fee: BASE_FEE,
    networkPassphrase,
    timebounds: { minTime: 0, maxTime },
  });
  builder.addMemo(Memo.text(memo));

  if (escrowContractId !== undefined) {
    // Assumed escrow contract interface: deposit(from: Address, amount: i128).
    const stroops = BigInt(Math.round(Number(total) * STROOPS_PER_UNIT));
    builder.addOperation(
      Operation.invokeContractFunction({
        contract: escrowContractId,
        function: 'deposit',
        args: [new Address(source).toScVal(), nativeToScVal(stroops, { type: 'i128' })],
      }),
    );
  } else {
    builder.addOperation(
      Operation.payment({
        destination: destination as string,
        asset: toStellarAsset(order.asset),
        amount: total,
      }),
    );
  }

  const transaction = builder.build();
  const feeStroops = String(transaction.fee);

  return {
    xdr: transaction.toXDR(),
    networkPassphrase,
    expiresAt: new Date(maxTime * 1000).toISOString(),
    feeEstimate: {
      stroops: feeStroops,
      xlm: (Number(feeStroops) / STROOPS_PER_UNIT).toFixed(7),
    },
    escrowContractId: escrowContractId ?? null,
    summary: {
      orderId: order.id,
      amount,
      platformFee,
      total,
      asset: order.asset,
      source,
      destination,
      memo,
    },
  };
}
