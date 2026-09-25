import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const transaction = {
    commission: { findUnique: vi.fn(), update: vi.fn() },
    review: { create: vi.fn() },
  };
  return {
    prismaMock: {
      $transaction: vi.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
      transaction,
    },
  };
});

vi.mock('@/services', () => ({ prisma: prismaMock }));

import { updateCommissionStatus } from './commissions.service';

const COMMISSION_ID = 'commission-1';
const CLIENT_ID = 'client-1';
const ARTIST_ID = 'artist-1';

function makeCommission(status = 'PENDING') {
  return {
    id: COMMISSION_ID,
    clientId: CLIENT_ID,
    artistId: ARTIST_ID,
    status,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.transaction.commission.findUnique.mockResolvedValue(makeCommission());
  prismaMock.transaction.commission.update.mockResolvedValue(makeCommission('ACCEPTED'));
  prismaMock.transaction.review.create.mockResolvedValue({ id: 'review-1' });
});

describe('updateCommissionStatus', () => {
  it('allows the artist to progress an accepted commission', async () => {
    prismaMock.transaction.commission.findUnique.mockResolvedValue(makeCommission('ACCEPTED'));

    await updateCommissionStatus(COMMISSION_ID, ARTIST_ID, 'ARTIST', { status: 'IN_PROGRESS' });

    expect(prismaMock.transaction.commission.update).toHaveBeenCalledWith({
      where: { id: COMMISSION_ID },
      data: { status: 'IN_PROGRESS' },
    });
  });

  it('allows the artist to accept a pending commission', async () => {
    await updateCommissionStatus(COMMISSION_ID, ARTIST_ID, 'ARTIST', { status: 'ACCEPTED' });

    expect(prismaMock.transaction.commission.update).toHaveBeenCalledWith({
      where: { id: COMMISSION_ID },
      data: { status: 'ACCEPTED' },
    });
  });

  it('allows the client to dispute a delivered commission', async () => {
    prismaMock.transaction.commission.findUnique.mockResolvedValue(makeCommission('DELIVERED'));

    await updateCommissionStatus(COMMISSION_ID, CLIENT_ID, 'USER', { status: 'DISPUTED' });

    expect(prismaMock.transaction.commission.update).toHaveBeenCalledWith({
      where: { id: COMMISSION_ID },
      data: { status: 'DISPUTED' },
    });
  });

  it('creates the client review when completing a delivered commission', async () => {
    prismaMock.transaction.commission.findUnique.mockResolvedValue(makeCommission('DELIVERED'));

    await updateCommissionStatus(COMMISSION_ID, CLIENT_ID, 'USER', {
      status: 'COMPLETED',
      review: { rating: 5, body: 'Excellent work' },
    });

    expect(prismaMock.transaction.review.create).toHaveBeenCalledWith({
      data: {
        commissionId: COMMISSION_ID,
        authorId: CLIENT_ID,
        targetId: ARTIST_ID,
        rating: 5,
        title: undefined,
        body: 'Excellent work',
      },
    });
  });

  it('rejects cancellation after delivery', async () => {
    prismaMock.transaction.commission.findUnique.mockResolvedValue(makeCommission('DELIVERED'));

    await expect(
      updateCommissionStatus(COMMISSION_ID, CLIENT_ID, 'USER', { status: 'CANCELLED' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prismaMock.transaction.commission.update).not.toHaveBeenCalled();
  });

  it('rejects users who are not commission participants', async () => {
    await expect(
      updateCommissionStatus(COMMISSION_ID, 'other-user', 'USER', { status: 'CANCELLED' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});