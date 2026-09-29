import { beforeEach, describe, expect, it, vi } from 'vitest';

const CLIENT_ID = 'client-1';
const ARTIST_ID = 'artist-1';
const COMMISSION_ID = 'commission-1';

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    commission: { findUnique: vi.fn(), update: vi.fn() },
    commissionDispute: { findFirst: vi.fn() },
    transaction: { findFirst: vi.fn() },
    commissionEvent: { create: vi.fn() },
    notification: { createMany: vi.fn() },
  };
  return {
    txMock: tx,
    prismaMock: {
      // Typed loosely so `tx` isn't referenced in its own annotation.
      $transaction: vi.fn(async (callback: (client: unknown) => Promise<unknown>) => callback(tx)),
      tx,
    },
  };
});

vi.mock('@/services', () => ({ prisma: prismaMock }));

import { cancelCommission } from './commissions.service';

function makeCommission(status = 'IN_PROGRESS') {
  return {
    id: COMMISSION_ID,
    clientId: CLIENT_ID,
    artistId: ARTIST_ID,
    status,
    budget: 450,
    asset: 'USDC' as const,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  txMock.commission.findUnique.mockResolvedValue(makeCommission());
  txMock.commission.update.mockImplementation(async ({ data }: { data: { status: string } }) =>
    makeCommission(data.status),
  );
  txMock.commissionEvent.create.mockResolvedValue({ id: 'event-1' });
  txMock.notification.createMany.mockResolvedValue({ count: 2 });
  txMock.commissionDispute.findFirst.mockResolvedValue(null);
  // Not funded unless a test says so.
  txMock.transaction.findFirst.mockResolvedValue(null);
});

describe('cancelCommission (#826)', () => {
  it('cancels before delivery, logs the reason on the timeline and notifies both parties', async () => {
    const result = await cancelCommission(COMMISSION_ID, CLIENT_ID, {
      reason: '  The brief changed on our side.  ',
    });

    expect(result.commission.status).toBe('CANCELLED');
    expect(txMock.commissionEvent.create).toHaveBeenCalledWith({
      data: {
        commissionId: COMMISSION_ID,
        fromStatus: 'IN_PROGRESS',
        toStatus: 'CANCELLED',
        actorId: CLIENT_ID,
        note: 'The brief changed on our side.',
      },
    });

    expect(txMock.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: CLIENT_ID,
          type: 'COMMISSION_CANCELLED',
          data: expect.objectContaining({
            cancelledById: CLIENT_ID,
            reason: 'The brief changed on our side.',
            refundRequired: false,
          }),
        }),
        expect.objectContaining({
          userId: ARTIST_ID,
          type: 'COMMISSION_CANCELLED',
          data: expect.objectContaining({ reason: 'The brief changed on our side.' }),
        }),
      ],
    });
  });

  it.each(['PENDING', 'ACCEPTED', 'IN_PROGRESS'])(
    'lets either party cancel from %s',
    async (status) => {
      txMock.commission.findUnique.mockResolvedValue(makeCommission(status));

      await expect(
        cancelCommission(COMMISSION_ID, ARTIST_ID, { reason: 'Cannot take this on.' }),
      ).resolves.toMatchObject({ commission: { status: 'CANCELLED' } });
    },
  );

  it('reports the refund owed once the commission was funded', async () => {
    txMock.transaction.findFirst.mockResolvedValue({
      id: 'transaction-1',
      amount: 450,
      asset: 'USDC',
      confirmed: true,
    });

    const result = await cancelCommission(COMMISSION_ID, CLIENT_ID, { reason: 'Changed plans.' });

    expect(txMock.transaction.findFirst).toHaveBeenCalledWith({
      where: { commissionId: COMMISSION_ID, confirmed: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(result.refund).toEqual({ required: true, amount: '450.00', asset: 'USDC' });
    expect(txMock.notification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            refundRequired: true,
            refundAmount: '450.00',
            refundAsset: 'USDC',
          }),
        }),
      ]),
    });
  });

  it('owes nothing when the commission was never funded', async () => {
    const result = await cancelCommission(COMMISSION_ID, ARTIST_ID, { reason: 'No budget.' });
    expect(result.refund).toEqual({ required: false, amount: null, asset: null });
  });

  it('only counts confirmed transactions as funding', async () => {
    // An unconfirmed/abandoned transfer must not look like money to refund.
    txMock.transaction.findFirst.mockResolvedValue(null);

    const result = await cancelCommission(COMMISSION_ID, CLIENT_ID, { reason: 'Abandoned.' });

    expect(txMock.transaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { commissionId: COMMISSION_ID, confirmed: true } }),
    );
    expect(result.refund.required).toBe(false);
  });

  it.each(['DELIVERED', 'COMPLETED', 'CANCELLED', 'DISPUTED'])(
    'refuses to cancel a commission that is %s',
    async (status) => {
      txMock.commission.findUnique.mockResolvedValue(makeCommission(status));

      await expect(
        cancelCommission(COMMISSION_ID, CLIENT_ID, { reason: 'Too late.' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(txMock.commission.update).not.toHaveBeenCalled();
    },
  );

  it('refuses to cancel while a dispute holds escrow', async () => {
    txMock.commissionDispute.findFirst.mockResolvedValue({ id: 'dispute-1', status: 'OPEN' });

    await expect(
      cancelCommission(COMMISSION_ID, CLIENT_ID, { reason: 'Give up.' }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'This commission has an open dispute; an admin must resolve it first',
    });
    expect(txMock.commission.update).not.toHaveBeenCalled();
  });

  it('keeps non-participants out', async () => {
    await expect(
      cancelCommission(COMMISSION_ID, 'stranger', { reason: 'Mine now.' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(txMock.commission.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown commission', async () => {
    txMock.commission.findUnique.mockResolvedValue(null);

    await expect(
      cancelCommission(COMMISSION_ID, CLIENT_ID, { reason: 'Nope.' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it.each([
    ['', 'an empty reason'],
    ['   ', 'a whitespace-only reason'],
    ['x'.repeat(2001), 'an over-long reason'],
  ])('rejects %s', async (reason) => {
    await expect(cancelCommission(COMMISSION_ID, CLIENT_ID, { reason })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(txMock.commission.update).not.toHaveBeenCalled();
  });
});
