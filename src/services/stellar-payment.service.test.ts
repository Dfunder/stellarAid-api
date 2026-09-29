import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Prisma } from '@prisma/client';
import {
  BASE_FEE,
  Keypair,
  Networks,
  TransactionBuilder,
  type Operation,
  type Transaction,
} from '@stellar/stellar-sdk';

const BUYER_ID = 'buyer-1';
const SELLER_ID = 'seller-1';
const ORDER_ID = '11111111-2222-3333-4444-555555555555';

const BUYER_KEY = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1)).publicKey();
const SELLER_KEY = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 2)).publicKey();
const ESCROW_KEY = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3)).publicKey();
const FEE_KEY = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 4)).publicKey();

const TESTNET_HORIZON = 'https://horizon-testnet.stellar.org';
const PUBLIC_HORIZON = 'https://horizon.stellar.org';
const USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const NOW = Date.parse('2026-09-01T00:00:00.000Z');

const { prismaMock, envMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findUnique: vi.fn() },
    wallet: { findUnique: vi.fn() },
  },
  envMock: {
    nodeEnv: 'test',
    isDevelopment: false,
    isProduction: false,
    isTest: true,
    redisUrl: undefined as string | undefined,
    stellarNetwork: 'testnet' as 'testnet' | 'public',
    stellarHorizonUrl: undefined as string | undefined,
    stellarEscrowAddress: undefined as string | undefined,
    stellarPlatformFeeAddress: undefined as string | undefined,
    paymentIntentTtlSeconds: 300,
    priceAssetIssuers: {
      USDC: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
      EURC: undefined,
      NGNT: undefined,
    },
  },
}));

vi.mock('@/config', () => ({ env: envMock }));
vi.mock('@/services', () => ({ prisma: prismaMock }));

import {
  createOrderPaymentIntent,
  horizonUrl,
  networkPassphrase,
  type PaymentIntentDeps,
} from './stellar-payment.service';

const fetchMock = vi.fn();

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    buyerId: BUYER_ID,
    sellerId: SELLER_ID,
    amount: new Prisma.Decimal('400.00'),
    platformFee: new Prisma.Decimal('50.00'),
    asset: 'USDC',
    status: 'PENDING',
    ...overrides,
  };
}

function makeDeps(overrides: Partial<PaymentIntentDeps> = {}): PaymentIntentDeps {
  return {
    fetchImpl: fetchMock as unknown as typeof fetch,
    now: () => NOW,
    ...overrides,
  };
}

function decode(xdr: string, passphrase: string): Transaction {
  return TransactionBuilder.fromXDR(xdr, passphrase) as Transaction;
}

/** Payment operations of the built transaction, in order. */
function paymentOperations(intent: {
  xdr: string;
  networkPassphrase: string;
}): Operation.Payment[] {
  const tx = decode(intent.xdr, intent.networkPassphrase);
  return tx.operations.filter((op): op is Operation.Payment => op.type === 'payment');
}

beforeEach(() => {
  vi.clearAllMocks();
  envMock.stellarNetwork = 'testnet';
  envMock.stellarHorizonUrl = undefined;
  envMock.stellarEscrowAddress = undefined;
  envMock.stellarPlatformFeeAddress = undefined;
  envMock.paymentIntentTtlSeconds = 300;

  prismaMock.order.findUnique.mockResolvedValue(makeOrder());
  prismaMock.wallet.findUnique.mockImplementation(
    async ({ where }: { where: { userId: string } }) =>
      where.userId === BUYER_ID
        ? { userId: BUYER_ID, publicKey: BUYER_KEY }
        : { userId: SELLER_ID, publicKey: SELLER_KEY },
  );
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ sequence: '123456789' }),
  });
});

describe('createOrderPaymentIntent (#764)', () => {
  it('pays the order total into escrow in a single operation when an escrow account is configured', async () => {
    envMock.stellarEscrowAddress = ESCROW_KEY;

    const intent = await createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps());

    expect(intent.total).toBe('450.00');
    expect(intent.destination).toBe(ESCROW_KEY);
    expect(intent.legs).toEqual([
      { kind: 'ESCROW', destination: ESCROW_KEY, amount: '450.00', asset: 'USDC' },
    ]);

    const pays = paymentOperations(intent);
    expect(pays).toHaveLength(1);
    expect(pays[0]!.destination).toBe(ESCROW_KEY);
    // The SDK normalises amounts to 7 decimal places; the value is the total exactly.
    expect(Number(pays[0]!.amount).toFixed(2)).toBe('450.00');
    expect(pays[0]!.asset.getCode()).toBe('USDC');
    expect(pays[0]!.asset.getIssuer()).toBe(USDC_ISSUER);
  });

  it('splits the platform fee out to its own account when there is no escrow', async () => {
    envMock.stellarPlatformFeeAddress = FEE_KEY;

    const intent = await createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps());

    expect(intent.legs).toEqual([
      { kind: 'SELLER', destination: SELLER_KEY, amount: '400.00', asset: 'USDC' },
      { kind: 'PLATFORM_FEE', destination: FEE_KEY, amount: '50.00', asset: 'USDC' },
    ]);
    expect(intent.destination).toBe(SELLER_KEY);

    const pays = paymentOperations(intent);
    expect(pays.map((pay) => Number(pay.amount).toFixed(2))).toEqual(['400.00', '50.00']);

    // The buyer is charged the quoted total, no more.
    const charged = pays.reduce((sum, pay) => sum + Number(pay.amount), 0);
    expect(charged.toFixed(2)).toBe(intent.total);
  });

  it('sends the gross total to the seller when no platform-fee account is configured', async () => {
    const intent = await createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps());

    expect(intent.legs).toEqual([
      { kind: 'SELLER', destination: SELLER_KEY, amount: '450.00', asset: 'USDC' },
    ]);
    expect(intent.total).toBe('450.00');
  });

  it('pays the seller the exact amount when the order carries no platform fee', async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder({ platformFee: new Prisma.Decimal('0') }),
    );
    envMock.stellarPlatformFeeAddress = FEE_KEY;

    const intent = await createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps());

    expect(intent.legs).toEqual([
      { kind: 'SELLER', destination: SELLER_KEY, amount: '400.00', asset: 'USDC' },
    ]);
    expect(intent.total).toBe('400.00');
  });

  it('expires the transaction 5 minutes after it is built by default', async () => {
    const intent = await createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps());

    expect(intent.expiresAt).toBe(new Date(NOW + 300_000).toISOString());

    const tx = decode(intent.xdr, intent.networkPassphrase);
    expect(tx.timeBounds).toEqual({
      minTime: String(Math.floor(NOW / 1000)),
      maxTime: String(Math.floor((NOW + 300_000) / 1000)),
    });
  });

  it('honours a configured payment-intent TTL', async () => {
    envMock.paymentIntentTtlSeconds = 60;

    const intent = await createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps());

    expect(intent.expiresAt).toBe(new Date(NOW + 60_000).toISOString());
    expect(decode(intent.xdr, intent.networkPassphrase).timeBounds?.maxTime).toBe(
      String(Math.floor((NOW + 60_000) / 1000)),
    );
  });

  it('carries the order id as the transaction memo so the payment can be reconciled', async () => {
    const intent = await createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps());

    expect(intent.memo).toBe(ORDER_ID.slice(0, 28));
    expect(Buffer.byteLength(intent.memo)).toBeLessThanOrEqual(28);

    const tx = decode(intent.xdr, intent.networkPassphrase);
    expect(tx.memo.type).toBe('text');
    expect(String(tx.memo.value)).toBe(ORDER_ID.slice(0, 28));
  });

  it('estimates the network fee at the base fee per operation', async () => {
    envMock.stellarEscrowAddress = ESCROW_KEY;
    const escrowed = await createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps());

    envMock.stellarEscrowAddress = undefined;
    envMock.stellarPlatformFeeAddress = FEE_KEY;
    const split = await createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps());

    expect(escrowed.estimatedFee).toEqual({ stroops: BASE_FEE, xlm: '0.0000100' });
    expect(split.estimatedFee).toEqual({
      stroops: String(Number(BASE_FEE) * 2),
      xlm: '0.0000200',
    });
    expect(decode(split.xdr, split.networkPassphrase).fee).toBe(String(Number(BASE_FEE) * 2));
  });

  it('builds a native XLM payment for XLM orders', async () => {
    envMock.stellarEscrowAddress = ESCROW_KEY;
    prismaMock.order.findUnique.mockResolvedValue(makeOrder({ asset: 'XLM' }));

    const intent = await createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps());

    expect(intent.asset).toBe('XLM');
    const [pay] = paymentOperations(intent);
    expect(pay!.asset.isNative()).toBe(true);
  });

  it('pays a second platform-fee operation for XLM orders too', async () => {
    prismaMock.order.findUnique.mockResolvedValue(makeOrder({ asset: 'XLM' }));
    envMock.stellarPlatformFeeAddress = FEE_KEY;

    const pays = paymentOperations(await createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps()));

    expect(pays).toHaveLength(2);
    expect(pays.every((pay) => pay.asset.isNative())).toBe(true);
  });

  it('reads the buyer account sequence from Horizon before building', async () => {
    const intent = await createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps());

    expect(fetchMock).toHaveBeenCalledWith(`${TESTNET_HORIZON}/accounts/${BUYER_KEY}`);
    expect(decode(intent.xdr, intent.networkPassphrase).sequence).toBe('123456790');
  });

  it('uses a configured Horizon URL instead of the network default', async () => {
    envMock.stellarHorizonUrl = 'https://horizon.example.com';

    await createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps());

    expect(fetchMock).toHaveBeenCalledWith(`https://horizon.example.com/accounts/${BUYER_KEY}`);
  });

  it('builds for the public network when configured', async () => {
    envMock.stellarNetwork = 'public';

    const intent = await createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps());

    expect(intent.networkPassphrase).toBe(Networks.PUBLIC);
    expect(fetchMock).toHaveBeenCalledWith(`${PUBLIC_HORIZON}/accounts/${BUYER_KEY}`);
  });

  it('does not sign the transaction', async () => {
    const intent = await createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps());
    expect(decode(intent.xdr, intent.networkPassphrase).signatures).toHaveLength(0);
  });

  it.each(['PENDING', 'PROCESSING'])('builds an intent for an order that is %s', async (status) => {
    prismaMock.order.findUnique.mockResolvedValue(makeOrder({ status }));

    await expect(createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps())).resolves.toMatchObject({
      orderId: ORDER_ID,
    });
  });

  it.each(['COMPLETED', 'FAILED', 'REFUNDED'])(
    'refuses to build an intent for an order that is %s',
    async (status) => {
      prismaMock.order.findUnique.mockResolvedValue(makeOrder({ status }));

      await expect(createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps())).rejects.toMatchObject({
        code: 'UNPROCESSABLE_ENTITY',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('rejects an unknown order', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);

    await expect(createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps())).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only lets the buyer pay', async () => {
    await expect(
      createOrderPaymentIntent(ORDER_ID, 'someone-else', makeDeps()),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires the buyer to have a linked wallet', async () => {
    prismaMock.wallet.findUnique.mockResolvedValue(null);

    await expect(createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps())).rejects.toMatchObject({
      code: 'UNPROCESSABLE_ENTITY',
      message: 'Link a Stellar wallet before paying for this order',
    });
  });

  it('requires the seller to have a linked wallet when paying without escrow', async () => {
    prismaMock.wallet.findUnique.mockImplementation(
      async ({ where }: { where: { userId: string } }) =>
        where.userId === BUYER_ID ? { userId: BUYER_ID, publicKey: BUYER_KEY } : null,
    );

    await expect(createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps())).rejects.toMatchObject({
      code: 'UNPROCESSABLE_ENTITY',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves the seller wallet by the order seller id', async () => {
    await createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps());

    expect(prismaMock.wallet.findUnique).toHaveBeenCalledWith({
      where: { userId: SELLER_ID },
    });
  });

  it('refuses to build an intent for a zero-total order', async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      makeOrder({ amount: new Prisma.Decimal('0'), platformFee: new Prisma.Decimal('0') }),
    );

    await expect(createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps())).rejects.toMatchObject({
      code: 'UNPROCESSABLE_ENTITY',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces an unreachable Horizon as a 422', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps())).rejects.toMatchObject({
      code: 'UNPROCESSABLE_ENTITY',
      message: 'Could not reach Stellar Horizon to build the payment',
    });
  });

  it('explains an unfunded buyer account', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });

    await expect(createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps())).rejects.toMatchObject({
      code: 'UNPROCESSABLE_ENTITY',
      message: 'Your Stellar account is not funded on this network',
    });
  });

  it('reports a Horizon error response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    await expect(createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps())).rejects.toMatchObject({
      code: 'UNPROCESSABLE_ENTITY',
      message: 'Could not load your Stellar account from Horizon',
    });
  });

  it('rejects a Horizon account without a sequence number', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    await expect(createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps())).rejects.toMatchObject({
      code: 'UNPROCESSABLE_ENTITY',
    });
  });

  it('rejects a malformed sequence number', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ sequence: '' }) });

    await expect(createOrderPaymentIntent(ORDER_ID, BUYER_ID, makeDeps())).rejects.toMatchObject({
      code: 'UNPROCESSABLE_ENTITY',
    });
  });
});

describe('horizonUrl / networkPassphrase', () => {
  it('defaults to the matching Horizon for the network', () => {
    envMock.stellarNetwork = 'testnet';
    envMock.stellarHorizonUrl = undefined;
    expect(horizonUrl()).toBe(TESTNET_HORIZON);
    expect(networkPassphrase()).toBe(Networks.TESTNET);

    envMock.stellarNetwork = 'public';
    expect(horizonUrl()).toBe(PUBLIC_HORIZON);
    expect(networkPassphrase()).toBe(Networks.PUBLIC);
  });

  it('prefers an explicit Horizon override', () => {
    envMock.stellarNetwork = 'public';
    envMock.stellarHorizonUrl = 'https://horizon.internal.example';
    expect(horizonUrl()).toBe('https://horizon.internal.example');
  });
});
