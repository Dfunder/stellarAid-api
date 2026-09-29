import { Keypair, Networks, StrKey, TransactionBuilder } from '@stellar/stellar-sdk';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/middlewares';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findUnique: vi.fn() },
    wallet: { findUnique: vi.fn() },
  },
}));

vi.mock('@/services', () => ({ prisma: prismaMock }));

import { createOrderPaymentIntent } from './stellar-payment.service';

const ORDER_ID = 'order-1';
const BUYER_ID = 'buyer-1';
const SELLER_ID = 'seller-1';
const BUYER_PUBLIC_KEY = Keypair.random().publicKey();
const SELLER_PUBLIC_KEY = Keypair.random().publicKey();
const ESCROW_PUBLIC_KEY = Keypair.random().publicKey();
const ESCROW_CONTRACT_ID = StrKey.encodeContract(Keypair.random().rawPublicKey());

const NETWORK = Networks.TESTNET;
const NOW = new Date('2026-09-29T00:00:00.000Z');

function makeOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: ORDER_ID,
    buyerId: BUYER_ID,
    sellerId: SELLER_ID,
    artworkId: 'artwork-1',
    amount: new Prisma.Decimal('100.00'),
    platformFee: new Prisma.Decimal('5.00'),
    asset: 'XLM',
    status: 'PENDING',
    ...overrides,
  } as never;
}

/** Decode a built XDR, narrowing away the fee-bump union member. */
function decode(xdr: string) {
  const tx = TransactionBuilder.fromXDR(xdr, NETWORK);
  if (!('memo' in tx)) {
    throw new Error('expected a plain (non-fee-bump) transaction');
  }
  return tx;
}

const sequenceFetch = () =>
  vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ sequence: '123456789' }),
  }) as unknown as typeof fetch;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.order.findUnique.mockResolvedValue(makeOrder());
  prismaMock.wallet.findUnique.mockImplementation((args: { where: { userId: string } }) => {
    if (args.where.userId === BUYER_ID) {
      return Promise.resolve({ userId: BUYER_ID, publicKey: BUYER_PUBLIC_KEY });
    }
    if (args.where.userId === SELLER_ID) {
      return Promise.resolve({ userId: SELLER_ID, publicKey: SELLER_PUBLIC_KEY });
    }
    return Promise.resolve(null);
  });
});

describe('createOrderPaymentIntent', () => {
  it('builds a payment to escrow for the exact quoted total and expires in 5 minutes', async () => {
    const fetchImpl = sequenceFetch();
    const intent = await createOrderPaymentIntent(ORDER_ID, BUYER_ID, {
      now: () => NOW,
      fetchImpl,
      escrowAddress: ESCROW_PUBLIC_KEY,
      escrowContractId: undefined,
      networkPassphrase: NETWORK,
      horizonUrl: 'https://horizon-testnet.stellar.org',
    });

    const tx = decode(intent.xdr);
    const op = tx.operations[0];

    expect(op?.type).toBe('payment');
    if (op?.type === 'payment') {
      expect(op.destination).toBe(ESCROW_PUBLIC_KEY);
      // Stellar normalizes payment amounts to 7 decimal places.
      expect(op.amount).toBe('105.0000000');
      expect(Number(op.amount)).toBe(Number(intent.summary.total));
      expect(op.asset.isNative()).toBe(true);
    }
    expect(tx.source).toBe(BUYER_PUBLIC_KEY);
    expect(tx.memo.type).toBe('text');
    expect(tx.memo.value?.toString()).toBe(ORDER_ID);
    expect(tx.timeBounds?.maxTime).toBe(String(Math.floor(NOW.getTime() / 1000) + 300));
    expect(intent.expiresAt).toBe(
      new Date((Math.floor(NOW.getTime() / 1000) + 300) * 1000).toISOString(),
    );

    expect(intent.summary).toMatchObject({
      orderId: ORDER_ID,
      amount: '100.00',
      platformFee: '5.00',
      total: '105.00',
      asset: 'XLM',
      destination: ESCROW_PUBLIC_KEY,
      source: BUYER_PUBLIC_KEY,
    });
    expect(intent.escrowContractId).toBeNull();
    expect(intent.feeEstimate.stroops).toBe(String(tx.fee));
    expect(intent.networkPassphrase).toBe(NETWORK);
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://horizon-testnet.stellar.org/accounts/${BUYER_PUBLIC_KEY}`,
    );
  });

  it('falls back to the seller wallet when no escrow account is configured', async () => {
    const intent = await createOrderPaymentIntent(ORDER_ID, BUYER_ID, {
      now: () => NOW,
      fetchImpl: sequenceFetch(),
      escrowAddress: undefined,
      escrowContractId: undefined,
      networkPassphrase: NETWORK,
      horizonUrl: 'h',
    });

    const op = decode(intent.xdr).operations[0];
    expect(op?.type).toBe('payment');
    if (op?.type === 'payment') {
      expect(op.destination).toBe(SELLER_PUBLIC_KEY);
    }
    expect(intent.summary.destination).toBe(SELLER_PUBLIC_KEY);
  });

  it('builds a Soroban escrow invocation when a contract id is configured', async () => {
    const intent = await createOrderPaymentIntent(ORDER_ID, BUYER_ID, {
      now: () => NOW,
      fetchImpl: sequenceFetch(),
      escrowContractId: ESCROW_CONTRACT_ID,
      networkPassphrase: NETWORK,
      horizonUrl: 'h',
    });

    const op = decode(intent.xdr).operations[0];
    expect(op?.type).toMatch(/invoke/i);
    expect(intent.escrowContractId).not.toBeNull();
  });

  it('rejects when the caller is not the buyer', async () => {
    await expect(
      createOrderPaymentIntent(ORDER_ID, 'someone-else', {
        fetchImpl: sequenceFetch(),
        networkPassphrase: NETWORK,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects when the order cannot be found', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);

    await expect(
      createOrderPaymentIntent(ORDER_ID, BUYER_ID, { fetchImpl: sequenceFetch() }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects an order that is no longer payable', async () => {
    prismaMock.order.findUnique.mockResolvedValue(makeOrder({ status: 'COMPLETED' }));

    await expect(
      createOrderPaymentIntent(ORDER_ID, BUYER_ID, { fetchImpl: sequenceFetch() }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects when the buyer has no linked wallet', async () => {
    prismaMock.wallet.findUnique.mockResolvedValue(null);

    await expect(
      createOrderPaymentIntent(ORDER_ID, BUYER_ID, { fetchImpl: sequenceFetch() }),
    ).rejects.toMatchObject({ code: 'UNPROCESSABLE_ENTITY' });
  });

  it('maps a failed Horizon lookup to a readable error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    await expect(
      createOrderPaymentIntent(ORDER_ID, BUYER_ID, {
        fetchImpl,
        escrowAddress: ESCROW_PUBLIC_KEY,
        networkPassphrase: NETWORK,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
