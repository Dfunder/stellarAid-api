import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const transaction = {
    commission: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    review: { create: vi.fn() },
    commissionEvent: { create: vi.fn() },
    notification: { create: vi.fn() },
  };
  return {
    prismaMock: {
      $transaction: vi.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
      transaction,
      commission: { findUnique: vi.fn() },
      commissionEvent: { findMany: vi.fn() },
      deliverable: { findMany: vi.fn() },
      review: { findMany: vi.fn() },
      user: { findUnique: vi.fn(), findMany: vi.fn() },
    },
  };
});

vi.mock('@/services', () => ({ prisma: prismaMock }));

import {
  createCommission,
  getCommissionDetail,
  updateCommissionStatus,
} from './commissions.service';

const COMMISSION_ID = 'commission-1';
const CLIENT_ID = 'client-1';
const ARTIST_ID = 'artist-1';

function makeCommission(status = 'PENDING') {
  return {
    id: COMMISSION_ID,
    clientId: CLIENT_ID,
    artistId: ARTIST_ID,
    status,
    createdAt: new Date('2026-09-01T10:00:00Z'),
    updatedAt: new Date('2026-09-02T10:00:00Z'),
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
  prismaMock.transaction.commissionEvent.create.mockResolvedValue({ id: 'event-1' });
  prismaMock.transaction.notification.create.mockResolvedValue({ id: 'notification-1' });
  prismaMock.user.findUnique.mockResolvedValue({ id: ARTIST_ID, role: 'ARTIST' });
  prismaMock.commission.findUnique.mockResolvedValue(makeCommission());
  prismaMock.commissionEvent.findMany.mockResolvedValue([]);
  prismaMock.deliverable.findMany.mockResolvedValue([]);
  prismaMock.review.findMany.mockResolvedValue([]);
  prismaMock.user.findMany.mockResolvedValue([
    { id: CLIENT_ID, name: 'Client', username: 'client', role: 'USER' },
    { id: ARTIST_ID, name: 'Artist', username: 'artist', role: 'ARTIST' },
  ]);
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

  it('records a status-change event in the same transaction', async () => {
    await updateCommissionStatus(COMMISSION_ID, ARTIST_ID, 'ARTIST', { status: 'ACCEPTED' });

    expect(prismaMock.transaction.commissionEvent.create).toHaveBeenCalledWith({
      data: {
        commissionId: COMMISSION_ID,
        fromStatus: 'PENDING',
        toStatus: 'ACCEPTED',
        actorId: ARTIST_ID,
      },
    });
  });
});

describe('getCommissionDetail', () => {
  it('returns parties, deliverables, reviews and an ordered timeline', async () => {
    prismaMock.commissionEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        fromStatus: 'PENDING',
        toStatus: 'ACCEPTED',
        actorId: ARTIST_ID,
        note: null,
        createdAt: new Date('2026-09-02T10:00:00Z'),
      },
      {
        id: 'event-2',
        fromStatus: 'ACCEPTED',
        toStatus: 'IN_PROGRESS',
        actorId: ARTIST_ID,
        note: null,
        createdAt: new Date('2026-09-03T10:00:00Z'),
      },
    ]);
    prismaMock.deliverable.findMany.mockResolvedValue([{ id: 'deliverable-1' }]);
    prismaMock.review.findMany.mockResolvedValue([{ id: 'review-1' }]);

    const detail = await getCommissionDetail(COMMISSION_ID, CLIENT_ID, 'USER');

    expect(detail.timeline.map((entry) => entry.type)).toEqual([
      'CREATED',
      'STATUS_CHANGED',
      'STATUS_CHANGED',
    ]);
    expect(detail.timeline.map((entry) => entry.toStatus)).toEqual([
      'PENDING',
      'ACCEPTED',
      'IN_PROGRESS',
    ]);
    expect(detail.deliverables).toEqual([{ id: 'deliverable-1' }]);
    expect(detail.reviews).toEqual([{ id: 'review-1' }]);
    expect(detail.parties.client?.id).toBe(CLIENT_ID);
    expect(detail.parties.artist?.id).toBe(ARTIST_ID);
  });

  it('keeps the timeline ordered oldest first even when events arrive unordered', async () => {
    prismaMock.commissionEvent.findMany.mockResolvedValue([
      {
        id: 'event-newer',
        fromStatus: 'ACCEPTED',
        toStatus: 'DELIVERED',
        actorId: ARTIST_ID,
        note: null,
        createdAt: new Date('2026-09-05T10:00:00Z'),
      },
      {
        id: 'event-older',
        fromStatus: 'PENDING',
        toStatus: 'ACCEPTED',
        actorId: ARTIST_ID,
        note: null,
        createdAt: new Date('2026-09-02T10:00:00Z'),
      },
    ]);

    const detail = await getCommissionDetail(COMMISSION_ID, ARTIST_ID, 'ARTIST');

    expect(detail.timeline.map((entry) => entry.id)).toEqual([
      `${COMMISSION_ID}:created`,
      'event-older',
      'event-newer',
    ]);
  });

  it('lets an admin view any commission', async () => {
    await expect(getCommissionDetail(COMMISSION_ID, 'admin-1', 'ADMIN')).resolves.toBeDefined();
  });

  it('rejects a caller who is not a participant', async () => {
    await expect(getCommissionDetail(COMMISSION_ID, 'other-user', 'USER')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects an unknown commission', async () => {
    prismaMock.commission.findUnique.mockResolvedValue(null);

    await expect(getCommissionDetail(COMMISSION_ID, CLIENT_ID, 'USER')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
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
