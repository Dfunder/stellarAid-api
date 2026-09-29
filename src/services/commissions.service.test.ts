import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const transaction = {
    commission: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    review: { create: vi.fn() },
    commissionEvent: { create: vi.fn() },
    commissionDispute: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: { findMany: vi.fn() },
    notification: { create: vi.fn(), createMany: vi.fn() },
  };
  return {
    prismaMock: {
      $transaction: vi.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
      transaction,
      commission: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
      commissionEvent: { findMany: vi.fn() },
      commissionDispute: { findUnique: vi.fn(), findMany: vi.fn() },
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
  listCommissionDisputes,
  listCommissionsForUser,
  raiseCommissionDispute,
  resolveCommissionDispute,
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
  // No open dispute unless a test asks for one.
  prismaMock.transaction.commissionDispute.findFirst.mockResolvedValue(null);
  prismaMock.transaction.commissionDispute.findUnique.mockResolvedValue(null);
  prismaMock.transaction.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
  prismaMock.transaction.notification.createMany.mockResolvedValue({ count: 1 });
  prismaMock.commission.findUnique.mockResolvedValue(makeCommission());
  prismaMock.commissionEvent.findMany.mockResolvedValue([]);
  prismaMock.commissionDispute.findUnique.mockResolvedValue(null);
  prismaMock.commissionDispute.findMany.mockResolvedValue([]);
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

  it('rejects an artist skipping a state (PENDING → DELIVERED)', async () => {
    await expect(
      updateCommissionStatus(COMMISSION_ID, ARTIST_ID, 'ARTIST', { status: 'DELIVERED' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prismaMock.transaction.commission.update).not.toHaveBeenCalled();
  });

  it('rejects the artist accepting work as the client', async () => {
    await expect(
      updateCommissionStatus(COMMISSION_ID, CLIENT_ID, 'USER', { status: 'ACCEPTED' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects completing a delivered commission without a review', async () => {
    prismaMock.transaction.commission.findUnique.mockResolvedValue(makeCommission('DELIVERED'));

    await expect(
      updateCommissionStatus(COMMISSION_ID, CLIENT_ID, 'USER', { status: 'COMPLETED' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(prismaMock.transaction.review.create).not.toHaveBeenCalled();
    expect(prismaMock.transaction.commission.update).not.toHaveBeenCalled();
  });

  it('lets either party cancel a commission that was never delivered', async () => {
    await updateCommissionStatus(COMMISSION_ID, ARTIST_ID, 'ARTIST', { status: 'CANCELLED' });

    expect(prismaMock.transaction.commission.update).toHaveBeenCalledWith({
      where: { id: COMMISSION_ID },
      data: { status: 'CANCELLED' },
    });
  });

  it('reports an unknown commission', async () => {
    prismaMock.transaction.commission.findUnique.mockResolvedValue(null);

    await expect(
      updateCommissionStatus(COMMISSION_ID, ARTIST_ID, 'ARTIST', { status: 'ACCEPTED' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
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

  it('includes the dispute raised against the commission', async () => {
    prismaMock.commissionDispute.findUnique.mockResolvedValue({ id: 'dispute-1', status: 'OPEN' });

    const detail = await getCommissionDetail(COMMISSION_ID, CLIENT_ID, 'USER');

    expect(detail.dispute).toMatchObject({ id: 'dispute-1', status: 'OPEN' });
  });

  it('reports null parties when a participant row is gone', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    const detail = await getCommissionDetail(COMMISSION_ID, CLIENT_ID, 'USER');

    expect(detail.parties.client).toBeNull();
    expect(detail.parties.artist).toBeNull();
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

describe('listCommissionsForUser', () => {
  const baseQuery = { sort: 'newest', page: 1, limit: 20 } as const;

  beforeEach(() => {
    prismaMock.commission.count.mockResolvedValue(2);
    prismaMock.commission.findMany.mockResolvedValue([
      { id: 'commission-1', clientId: CLIENT_ID, artistId: ARTIST_ID },
      { id: 'commission-2', clientId: CLIENT_ID, artistId: ARTIST_ID },
    ]);
  });

  it('scopes a client to the commissions they requested', async () => {
    const result = await listCommissionsForUser(CLIENT_ID, 'USER', baseQuery);

    expect(prismaMock.commission.findMany).toHaveBeenCalledWith({
      where: { clientId: CLIENT_ID },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(result.total).toBe(2);
    expect(result.hasNext).toBe(false);
    expect(result.data[0]?.client?.id).toBe(CLIENT_ID);
  });

  it('scopes an artist to the commissions they received', async () => {
    await listCommissionsForUser(ARTIST_ID, 'ARTIST', baseQuery);

    expect(prismaMock.commission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { artistId: ARTIST_ID } }),
    );
  });

  it('honours an explicit view over the caller role', async () => {
    await listCommissionsForUser(ARTIST_ID, 'ARTIST', { ...baseQuery, view: 'client' });

    expect(prismaMock.commission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: ARTIST_ID } }),
    );
  });

  it('applies status and date-range filters', async () => {
    const from = new Date('2026-09-01T00:00:00Z');
    const to = new Date('2026-09-30T00:00:00Z');

    await listCommissionsForUser(CLIENT_ID, 'USER', {
      ...baseQuery,
      status: 'DELIVERED',
      from,
      to,
    });

    expect(prismaMock.commission.findMany).toHaveBeenCalledWith({
      where: { clientId: CLIENT_ID, status: 'DELIVERED', createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
  });

  it('paginates and reports whether another page exists', async () => {
    prismaMock.commission.count.mockResolvedValue(5);

    const result = await listCommissionsForUser(CLIENT_ID, 'USER', {
      ...baseQuery,
      page: 2,
      limit: 2,
      sort: 'oldest',
    });

    expect(prismaMock.commission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' }, skip: 2, take: 2 }),
    );
    expect(result.hasNext).toBe(true);
  });

  it('returns an empty page without reporting more results', async () => {
    prismaMock.commission.count.mockResolvedValue(0);
    prismaMock.commission.findMany.mockResolvedValue([]);

    const result = await listCommissionsForUser(CLIENT_ID, 'USER', baseQuery);

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.hasNext).toBe(false);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });
});

describe('updateCommissionStatus with an open dispute', () => {
  it('holds escrow by refusing to complete a commission under dispute', async () => {
    prismaMock.transaction.commission.findUnique.mockResolvedValue(makeCommission('DISPUTED'));
    prismaMock.transaction.commissionDispute.findFirst.mockResolvedValue({
      id: 'dispute-1',
      status: 'OPEN',
    });

    await expect(
      updateCommissionStatus(COMMISSION_ID, CLIENT_ID, 'USER', {
        status: 'COMPLETED',
        review: { rating: 5, body: 'Great' },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(prismaMock.transaction.commission.update).not.toHaveBeenCalled();
  });

  it('refuses to cancel a commission under dispute', async () => {
    prismaMock.transaction.commissionDispute.findFirst.mockResolvedValue({
      id: 'dispute-1',
      status: 'REVIEWING',
    });

    await expect(
      updateCommissionStatus(COMMISSION_ID, ARTIST_ID, 'ARTIST', { status: 'CANCELLED' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('lets a transition through once the dispute is closed', async () => {
    prismaMock.transaction.commissionDispute.findFirst.mockResolvedValue(null);

    await expect(
      updateCommissionStatus(COMMISSION_ID, ARTIST_ID, 'ARTIST', { status: 'ACCEPTED' }),
    ).resolves.toBeDefined();
  });
});

function makeDispute(status = 'OPEN') {
  return {
    id: 'dispute-1',
    commissionId: COMMISSION_ID,
    raisedById: CLIENT_ID,
    reason: 'The artwork does not match the brief',
    evidence: null,
    status,
    resolution: null,
    resolvedById: null,
    resolvedAt: null,
    createdAt: new Date('2026-09-10T10:00:00Z'),
  } as never;
}

describe('raiseCommissionDispute', () => {
  const input = { reason: 'The artwork does not match the brief' };

  it('records the dispute, moves the commission to DISPUTED and notifies admins', async () => {
    prismaMock.transaction.commission.findUnique.mockResolvedValue(makeCommission('DELIVERED'));
    prismaMock.transaction.commissionDispute.create.mockResolvedValue(makeDispute());

    const dispute = await raiseCommissionDispute(COMMISSION_ID, CLIENT_ID, input);

    expect(dispute.status).toBe('OPEN');
    expect(prismaMock.transaction.commission.update).toHaveBeenCalledWith({
      where: { id: COMMISSION_ID },
      data: { status: 'DISPUTED' },
    });
    expect(prismaMock.transaction.commissionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fromStatus: 'DELIVERED', toStatus: 'DISPUTED' }),
      }),
    );
    expect(prismaMock.transaction.notification.createMany).toHaveBeenCalled();
  });

  it('rejects a dispute raised by anyone but the client', async () => {
    prismaMock.transaction.commission.findUnique.mockResolvedValue(makeCommission('DELIVERED'));

    await expect(raiseCommissionDispute(COMMISSION_ID, ARTIST_ID, input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects a dispute before final delivery', async () => {
    prismaMock.transaction.commission.findUnique.mockResolvedValue(makeCommission('IN_PROGRESS'));

    await expect(raiseCommissionDispute(COMMISSION_ID, CLIENT_ID, input)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('rejects a second dispute on the same commission', async () => {
    prismaMock.transaction.commission.findUnique.mockResolvedValue(makeCommission('DELIVERED'));
    prismaMock.transaction.commissionDispute.findUnique.mockResolvedValue(makeDispute());

    await expect(raiseCommissionDispute(COMMISSION_ID, CLIENT_ID, input)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('rejects an unknown commission', async () => {
    prismaMock.transaction.commission.findUnique.mockResolvedValue(null);

    await expect(raiseCommissionDispute(COMMISSION_ID, CLIENT_ID, input)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('resolveCommissionDispute', () => {
  beforeEach(() => {
    prismaMock.transaction.commissionDispute.findUnique.mockResolvedValue(makeDispute());
    prismaMock.transaction.commissionDispute.update.mockResolvedValue(makeDispute('RESOLVED'));
  });

  it('releases escrow to the artist by completing the commission', async () => {
    const result = await resolveCommissionDispute(COMMISSION_ID, 'admin-1', 'ADMIN', {
      decision: 'RELEASE_TO_ARTIST',
    });

    expect(result.dispute.status).toBe('RESOLVED');
    expect(prismaMock.transaction.commission.update).toHaveBeenCalledWith({
      where: { id: COMMISSION_ID },
      data: { status: 'COMPLETED' },
    });
  });

  it('refunds the client by cancelling the commission', async () => {
    await resolveCommissionDispute(COMMISSION_ID, 'admin-1', 'ADMIN', {
      decision: 'REFUND_CLIENT',
    });

    expect(prismaMock.transaction.commission.update).toHaveBeenCalledWith({
      where: { id: COMMISSION_ID },
      data: { status: 'CANCELLED' },
    });
  });

  it('rejects the dispute and returns the commission to DELIVERED', async () => {
    await resolveCommissionDispute(COMMISSION_ID, 'admin-1', 'ADMIN', { decision: 'REJECT' });

    expect(prismaMock.transaction.commissionDispute.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) }),
    );
    expect(prismaMock.transaction.commission.update).toHaveBeenCalledWith({
      where: { id: COMMISSION_ID },
      data: { status: 'DELIVERED' },
    });
  });

  it('notifies both parties of the outcome', async () => {
    await resolveCommissionDispute(COMMISSION_ID, 'admin-1', 'ADMIN', {
      decision: 'RELEASE_TO_ARTIST',
    });

    const call = prismaMock.transaction.notification.createMany.mock.calls[0]?.[0] as {
      data: readonly { userId: string }[];
    };
    expect(call.data.map((row) => row.userId).sort()).toEqual([ARTIST_ID, CLIENT_ID].sort());
  });

  it('rejects a non-admin caller', async () => {
    await expect(
      resolveCommissionDispute(COMMISSION_ID, CLIENT_ID, 'USER', { decision: 'REJECT' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prismaMock.transaction.commissionDispute.update).not.toHaveBeenCalled();
  });

  it('rejects an already-resolved dispute', async () => {
    prismaMock.transaction.commissionDispute.findUnique.mockResolvedValue(makeDispute('RESOLVED'));

    await expect(
      resolveCommissionDispute(COMMISSION_ID, 'admin-1', 'ADMIN', { decision: 'REJECT' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('reports a commission that has no dispute at all', async () => {
    prismaMock.transaction.commissionDispute.findUnique.mockResolvedValue(null);

    await expect(
      resolveCommissionDispute(COMMISSION_ID, 'admin-1', 'ADMIN', { decision: 'REJECT' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('listCommissionDisputes', () => {
  it('defaults to the disputes still holding escrow', async () => {
    await listCommissionDisputes('ADMIN');

    expect(prismaMock.commissionDispute.findMany).toHaveBeenCalledWith({
      where: { status: { in: ['OPEN', 'REVIEWING'] } },
      orderBy: { createdAt: 'asc' },
      include: { commission: true },
    });
  });

  it('filters by an explicit status', async () => {
    await listCommissionDisputes('ADMIN', 'RESOLVED');

    expect(prismaMock.commissionDispute.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'RESOLVED' } }),
    );
  });

  it('rejects a non-admin caller', async () => {
    await expect(listCommissionDisputes('USER')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prismaMock.commissionDispute.findMany).not.toHaveBeenCalled();
  });
});
