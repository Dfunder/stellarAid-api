import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const transaction = {
    commission: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    review: { create: vi.fn() },
    notification: { create: vi.fn() },
  };
  return {
    prismaMock: {
      $transaction: vi.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
      transaction,
      user: { findUnique: vi.fn() },
    },
  };
});

vi.mock('@/services', () => ({ prisma: prismaMock }));

import { createCommission, updateCommissionStatus } from './commissions.service';

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

const CREATE_INPUT = {
  artistId: ARTIST_ID,
  title: 'Album cover',
  description: 'A painted cover for an upcoming album.',
  budget: 250,
  asset: 'USDC' as const,
  deadline: new Date('2027-01-01T00:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.transaction.commission.findUnique.mockResolvedValue(makeCommission());
  prismaMock.transaction.commission.update.mockResolvedValue(makeCommission('ACCEPTED'));
  prismaMock.transaction.commission.create.mockResolvedValue(makeCommission());
  prismaMock.transaction.review.create.mockResolvedValue({ id: 'review-1' });
  prismaMock.transaction.notification.create.mockResolvedValue({ id: 'notification-1' });
  prismaMock.user.findUnique.mockResolvedValue({ id: ARTIST_ID, role: 'ARTIST' });
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

describe('createCommission', () => {
  it('creates a PENDING commission and notifies the artist in one transaction', async () => {
    const commission = await createCommission(CLIENT_ID, CREATE_INPUT);

    expect(prismaMock.transaction.commission.create).toHaveBeenCalledWith({
      data: {
        clientId: CLIENT_ID,
        artistId: ARTIST_ID,
        title: CREATE_INPUT.title,
        description: CREATE_INPUT.description,
        budget: CREATE_INPUT.budget,
        asset: 'USDC',
        deadline: CREATE_INPUT.deadline,
        status: 'PENDING',
      },
    });
    expect(prismaMock.transaction.notification.create).toHaveBeenCalledWith({
      data: {
        userId: ARTIST_ID,
        type: 'COMMISSION_REQUEST',
        data: { commissionId: COMMISSION_ID, clientId: CLIENT_ID, title: CREATE_INPUT.title },
      },
    });
    expect(commission.status).toBe('PENDING');
  });

  it('rejects a commission addressed to the caller', async () => {
    await expect(
      createCommission(CLIENT_ID, { ...CREATE_INPUT, artistId: CLIENT_ID }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an unknown recipient', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(createCommission(CLIENT_ID, CREATE_INPUT)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects a recipient who is not an artist', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: ARTIST_ID, role: 'USER' });

    await expect(createCommission(CLIENT_ID, CREATE_INPUT)).rejects.toMatchObject({
      code: 'UNPROCESSABLE_ENTITY',
    });
  });
});
